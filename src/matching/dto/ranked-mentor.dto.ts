import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CompatibilityReasonDto } from './compatibility-score.dto';

export class RankedMentorUserDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiPropertyOptional({ example: 'John' })
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  lastName?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  avatarUrl?: string;

  @ApiProperty({ example: 'FR' })
  countryCode: string;
}

export class RankedMentorDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'Experienced Quran teacher with 10 years...' })
  bio: string;

  @ApiPropertyOptional({ example: 'Certified Quran Teacher | Tajweed Specialist' })
  headline?: string;

  @ApiProperty({ example: ['ar', 'fr', 'en'] })
  languages: string[];

  @ApiProperty({ example: ['tajweed', 'hifz'] })
  specialties: string[];

  @ApiPropertyOptional({ example: 25.0 })
  hourlyRate?: number;

  @ApiProperty({ example: 'EUR' })
  currency: string;

  @ApiProperty({ example: true })
  freeTrialAvailable: boolean;

  @ApiProperty({ example: false })
  freeSessionsOnly: boolean;

  @ApiProperty({ example: 4.85 })
  averageRating: number;

  @ApiProperty({ example: 42 })
  totalReviews: number;

  @ApiProperty({ example: 150 })
  completedSessions: number;

  @ApiProperty({ type: RankedMentorUserDto })
  user: RankedMentorUserDto;

  @ApiProperty({
    description: 'Compatibility score (0-100)',
    example: 85,
  })
  compatibilityScore: number;

  @ApiProperty({
    description: 'Compatibility level',
    example: 'HIGH',
    enum: ['EXCELLENT', 'HIGH', 'MEDIUM', 'LOW', 'POOR'],
  })
  compatibilityLevel: string;

  @ApiProperty({
    description: 'Top reasons for compatibility',
    type: [CompatibilityReasonDto],
  })
  matchReasons: CompatibilityReasonDto[];
}

export class RankedMentorsResponseDto {
  @ApiProperty({
    description: 'Mentee ID for whom the search was performed',
    example: '223e4567-e89b-12d3-a456-426614174001',
  })
  menteeId: string;

  @ApiProperty({
    description: 'Number of mentors found',
    example: 10,
  })
  total: number;

  @ApiProperty({
    description: 'Ranked list of compatible mentors',
    type: [RankedMentorDto],
  })
  mentors: RankedMentorDto[];
}
