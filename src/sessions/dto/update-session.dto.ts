import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsArray,
  Min,
  Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateSessionDto {
  @ApiPropertyOptional({
    description: 'Reschedule to new date/time (ISO 8601)',
    example: '2024-01-20T14:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({
    description: 'Updated duration in minutes',
    example: 90,
  })
  @IsOptional()
  @IsNumber()
  @Min(15)
  @Max(180)
  @Type(() => Number)
  durationMinutes?: number;

  @ApiPropertyOptional({
    description: 'Updated lesson plan',
    example: 'Updated: Focus on Surah Al-Fatiha',
  })
  @IsOptional()
  @IsString()
  lessonPlan?: string;

  @ApiPropertyOptional({
    description: 'Mentee notes',
    example: 'Please review last session topics',
  })
  @IsOptional()
  @IsString()
  menteeNotes?: string;

  @ApiPropertyOptional({
    description: 'Mentor notes (before session)',
    example: 'Prepared materials for tajweed lesson',
  })
  @IsOptional()
  @IsString()
  mentorNotes?: string;

  @ApiPropertyOptional({
    description: 'Topics to cover',
    example: ['tajweed', 'pronunciation'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  topicsToCover?: string[];
}
