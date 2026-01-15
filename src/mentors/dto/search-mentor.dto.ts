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

export class SearchMentorDto {
  @ApiPropertyOptional({
    description: 'Filter by languages (ISO 639-1 codes)',
    example: ['ar', 'fr'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (typeof value === 'string' ? [value] : value))
  languages?: string[];

  @ApiPropertyOptional({
    description: 'Filter by specialties',
    example: ['tajweed', 'hifz'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (typeof value === 'string' ? [value] : value))
  specialties?: string[];

  @ApiPropertyOptional({
    description: 'Minimum hourly rate',
    example: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minPrice?: number;

  @ApiPropertyOptional({
    description: 'Maximum hourly rate',
    example: 50,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxPrice?: number;

  @ApiPropertyOptional({
    description: 'Minimum rating',
    example: 4.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  @Type(() => Number)
  minRating?: number;

  @ApiPropertyOptional({
    description: 'Filter mentors who teach children',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  teachesChildren?: boolean;

  @ApiPropertyOptional({
    description: 'Filter mentors who teach teenagers',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  teachesTeenagers?: boolean;

  @ApiPropertyOptional({
    description: 'Filter mentors who teach adults',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  teachesAdults?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by accepted learning levels',
    example: ['NO_ARABIC', 'ARABIC_BEGINNER'],
    enum: LearningLevel,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(LearningLevel, { each: true })
  @Transform(({ value }) => (typeof value === 'string' ? [value] : value))
  acceptedLevels?: LearningLevel[];

  @ApiPropertyOptional({
    description: 'Filter by country code',
    example: 'FR',
  })
  @IsOptional()
  @IsString()
  countryCode?: string;

  @ApiPropertyOptional({
    description: 'Filter beginner-friendly mentors',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  beginnerFriendly?: boolean;

  @ApiPropertyOptional({
    description: 'Filter mentors offering free trials',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  freeTrialAvailable?: boolean;

  @ApiPropertyOptional({
    description: 'Filter mentors offering only free sessions',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  freeSessionsOnly?: boolean;

  @ApiPropertyOptional({
    description: 'Search query for bio/headline',
    example: 'tajweed expert',
  })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 10,
    default: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Sort field',
    example: 'averageRating',
    enum: ['averageRating', 'hourlyRate', 'createdAt', 'totalSessions'],
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'averageRating';

  @ApiPropertyOptional({
    description: 'Sort order',
    example: 'desc',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}
