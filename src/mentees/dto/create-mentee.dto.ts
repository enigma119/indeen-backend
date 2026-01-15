import {
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
  IsNumber,
  IsEnum,
  Min,
  Max,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { LearnerCategory, LearningLevel, LearningContext, LearningPace } from '@prisma/client';

export class CreateMenteeDto {
  @ApiProperty({
    description: 'Learner category',
    enum: LearnerCategory,
    example: 'ADULT',
  })
  @IsEnum(LearnerCategory)
  learnerCategory: LearnerCategory;

  @ApiPropertyOptional({
    description: 'Year of birth',
    example: 1990,
  })
  @IsOptional()
  @IsNumber()
  @Min(1920)
  @Max(new Date().getFullYear())
  @Type(() => Number)
  yearOfBirth?: number;

  @ApiPropertyOptional({
    description: 'Parent user ID (required for minors)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  parentUserId?: string;

  @ApiPropertyOptional({
    description: 'Current learning level',
    enum: LearningLevel,
    example: 'NO_ARABIC',
  })
  @IsOptional()
  @IsEnum(LearningLevel)
  currentLevel?: LearningLevel;

  @ApiPropertyOptional({
    description: 'Learning context',
    enum: LearningContext,
    example: 'PERSONAL_GROWTH',
  })
  @IsOptional()
  @IsEnum(LearningContext)
  learningContext?: LearningContext;

  @ApiPropertyOptional({
    description: 'Preferred languages for learning (ISO 639-1 codes)',
    example: ['fr', 'ar'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredLanguages?: string[];

  @ApiPropertyOptional({
    description: 'Learning goals',
    example: ['Learn to read Quran', 'Memorize Juz Amma'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  learningGoals?: string[];

  @ApiPropertyOptional({
    description: 'Learning pace preference',
    enum: LearningPace,
    example: 'NORMAL',
  })
  @IsOptional()
  @IsEnum(LearningPace)
  learningPace?: LearningPace;

  @ApiPropertyOptional({
    description: 'Preferred session duration in minutes',
    example: 60,
  })
  @IsOptional()
  @IsNumber()
  @Min(15)
  @Max(180)
  @Type(() => Number)
  preferredSessionDuration?: number;

  @ApiPropertyOptional({
    description: 'Whether the mentee has special needs',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  hasSpecialNeeds?: boolean;

  @ApiPropertyOptional({
    description: 'Description of special needs',
    example: 'Requires visual aids due to dyslexia',
  })
  @IsOptional()
  @IsString()
  specialNeedsDescription?: string;
}
