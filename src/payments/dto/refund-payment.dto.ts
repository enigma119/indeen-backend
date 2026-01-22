import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNumber, IsString, Min, MaxLength } from 'class-validator';

export class RefundPaymentDto {
  @ApiPropertyOptional({
    description: 'Amount to refund (if partial refund). Omit for full refund.',
    example: 25.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @ApiPropertyOptional({
    description: 'Reason for the refund',
    example: 'Session cancelled by mentee more than 24h before',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
