import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsString } from 'class-validator';

export class CreatePaymentIntentDto {
  @ApiProperty({
    description: 'Session ID to create payment for',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  sessionId: string;

  @ApiPropertyOptional({
    description: 'Idempotency key to prevent duplicate payments',
    example: 'session_123e4567_payment_1',
  })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
