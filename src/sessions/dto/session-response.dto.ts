import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { SessionStatus } from '@prisma/client';

export class SessionMentorDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiPropertyOptional({ example: 'John' })
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  lastName?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  avatarUrl?: string;

  @ApiPropertyOptional({ example: 'Certified Quran Teacher' })
  headline?: string;
}

export class SessionMenteeDto {
  @ApiProperty({ example: '223e4567-e89b-12d3-a456-426614174001' })
  id: string;

  @ApiPropertyOptional({ example: 'Jane' })
  firstName?: string;

  @ApiPropertyOptional({ example: 'Smith' })
  lastName?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  avatarUrl?: string;

  @ApiProperty({ example: 'ADULT' })
  learnerCategory: string;

  @ApiProperty({ example: 'NO_ARABIC' })
  currentLevel: string;
}

export class SessionResponseDto {
  @ApiProperty({ example: '323e4567-e89b-12d3-a456-426614174002' })
  id: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  mentorProfileId: string;

  @ApiProperty({ example: '223e4567-e89b-12d3-a456-426614174001' })
  menteeProfileId: string;

  @ApiProperty({ example: '2024-01-20T10:00:00Z' })
  scheduledAt: Date;

  @ApiProperty({ example: '2024-01-20T11:00:00Z' })
  scheduledEndAt: Date;

  @ApiProperty({ example: 60 })
  durationMinutes: number;

  @ApiProperty({ example: 'Europe/Paris' })
  timezone: string;

  @ApiProperty({
    example: 'SCHEDULED',
    enum: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED_BY_MENTOR', 'CANCELLED_BY_MENTEE', 'NO_SHOW_MENTOR', 'NO_SHOW_MENTEE'],
  })
  status: SessionStatus;

  @ApiPropertyOptional({ example: '2024-01-19T15:00:00Z' })
  cancelledAt?: Date;

  @ApiPropertyOptional({ example: 'Personal emergency' })
  cancellationReason?: string;

  @ApiPropertyOptional({ example: 'https://daily.co/room/abc123' })
  meetingUrl?: string;

  @ApiPropertyOptional({ example: 'daily' })
  meetingProvider?: string;

  @ApiPropertyOptional({ example: 'Introduction to Tajweed' })
  lessonPlan?: string;

  @ApiPropertyOptional({ example: ['tajweed', 'pronunciation'] })
  topicsCovered?: string[];

  @ApiPropertyOptional({ example: 'Great progress today!' })
  mentorNotes?: string;

  @ApiPropertyOptional({ example: 'Looking forward to learning more' })
  menteeNotes?: string;

  @ApiPropertyOptional({ example: 'Al-Fatiha' })
  surahStudied?: string;

  @ApiPropertyOptional({ example: 1 })
  surahNumber?: number;

  @ApiPropertyOptional({ example: '1-7' })
  ayatRange?: string;

  @ApiPropertyOptional({ example: 7 })
  masteryLevel?: number;

  @ApiPropertyOptional({ example: '2024-01-20T10:02:00Z' })
  startedAt?: Date;

  @ApiPropertyOptional({ example: '2024-01-20T11:00:00Z' })
  completedAt?: Date;

  @ApiProperty({ example: '2024-01-15T10:00:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-15T10:00:00Z' })
  updatedAt: Date;

  @ApiPropertyOptional({ type: SessionMentorDto })
  mentor?: SessionMentorDto;

  @ApiPropertyOptional({ type: SessionMenteeDto })
  mentee?: SessionMenteeDto;
}

export class PaginatedSessionsResponseDto {
  @ApiProperty({ type: [SessionResponseDto] })
  data: SessionResponseDto[];

  @ApiProperty({ example: 50 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  pageSize: number;

  @ApiProperty({ example: 5 })
  totalPages: number;
}

export class SessionAvailabilityCheckDto {
  @ApiProperty({ example: true })
  isAvailable: boolean;

  @ApiPropertyOptional({ example: 'Slot is available for booking' })
  message?: string;

  @ApiPropertyOptional({
    description: 'Conflicting session ID if not available',
    example: '423e4567-e89b-12d3-a456-426614174003',
  })
  conflictingSessionId?: string;
}
