import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ConfirmPaymentDto {
  @ApiProperty({
    description: 'Stripe PaymentIntent ID',
    example: 'pi_1234567890abcdef',
  })
  @IsString()
  paymentIntentId: string;
}
