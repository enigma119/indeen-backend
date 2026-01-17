import { IsString, IsOptional, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CancelSessionDto {
  @ApiProperty({
    description: 'Reason for cancellation (required if < 24h before session)',
    example: 'Unexpected personal emergency',
    minLength: 10,
  })
  @IsString()
  @MinLength(10, { message: 'Cancellation reason must be at least 10 characters' })
  reason: string;
}

export class CancellationResultDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'CANCELLED_BY_MENTEE' })
  status: string;

  @ApiProperty({
    description: 'Refund percentage (0, 50, or 100)',
    example: 100,
  })
  refundPercentage: number;

  @ApiPropertyOptional({
    description: 'Refund amount if applicable',
    example: 25.0,
  })
  refundAmount?: number;

  @ApiProperty({ example: 'Full refund issued (cancelled > 24h before session)' })
  message: string;
}
