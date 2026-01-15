import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMentorDto, UpdateMentorDto, SearchMentorDto } from './dto';
import type { MentorProfile, VerificationStatus, Prisma } from '@prisma/client';

@Injectable()
export class MentorsService {
  private readonly logger = new Logger(MentorsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a mentor profile for a user
   */
  async create(userId: string, createDto: CreateMentorDto): Promise<MentorProfile> {
    // Check if user exists and has MENTOR role
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { mentorProfile: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role !== 'MENTOR') {
      throw new ForbiddenException('Only users with MENTOR role can create a mentor profile');
    }

    if (user.mentorProfile) {
      throw new ConflictException('User already has a mentor profile');
    }

    // Validate hourlyRate is required unless freeSessionsOnly is true
    if (!createDto.freeSessionsOnly && !createDto.hourlyRate) {
      throw new BadRequestException('Hourly rate is required unless offering free sessions only');
    }

    const mentorProfile = await this.prisma.mentorProfile.create({
      data: {
        userId,
        bio: createDto.bio,
        headline: createDto.headline,
        videoIntroUrl: createDto.videoIntroUrl,
        yearsExperience: createDto.yearsExperience ?? 0,
        certifications: (createDto.certifications as object[]) ?? [],
        education: createDto.education,
        languages: createDto.languages,
        nativeLanguage: createDto.nativeLanguage,
        specialties: createDto.specialties,
        teachesChildren: createDto.teachesChildren ?? false,
        teachesTeenagers: createDto.teachesTeenagers ?? false,
        teachesAdults: createDto.teachesAdults ?? true,
        beginnerFriendly: createDto.beginnerFriendly ?? true,
        patientWithSlowLearners: createDto.patientWithSlowLearners ?? true,
        experiencedWithNewMuslims: createDto.experiencedWithNewMuslims ?? false,
        acceptedLevels: createDto.acceptedLevels ?? [],
        specialNeedsSupport: createDto.specialNeedsSupport ?? false,
        hourlyRate: createDto.hourlyRate,
        currency: createDto.currency ?? 'EUR',
        freeTrialAvailable: createDto.freeTrialAvailable ?? false,
        freeTrialDuration: createDto.freeTrialDuration ?? 30,
        freeSessionsOnly: createDto.freeSessionsOnly ?? false,
        maxStudentsPerWeek: createDto.maxStudentsPerWeek ?? 20,
        minSessionDuration: createDto.minSessionDuration ?? 30,
        maxSessionDuration: createDto.maxSessionDuration ?? 120,
        verificationStatus: 'PENDING',
      },
      include: { user: true },
    });

    this.logger.log(`Mentor profile created for user ${userId}`);
    return mentorProfile;
  }

  /**
   * Get all mentors with filters (only approved and active mentors for public)
   */
  async findAll(
    filters: SearchMentorDto,
    includeNonApproved = false,
  ): Promise<{ data: MentorProfile[]; total: number; page: number; pageSize: number; totalPages: number }> {
    const { page = 1, limit = 10, sortBy = 'averageRating', sortOrder = 'desc' } = filters;
    const skip = (page - 1) * limit;

    const where = this.buildWhereClause(filters, includeNonApproved);
    const orderBy = this.buildOrderBy(sortBy, sortOrder);

    const [data, total] = await Promise.all([
      this.prisma.mentorProfile.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              countryCode: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.mentorProfile.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find mentor by ID
   */
  async findById(id: string, includeNonApproved = false): Promise<MentorProfile | null> {
    const where: Prisma.MentorProfileWhereInput = { id };

    if (!includeNonApproved) {
      where.verificationStatus = 'APPROVED';
      where.isActive = true;
    }

    return this.prisma.mentorProfile.findFirst({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            countryCode: true,
            timezone: true,
          },
        },
        availabilities: true,
      },
    });
  }

  /**
   * Find mentor by ID or throw
   */
  async findByIdOrFail(id: string, includeNonApproved = false): Promise<MentorProfile> {
    const mentor = await this.findById(id, includeNonApproved);
    if (!mentor) {
      throw new NotFoundException('Mentor profile not found');
    }
    return mentor;
  }

  /**
   * Find mentor profile by user ID
   */
  async findByUserId(userId: string): Promise<MentorProfile | null> {
    return this.prisma.mentorProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            countryCode: true,
            timezone: true,
          },
        },
        availabilities: true,
      },
    });
  }

  /**
   * Update mentor profile
   */
  async update(id: string, userId: string, updateDto: UpdateMentorDto): Promise<MentorProfile> {
    const mentor = await this.findByIdOrFail(id, true);

    // Verify ownership
    if (mentor.userId !== userId) {
      throw new ForbiddenException('You can only update your own mentor profile');
    }

    // Validate hourlyRate if changing freeSessionsOnly
    if (updateDto.freeSessionsOnly === false && !updateDto.hourlyRate && !mentor.hourlyRate) {
      throw new BadRequestException('Hourly rate is required when not offering free sessions only');
    }

    const { certifications, ...restDto } = updateDto;
    return this.prisma.mentorProfile.update({
      where: { id },
      data: {
        ...restDto,
        ...(certifications !== undefined && { certifications: certifications as object[] }),
        updatedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            countryCode: true,
          },
        },
      },
    });
  }

  /**
   * Update verification status (ADMIN only)
   */
  async updateVerificationStatus(
    id: string,
    status: VerificationStatus,
    verifiedById?: string,
  ): Promise<MentorProfile> {
    const mentor = await this.findByIdOrFail(id, true);

    const updateData: Prisma.MentorProfileUpdateInput = {
      verificationStatus: status,
      updatedAt: new Date(),
    };

    if (status === 'APPROVED' && verifiedById) {
      updateData.verifiedAt = new Date();
      updateData.verifiedBy = { connect: { id: verifiedById } };
    }

    this.logger.log(`Mentor ${id} verification status updated to ${status}`);

    return this.prisma.mentorProfile.update({
      where: { id },
      data: updateData,
      include: { user: true },
    });
  }

  /**
   * Advanced search with pagination
   */
  async searchMentors(
    searchDto: SearchMentorDto,
  ): Promise<{ data: MentorProfile[]; total: number; page: number; pageSize: number; totalPages: number }> {
    return this.findAll(searchDto, false);
  }

  /**
   * Get mentor statistics
   */
  async getMentorStats(id: string): Promise<{
    totalSessions: number;
    completedSessions: number;
    averageRating: number;
    totalReviews: number;
    completionRate: number;
    totalStudents: number;
  }> {
    const mentor = await this.findByIdOrFail(id, true);

    // Get unique students count
    const uniqueStudents = await this.prisma.session.groupBy({
      by: ['menteeProfileId'],
      where: { mentorProfileId: id },
    });

    const completionRate =
      mentor.totalSessions > 0
        ? Math.round((mentor.completedSessions / mentor.totalSessions) * 100 * 100) / 100
        : 0;

    return {
      totalSessions: mentor.totalSessions,
      completedSessions: mentor.completedSessions,
      averageRating: Number(mentor.averageRating),
      totalReviews: mentor.totalReviews,
      completionRate,
      totalStudents: uniqueStudents.length,
    };
  }

  /**
   * Build where clause for filtering
   */
  private buildWhereClause(filters: SearchMentorDto, includeNonApproved: boolean): Prisma.MentorProfileWhereInput {
    const where: Prisma.MentorProfileWhereInput = {};

    // Only show approved and active mentors for public queries
    if (!includeNonApproved) {
      where.verificationStatus = 'APPROVED';
      where.isActive = true;
    }

    // Language filter
    if (filters.languages?.length) {
      where.languages = { hasSome: filters.languages };
    }

    // Specialty filter
    if (filters.specialties?.length) {
      where.specialties = { hasSome: filters.specialties };
    }

    // Price range filter
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      where.hourlyRate = {};
      if (filters.minPrice !== undefined) {
        where.hourlyRate.gte = filters.minPrice;
      }
      if (filters.maxPrice !== undefined) {
        where.hourlyRate.lte = filters.maxPrice;
      }
    }

    // Rating filter
    if (filters.minRating !== undefined) {
      where.averageRating = { gte: filters.minRating };
    }

    // Teaching preferences filters
    if (filters.teachesChildren !== undefined) {
      where.teachesChildren = filters.teachesChildren;
    }
    if (filters.teachesTeenagers !== undefined) {
      where.teachesTeenagers = filters.teachesTeenagers;
    }
    if (filters.teachesAdults !== undefined) {
      where.teachesAdults = filters.teachesAdults;
    }

    // Learning levels filter
    if (filters.acceptedLevels?.length) {
      where.acceptedLevels = { hasSome: filters.acceptedLevels };
    }

    // Country filter
    if (filters.countryCode) {
      where.user = { countryCode: filters.countryCode };
    }

    // Beginner friendly filter
    if (filters.beginnerFriendly !== undefined) {
      where.beginnerFriendly = filters.beginnerFriendly;
    }

    // Free trial filter
    if (filters.freeTrialAvailable !== undefined) {
      where.freeTrialAvailable = filters.freeTrialAvailable;
    }

    // Free sessions only filter
    if (filters.freeSessionsOnly !== undefined) {
      where.freeSessionsOnly = filters.freeSessionsOnly;
    }

    // Text search in bio/headline
    if (filters.query) {
      where.OR = [
        { bio: { contains: filters.query, mode: 'insensitive' } },
        { headline: { contains: filters.query, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  /**
   * Build order by clause
   */
  private buildOrderBy(
    sortBy: string,
    sortOrder: 'asc' | 'desc',
  ): Prisma.MentorProfileOrderByWithRelationInput {
    const validSortFields = ['averageRating', 'hourlyRate', 'createdAt', 'totalSessions'];
    const field = validSortFields.includes(sortBy) ? sortBy : 'averageRating';

    return { [field]: sortOrder };
  }
}
