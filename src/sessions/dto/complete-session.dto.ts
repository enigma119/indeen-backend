import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CompleteSessionDto {
  @ApiPropertyOptional({
    description: 'Mentor notes about the session',
    example: 'Student showed great progress in tajweed. Covered makharij of heavy letters.',
  })
  @IsOptional()
  @IsString()
  mentorNotes?: string;

  @ApiPropertyOptional({
    description: 'Topics actually covered during the session',
    example: ['tajweed-makharij', 'heavy-letters', 'qalqala'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  topicsCovered?: string[];

  @ApiPropertyOptional({
    description: 'Surah studied during the session',
    example: 'Al-Fatiha',
  })
  @IsOptional()
  @IsString()
  surahStudied?: string;

  @ApiPropertyOptional({
    description: 'Surah number',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(114)
  @Type(() => Number)
  surahNumber?: number;

  @ApiPropertyOptional({
    description: 'Ayat range covered (e.g., "1-7")',
    example: '1-7',
  })
  @IsOptional()
  @IsString()
  ayatRange?: string;

  @ApiPropertyOptional({
    description: 'Mastery level assessment (1-10)',
    example: 7,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  masteryLevel?: number;

  @ApiPropertyOptional({
    description: 'Homework or practice recommendations',
    example: 'Practice Surah Al-Fatiha daily with focus on makharij',
  })
  @IsOptional()
  @IsString()
  homework?: string;
}
