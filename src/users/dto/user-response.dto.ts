import { Exclude, Expose, Type } from 'class-transformer';
import { UserRole } from '@prisma/client';

export class MentorProfileResponseDto {
  @Expose()
  id: string;

  @Expose()
  bio: string;

  @Expose()
  headline: string | null;

  @Expose()
  yearsExperience: number;

  @Expose()
  languages: string[];

  @Expose()
  specialties: string[];

  @Expose()
  hourlyRate: number | null;

  @Expose()
  currency: string;

  @Expose()
  averageRating: number;

  @Expose()
  totalReviews: number;

  @Expose()
  isActive: boolean;

  @Expose()
  verificationStatus: string;
}

export class MenteeProfileResponseDto {
  @Expose()
  id: string;

  @Expose()
  learnerCategory: string;

  @Expose()
  currentLevel: string;

  @Expose()
  learningGoals: string[];

  @Expose()
  totalSessions: number;

  @Expose()
  completedSessions: number;
}

export class UserResponseDto {
  @Expose()
  id: string;

  @Expose()
  email: string;

  @Expose()
  role: UserRole;

  @Expose()
  firstName: string | null;

  @Expose()
  lastName: string | null;

  @Expose()
  avatarUrl: string | null;

  @Expose()
  countryCode: string;

  @Expose()
  timezone: string;

  @Expose()
  locale: string;

  @Expose()
  emailVerified: boolean;

  @Expose()
  isActive: boolean;

  @Expose()
  createdAt: Date;

  @Expose()
  @Type(() => MentorProfileResponseDto)
  mentorProfile?: MentorProfileResponseDto;

  @Expose()
  @Type(() => MenteeProfileResponseDto)
  menteeProfile?: MenteeProfileResponseDto;

  // Exclude sensitive fields
  @Exclude()
  phone?: string;

  @Exclude()
  twoFactorEnabled?: boolean;

  @Exclude()
  isBanned?: boolean;

  @Exclude()
  banReason?: string;

  @Exclude()
  metadata?: unknown;

  @Exclude()
  lastLoginAt?: Date;

  @Exclude()
  lastActivityAt?: Date;

  @Exclude()
  notificationEmail?: boolean;

  @Exclude()
  notificationSms?: boolean;
}

export class PublicUserResponseDto {
  @Expose()
  id: string;

  @Expose()
  firstName: string | null;

  @Expose()
  lastName: string | null;

  @Expose()
  avatarUrl: string | null;

  @Expose()
  role: UserRole;

  @Expose()
  countryCode: string;

  @Expose()
  @Type(() => MentorProfileResponseDto)
  mentorProfile?: MentorProfileResponseDto;
}
