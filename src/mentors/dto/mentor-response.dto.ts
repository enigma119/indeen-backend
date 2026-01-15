import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { VerificationStatus, LearningLevel } from '@prisma/client';

export class MentorUserDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'john.doe@example.com' })
  email: string;

  @ApiPropertyOptional({ example: 'John' })
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  lastName?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  avatarUrl?: string;

  @ApiProperty({ example: 'FR' })
  countryCode: string;
}

export class MentorResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  userId: string;

  @ApiProperty({ example: 'Experienced Quran teacher with 10 years...' })
  bio: string;

  @ApiPropertyOptional({ example: 'Certified Quran Teacher | Tajweed Specialist' })
  headline?: string;

  @ApiPropertyOptional({ example: 'https://youtube.com/watch?v=...' })
  videoIntroUrl?: string;

  @ApiProperty({ example: 5 })
  yearsExperience: number;

  @ApiProperty({ example: [{ name: 'Ijazah in Hafs', year: 2015 }] })
  certifications: object[];

  @ApiPropertyOptional({ example: "Bachelor's in Islamic Studies" })
  education?: string;

  @ApiProperty({ example: ['ar', 'fr', 'en'] })
  languages: string[];

  @ApiPropertyOptional({ example: 'ar' })
  nativeLanguage?: string;

  @ApiProperty({ example: ['tajweed', 'hifz', 'arabic'] })
  specialties: string[];

  @ApiProperty({ example: true })
  teachesChildren: boolean;

  @ApiProperty({ example: true })
  teachesTeenagers: boolean;

  @ApiProperty({ example: true })
  teachesAdults: boolean;

  @ApiProperty({ example: true })
  beginnerFriendly: boolean;

  @ApiProperty({ example: true })
  patientWithSlowLearners: boolean;

  @ApiProperty({ example: false })
  experiencedWithNewMuslims: boolean;

  @ApiProperty({ example: ['NO_ARABIC', 'ARABIC_BEGINNER'] })
  acceptedLevels: LearningLevel[];

  @ApiProperty({ example: false })
  specialNeedsSupport: boolean;

  @ApiPropertyOptional({ example: 25.0 })
  hourlyRate?: number;

  @ApiProperty({ example: 'EUR' })
  currency: string;

  @ApiProperty({ example: true })
  freeTrialAvailable: boolean;

  @ApiProperty({ example: 30 })
  freeTrialDuration: number;

  @ApiProperty({ example: false })
  freeSessionsOnly: boolean;

  @ApiProperty({ example: 20 })
  maxStudentsPerWeek: number;

  @ApiProperty({ example: 30 })
  minSessionDuration: number;

  @ApiProperty({ example: 120 })
  maxSessionDuration: number;

  @ApiProperty({ example: 'APPROVED', enum: ['PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED'] })
  verificationStatus: VerificationStatus;

  @ApiPropertyOptional({ example: '2024-01-15T10:00:00Z' })
  verifiedAt?: Date;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: false })
  isFeatured: boolean;

  @ApiProperty({ example: true })
  isAcceptingStudents: boolean;

  @ApiProperty({ example: 150 })
  totalSessions: number;

  @ApiProperty({ example: 145 })
  completedSessions: number;

  @ApiProperty({ example: 4.85 })
  averageRating: number;

  @ApiProperty({ example: 42 })
  totalReviews: number;

  @ApiPropertyOptional({ example: 'john-doe-quran-teacher' })
  profileSlug?: string;

  @ApiProperty({ example: '2024-01-01T00:00:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-15T10:00:00Z' })
  updatedAt: Date;

  @ApiPropertyOptional({ type: MentorUserDto })
  user?: MentorUserDto;
}

export class MentorStatsDto {
  @ApiProperty({ example: 150 })
  totalSessions: number;

  @ApiProperty({ example: 145 })
  completedSessions: number;

  @ApiProperty({ example: 4.85 })
  averageRating: number;

  @ApiProperty({ example: 42 })
  totalReviews: number;

  @ApiProperty({ example: 96.67 })
  completionRate: number;

  @ApiProperty({ example: 25 })
  totalStudents: number;
}

export class PaginatedMentorResponseDto {
  @ApiProperty({ type: [MentorResponseDto] })
  data: MentorResponseDto[];

  @ApiProperty({ example: 100 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  pageSize: number;

  @ApiProperty({ example: 10 })
  totalPages: number;
}
