import {
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
  IsNumber,
  IsEnum,
  Min,
  Max,
  MinLength,
  MaxLength,
  IsUrl,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { LearningLevel } from '@prisma/client';

export class CreateMentorDto {
  @ApiProperty({
    description: 'Biography of the mentor',
    example: 'Experienced Quran teacher with 10 years of experience...',
    minLength: 50,
  })
  @IsString()
  @MinLength(50, { message: 'Bio must be at least 50 characters' })
  bio: string;

  @ApiPropertyOptional({
    description: 'Short headline for the profile',
    example: 'Certified Quran Teacher | Tajweed Specialist',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  headline?: string;

  @ApiPropertyOptional({
    description: 'URL to video introduction',
    example: 'https://youtube.com/watch?v=...',
  })
  @IsOptional()
  @IsUrl()
  videoIntroUrl?: string;

  @ApiPropertyOptional({
    description: 'Years of teaching experience',
    example: 5,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  yearsExperience?: number;

  @ApiPropertyOptional({
    description: 'List of certifications',
    example: [{ name: 'Ijazah in Hafs', year: 2015, institution: 'Al-Azhar' }],
  })
  @IsOptional()
  @IsArray()
  certifications?: object[];

  @ApiPropertyOptional({
    description: 'Educational background',
    example: "Bachelor's in Islamic Studies from Al-Azhar University",
  })
  @IsOptional()
  @IsString()
  education?: string;

  @ApiProperty({
    description: 'Languages spoken (ISO 639-1 codes)',
    example: ['ar', 'fr', 'en'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  languages: string[];

  @ApiPropertyOptional({
    description: 'Native language (ISO 639-1 code)',
    example: 'ar',
  })
  @IsOptional()
  @IsString()
  nativeLanguage?: string;

  @ApiProperty({
    description: 'Teaching specialties',
    example: ['tajweed', 'hifz', 'arabic'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  specialties: string[];

  @ApiPropertyOptional({
    description: 'Whether the mentor teaches children',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  teachesChildren?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the mentor teaches teenagers',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  teachesTeenagers?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the mentor teaches adults',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  teachesAdults?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the mentor is beginner-friendly',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  beginnerFriendly?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the mentor is patient with slow learners',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  patientWithSlowLearners?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the mentor has experience with new Muslims',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  experiencedWithNewMuslims?: boolean;

  @ApiPropertyOptional({
    description: 'Learning levels accepted by the mentor',
    example: ['NO_ARABIC', 'ARABIC_BEGINNER', 'CAN_READ_SLOWLY'],
    enum: LearningLevel,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(LearningLevel, { each: true })
  acceptedLevels?: LearningLevel[];

  @ApiPropertyOptional({
    description: 'Whether the mentor provides special needs support',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  specialNeedsSupport?: boolean;

  @ApiPropertyOptional({
    description: 'Hourly rate (required unless freeSessionsOnly is true)',
    example: 25.0,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  hourlyRate?: number;

  @ApiPropertyOptional({
    description: 'Currency for hourly rate',
    example: 'EUR',
  })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({
    description: 'Whether free trial is available',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  freeTrialAvailable?: boolean;

  @ApiPropertyOptional({
    description: 'Duration of free trial in minutes',
    example: 30,
  })
  @IsOptional()
  @IsNumber()
  @Min(15)
  @Max(60)
  @Type(() => Number)
  freeTrialDuration?: number;

  @ApiPropertyOptional({
    description: 'Whether mentor only offers free sessions',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  freeSessionsOnly?: boolean;

  @ApiPropertyOptional({
    description: 'Maximum students per week',
    example: 20,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  maxStudentsPerWeek?: number;

  @ApiPropertyOptional({
    description: 'Minimum session duration in minutes',
    example: 30,
  })
  @IsOptional()
  @IsNumber()
  @Min(15)
  @Max(120)
  @Type(() => Number)
  minSessionDuration?: number;

  @ApiPropertyOptional({
    description: 'Maximum session duration in minutes',
    example: 120,
  })
  @IsOptional()
  @IsNumber()
  @Min(30)
  @Max(180)
  @Type(() => Number)
  maxSessionDuration?: number;
}
