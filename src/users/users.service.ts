import {
  Injectable,
  NotFoundException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto';
import type { User, UserRole } from '@prisma/client';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        mentorProfile: true,
        menteeProfile: true,
      },
    });
  }

  /**
   * Find user by ID or throw NotFoundException
   */
  async findByIdOrFail(id: string): Promise<User> {
    const user = await this.findById(id);

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        mentorProfile: true,
        menteeProfile: true,
      },
    });
  }

  /**
   * Update user profile
   */
  async updateProfile(id: string, updateDto: UpdateUserDto): Promise<User> {
    const user = await this.findByIdOrFail(id);

    if (!user.isActive) {
      throw new ForbiddenException('Cannot update inactive user profile');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        firstName: updateDto.firstName ?? user.firstName,
        lastName: updateDto.lastName ?? user.lastName,
        avatarUrl: updateDto.avatarUrl ?? user.avatarUrl,
        phone: updateDto.phone ?? user.phone,
        gender: updateDto.gender ?? user.gender,
        countryCode: updateDto.countryCode ?? user.countryCode,
        timezone: updateDto.timezone ?? user.timezone,
        locale: updateDto.locale ?? user.locale,
        preferredCurrency: updateDto.preferredCurrency ?? user.preferredCurrency,
        notificationEmail: updateDto.notificationEmail ?? user.notificationEmail,
        notificationSms: updateDto.notificationSms ?? user.notificationSms,
        updatedAt: new Date(),
      },
      include: {
        mentorProfile: true,
        menteeProfile: true,
      },
    });

    this.logger.log(`Updated user profile: ${id}`);
    return updatedUser;
  }

  /**
   * Get user role
   */
  async getUserRole(id: string): Promise<UserRole> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { role: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user.role;
  }

  /**
   * Check if user is active
   */
  async isUserActive(id: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { isActive: true, isBanned: true },
    });

    if (!user) {
      return false;
    }

    return user.isActive && !user.isBanned;
  }

  /**
   * Soft delete user (set isActive = false)
   */
  async softDelete(id: string): Promise<User> {
    const user = await this.findByIdOrFail(id);

    if (!user.isActive) {
      throw new ForbiddenException('User is already deactivated');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
      include: {
        mentorProfile: true,
        menteeProfile: true,
      },
    });

    this.logger.log(`Soft deleted user: ${id}`);
    return updatedUser;
  }

  /**
   * Get public user data (limited fields)
   */
  async getPublicProfile(id: string): Promise<Partial<User>> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        role: true,
        countryCode: true,
        createdAt: true,
        mentorProfile: {
          select: {
            id: true,
            bio: true,
            headline: true,
            yearsExperience: true,
            languages: true,
            specialties: true,
            hourlyRate: true,
            currency: true,
            averageRating: true,
            totalReviews: true,
            isActive: true,
            verificationStatus: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  /**
   * Get all users (admin only)
   */
  async findAll(options?: {
    role?: UserRole;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ users: User[]; total: number }> {
    const { role, isActive, page = 1, limit = 20 } = options || {};

    const where = {
      ...(role && { role }),
      ...(isActive !== undefined && { isActive }),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          mentorProfile: true,
          menteeProfile: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, total };
  }

  /**
   * Reactivate user
   */
  async reactivate(id: string): Promise<User> {
    const user = await this.findByIdOrFail(id);

    if (user.isActive) {
      throw new ForbiddenException('User is already active');
    }

    if (user.isBanned) {
      throw new ForbiddenException('Cannot reactivate banned user');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        isActive: true,
        updatedAt: new Date(),
      },
      include: {
        mentorProfile: true,
        menteeProfile: true,
      },
    });

    this.logger.log(`Reactivated user: ${id}`);
    return updatedUser;
  }
}
