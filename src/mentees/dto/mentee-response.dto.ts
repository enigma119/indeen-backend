import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { LearnerCategory, LearningLevel, LearningContext, LearningPace } from '@prisma/client';

export class MenteeUserDto {
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
}

export class MenteeProgressDto {
  @ApiProperty({ example: 50 })
  totalSessions: number;

  @ApiProperty({ example: 48 })
  completedSessions: number;

  @ApiProperty({ example: 36.5 })
  totalHoursLearned: number;

  @ApiProperty({
    example: 'ARABIC_BEGINNER',
    enum: ['NO_ARABIC', 'ARABIC_BEGINNER', 'CAN_READ_SLOWLY', 'CAN_READ_FLUENTLY', 'TAJWEED_INTERMEDIATE', 'TAJWEED_ADVANCED', 'HAFIZ_PARTIAL', 'HAFIZ_COMPLETE'],
  })
  currentLevel: string;

  @ApiProperty({ example: 5 })
  surahsStudied: number;

  @ApiProperty({ example: 3 })
  surahsMastered: number;
}

export class ParentalConsentDto {
  @ApiProperty({ example: true })
  isMinor: boolean;

  @ApiProperty({ example: true })
  consentRequired: boolean;

  @ApiProperty({ example: true })
  consentGiven: boolean;

  @ApiPropertyOptional({ example: '2024-01-15T10:00:00Z' })
  consentDate?: Date;

  @ApiPropertyOptional({ type: MenteeUserDto })
  parent?: MenteeUserDto;
}

export class MenteeResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  userId: string;

  @ApiProperty({ example: 'ADULT', enum: ['CHILD', 'TEENAGER', 'ADULT'] })
  learnerCategory: LearnerCategory;

  @ApiProperty({ example: false })
  isMinor: boolean;

  @ApiPropertyOptional({ example: 1990 })
  yearOfBirth?: number;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  parentUserId?: string;

  @ApiProperty({ example: false })
  parentalConsentGiven: boolean;

  @ApiPropertyOptional({ example: '2024-01-15T10:00:00Z' })
  parentalConsentDate?: Date;

  @ApiProperty({ example: 'NO_ARABIC', enum: ['NO_ARABIC', 'ARABIC_BEGINNER', 'CAN_READ_SLOWLY', 'CAN_READ_FLUENTLY', 'TAJWEED_INTERMEDIATE', 'TAJWEED_ADVANCED', 'HAFIZ_PARTIAL', 'HAFIZ_COMPLETE'] })
  currentLevel: LearningLevel;

  @ApiPropertyOptional({ example: 'PERSONAL_GROWTH', enum: ['NEW_MUSLIM', 'RETURNING_TO_FAITH', 'IMPROVING_SKILLS', 'PARENTAL_EDUCATION', 'PERSONAL_GROWTH', 'ACADEMIC', 'OTHER'] })
  learningContext?: LearningContext;

  @ApiProperty({ example: ['fr', 'ar'] })
  preferredLanguages: string[];

  @ApiProperty({ example: ['Learn to read Quran', 'Memorize Juz Amma'] })
  learningGoals: string[];

  @ApiProperty({ example: 'NORMAL', enum: ['VERY_SLOW', 'SLOW', 'NORMAL', 'FAST', 'INTENSIVE'] })
  learningPace: LearningPace;

  @ApiProperty({ example: 60 })
  preferredSessionDuration: number;

  @ApiProperty({ example: false })
  hasSpecialNeeds: boolean;

  @ApiPropertyOptional({ example: 'Requires visual aids' })
  specialNeedsDescription?: string;

  @ApiProperty({ example: 50 })
  totalSessions: number;

  @ApiProperty({ example: 48 })
  completedSessions: number;

  @ApiProperty({ example: 36.5 })
  totalHoursLearned: number;

  @ApiProperty({ example: '2024-01-01T00:00:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-15T10:00:00Z' })
  updatedAt: Date;

  @ApiPropertyOptional({ type: MenteeUserDto })
  user?: MenteeUserDto;

  @ApiPropertyOptional({ type: MenteeUserDto })
  parent?: MenteeUserDto;
}
