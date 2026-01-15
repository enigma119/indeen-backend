import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AvailabilityResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  mentorId: string;

  @ApiProperty({
    description: 'Day of week (0 = Sunday, 6 = Saturday)',
    example: 1,
  })
  dayOfWeek: number;

  @ApiProperty({ example: '09:00:00' })
  startTime: string;

  @ApiProperty({ example: '17:00:00' })
  endTime: string;

  @ApiProperty({ example: true })
  isRecurring: boolean;

  @ApiPropertyOptional({ example: '2024-01-20' })
  specificDate?: string;

  @ApiProperty({ example: true })
  isAvailable: boolean;

  @ApiProperty({ example: '2024-01-01T00:00:00Z' })
  createdAt: Date;
}
