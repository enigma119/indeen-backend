import {
  IsOptional,
  IsArray,
  IsNumber,
  IsString,
  IsBoolean,
  Min,
  Max,
  IsEnum,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { LearningLevel } from '@prisma/client';

export class FindMentorsDto {
  @ApiPropertyOptional({
    description: 'Preferred languages (ISO 639-1 codes)',
    example: ['ar', 'fr'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (typeof value === 'string' ? [value] : value))
  preferredLanguages?: string[];

  @ApiPropertyOptional({
    description: 'Desired specialties',
    example: ['tajweed', 'hifz'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (typeof value === 'string' ? [value] : value))
  specialties?: string[];

  @ApiPropertyOptional({
    description: 'Maximum budget per session',
    example: 30,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  budgetPerSession?: number;

  @ApiPropertyOptional({
    description: 'Current learning level',
    enum: LearningLevel,
    example: 'NO_ARABIC',
  })
  @IsOptional()
  @IsEnum(LearningLevel)
  currentLevel?: LearningLevel;

  @ApiPropertyOptional({
    description: 'Require free trial',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  requireFreeTrial?: boolean;

  @ApiPropertyOptional({
    description: 'Only show mentors offering free sessions',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  freeSessionsOnly?: boolean;

  @ApiPropertyOptional({
    description: 'Minimum mentor rating',
    example: 4.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  @Type(() => Number)
  minRating?: number;

  @ApiPropertyOptional({
    description: 'Preferred timezone (for compatibility check)',
    example: 'Europe/Paris',
  })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({
    description: 'Country code for same-country preference',
    example: 'FR',
  })
  @IsOptional()
  @IsString()
  countryCode?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of results',
    example: 10,
    default: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number = 10;
}
