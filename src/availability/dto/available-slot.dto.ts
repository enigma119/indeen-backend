import { ApiProperty } from '@nestjs/swagger';

export class AvailableSlotDto {
  @ApiProperty({
    description: 'Date of the slot',
    example: '2024-01-20',
  })
  date: string;

  @ApiProperty({
    description: 'Start time of the slot',
    example: '09:00',
  })
  startTime: string;

  @ApiProperty({
    description: 'End time of the slot',
    example: '10:00',
  })
  endTime: string;

  @ApiProperty({
    description: 'Duration in minutes',
    example: 60,
  })
  durationMinutes: number;

  @ApiProperty({
    description: 'Whether this slot is available',
    example: true,
  })
  isAvailable: boolean;
}

export class AvailableSlotsResponseDto {
  @ApiProperty({
    description: 'Mentor ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  mentorId: string;

  @ApiProperty({
    description: 'Requested date',
    example: '2024-01-20',
  })
  date: string;

  @ApiProperty({
    description: 'Requested duration in minutes',
    example: 60,
  })
  requestedDuration: number;

  @ApiProperty({
    description: 'Available slots',
    type: [AvailableSlotDto],
  })
  slots: AvailableSlotDto[];
}
