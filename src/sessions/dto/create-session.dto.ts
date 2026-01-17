import {
  IsUUID,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateSessionDto {
  @ApiProperty({
    description: 'Mentor profile ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  mentorProfileId: string;

  @ApiProperty({
    description: 'Scheduled date and time (ISO 8601)',
    example: '2024-01-20T10:00:00Z',
  })
  @IsDateString()
  scheduledAt: string;

  @ApiProperty({
    description: 'Session duration in minutes',
    example: 60,
    minimum: 15,
    maximum: 180,
  })
  @IsNumber()
  @Min(15)
  @Max(180)
  @Type(() => Number)
  durationMinutes: number;

  @ApiPropertyOptional({
    description: 'Timezone for the session',
    example: 'Europe/Paris',
  })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({
    description: 'Lesson plan or description',
    example: 'Introduction to Tajweed rules',
  })
  @IsOptional()
  @IsString()
  lessonPlan?: string;

  @ApiPropertyOptional({
    description: 'Topics to cover',
    example: ['tajweed-basics', 'letter-pronunciation'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  topicsToCover?: string[];

  @ApiPropertyOptional({
    description: 'Notes from mentee about their goals for this session',
    example: 'Would like to focus on makharij al-huruf',
  })
  @IsOptional()
  @IsString()
  menteeNotes?: string;
}
