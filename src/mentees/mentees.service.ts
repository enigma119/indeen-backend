import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMenteeDto, UpdateMenteeDto } from './dto';
import type { MenteeProfile, LearnerCategory, LearningLevel } from '@prisma/client';

@Injectable()
export class MenteesService {
  private readonly logger = new Logger(MenteesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a mentee profile for a user
   */
  async create(userId: string, createDto: CreateMenteeDto): Promise<MenteeProfile> {
    // Check if user exists and has appropriate role
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { menteeProfile: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role !== 'MENTEE' && user.role !== 'PARENT') {
      throw new ForbiddenException('Only users with MENTEE or PARENT role can create a mentee profile');
    }

    if (user.menteeProfile) {
      throw new ConflictException('User already has a mentee profile');
    }

    // Determine if minor based on learner category
    const isMinor = this.determineIsMinor(createDto.learnerCategory, createDto.yearOfBirth);

    // Validate parental consent requirements
    if (isMinor) {
      if (!createDto.parentUserId) {
        throw new BadRequestException('Parent user ID is required for minors');
      }

      // Verify parent user exists and has PARENT role
      const parentUser = await this.prisma.user.findUnique({
        where: { id: createDto.parentUserId },
      });

      if (!parentUser) {
        throw new NotFoundException('Parent user not found');
      }

      if (parentUser.role !== 'PARENT') {
        throw new BadRequestException('Specified parent user does not have PARENT role');
      }
    }

    const menteeProfile = await this.prisma.menteeProfile.create({
      data: {
        userId,
        learnerCategory: createDto.learnerCategory,
        isMinor,
        yearOfBirth: createDto.yearOfBirth,
        parentUserId: isMinor ? createDto.parentUserId : null,
        parentalConsentGiven: false,
        currentLevel: createDto.currentLevel ?? 'NO_ARABIC',
        learningContext: createDto.learningContext,
        preferredLanguages: createDto.preferredLanguages ?? [],
        learningGoals: createDto.learningGoals ?? [],
        learningPace: createDto.learningPace ?? 'NORMAL',
        preferredSessionDuration: createDto.preferredSessionDuration ?? 60,
        hasSpecialNeeds: createDto.hasSpecialNeeds ?? false,
        specialNeedsDescription: createDto.specialNeedsDescription,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        parent: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    this.logger.log(`Mentee profile created for user ${userId}`);
    return menteeProfile;
  }

  /**
   * Find mentee by ID
   */
  async findById(id: string): Promise<MenteeProfile | null> {
    return this.prisma.menteeProfile.findUnique({
      where: { id },
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
        parent: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        progressTracking: {
          orderBy: { updatedAt: 'desc' },
          take: 10,
        },
      },
    });
  }

  /**
   * Find mentee by ID or throw
   */
  async findByIdOrFail(id: string): Promise<MenteeProfile> {
    const mentee = await this.findById(id);
    if (!mentee) {
      throw new NotFoundException('Mentee profile not found');
    }
    return mentee;
  }

  /**
   * Find mentee profile by user ID
   */
  async findByUserId(userId: string): Promise<MenteeProfile | null> {
    return this.prisma.menteeProfile.findUnique({
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
        parent: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  /**
   * Update mentee profile
   */
  async update(id: string, userId: string, updateDto: UpdateMenteeDto): Promise<MenteeProfile> {
    const mentee = await this.findByIdOrFail(id);

    // Verify ownership
    if (mentee.userId !== userId) {
      throw new ForbiddenException('You can only update your own mentee profile');
    }

    return this.prisma.menteeProfile.update({
      where: { id },
      data: {
        ...updateDto,
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
          },
        },
        parent: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  /**
   * Get mentee progress summary
   */
  async getMenteeProgress(id: string): Promise<{
    totalSessions: number;
    completedSessions: number;
    totalHoursLearned: number;
    currentLevel: LearningLevel;
    surahsStudied: number;
    surahsMastered: number;
  }> {
    const mentee = await this.findByIdOrFail(id);

    // Get surahs studied
    const progressStats = await this.prisma.progressTracking.groupBy({
      by: ['surahNumber'],
      where: {
        menteeProfileId: id,
        surahNumber: { not: null },
      },
    });

    // Get surahs mastered
    const masteredSurahs = await this.prisma.progressTracking.groupBy({
      by: ['surahNumber'],
      where: {
        menteeProfileId: id,
        surahNumber: { not: null },
        isMastered: true,
      },
    });

    return {
      totalSessions: mentee.totalSessions,
      completedSessions: mentee.completedSessions,
      totalHoursLearned: Number(mentee.totalHoursLearned),
      currentLevel: mentee.currentLevel,
      surahsStudied: progressStats.length,
      surahsMastered: masteredSurahs.length,
    };
  }

  /**
   * Check parental consent status
   */
  async checkParentalConsent(id: string): Promise<{
    isMinor: boolean;
    consentRequired: boolean;
    consentGiven: boolean;
    consentDate: Date | null;
    parent: { id: string; email: string; firstName: string | null; lastName: string | null } | null;
  }> {
    const mentee = await this.prisma.menteeProfile.findUnique({
      where: { id },
      include: {
        parent: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!mentee) {
      throw new NotFoundException('Mentee profile not found');
    }

    return {
      isMinor: mentee.isMinor,
      consentRequired: mentee.isMinor,
      consentGiven: mentee.parentalConsentGiven,
      consentDate: mentee.parentalConsentDate,
      parent: mentee.parent,
    };
  }

  /**
   * Grant parental consent (called by parent)
   */
  async grantParentalConsent(menteeId: string, parentUserId: string): Promise<MenteeProfile> {
    const mentee = await this.findByIdOrFail(menteeId);

    if (!mentee.isMinor) {
      throw new BadRequestException('Parental consent is only required for minors');
    }

    if (mentee.parentUserId !== parentUserId) {
      throw new ForbiddenException('Only the designated parent can grant consent');
    }

    if (mentee.parentalConsentGiven) {
      throw new ConflictException('Parental consent has already been granted');
    }

    return this.prisma.menteeProfile.update({
      where: { id: menteeId },
      data: {
        parentalConsentGiven: true,
        parentalConsentDate: new Date(),
        updatedAt: new Date(),
      },
      include: {
        user: true,
        parent: true,
      },
    });
  }

  /**
   * Check if user can view mentee profile
   */
  async canViewMenteeProfile(
    menteeId: string,
    requestingUserId: string,
    requestingUserRole: string,
  ): Promise<boolean> {
    // Admin can view all
    if (requestingUserRole === 'ADMIN') {
      return true;
    }

    const mentee = await this.findByIdOrFail(menteeId);

    // Mentee can view their own profile
    if (mentee.userId === requestingUserId) {
      return true;
    }

    // Parent can view their child's profile
    if (mentee.parentUserId === requestingUserId) {
      return true;
    }

    // Mentor can view if they have sessions with this mentee
    if (requestingUserRole === 'MENTOR') {
      const mentorProfile = await this.prisma.mentorProfile.findUnique({
        where: { userId: requestingUserId },
      });

      if (mentorProfile) {
        const hasSession = await this.prisma.session.findFirst({
          where: {
            mentorProfileId: mentorProfile.id,
            menteeProfileId: menteeId,
          },
        });

        return !!hasSession;
      }
    }

    return false;
  }

  /**
   * Determine if user is a minor based on category and year of birth
   */
  private determineIsMinor(category: LearnerCategory, yearOfBirth?: number): boolean {
    // CHILD and TEENAGER are always minors
    if (category === 'CHILD' || category === 'TEENAGER') {
      return true;
    }

    // For ADULT, check year of birth if provided
    if (yearOfBirth) {
      const currentYear = new Date().getFullYear();
      const age = currentYear - yearOfBirth;
      return age < 18;
    }

    return false;
  }
}
