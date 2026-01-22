import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentStatus } from '@prisma/client';

export class PaymentResponseDto {
  @ApiProperty({
    description: 'Payment ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Session ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  sessionId: string;

  @ApiProperty({
    description: 'Amount paid by mentee',
    example: 50.0,
  })
  amountPaid: number;

  @ApiProperty({
    description: 'Currency of payment',
    example: 'EUR',
  })
  currencyPaid: string;

  @ApiProperty({
    description: 'Amount to be transferred to mentor',
    example: 40.75,
  })
  amountToMentor: number;

  @ApiProperty({
    description: 'Currency for mentor payout',
    example: 'EUR',
  })
  currencyToMentor: string;

  @ApiProperty({
    description: 'Platform fee amount',
    example: 7.5,
  })
  platformFee: number;

  @ApiProperty({
    description: 'Platform fee percentage',
    example: 15.0,
  })
  platformFeePercentage: number;

  @ApiProperty({
    description: 'Payment processor (Stripe) fee',
    example: 1.75,
  })
  paymentProcessorFee: number;

  @ApiProperty({
    description: 'Payment status',
    enum: PaymentStatus,
    example: 'COMPLETED',
  })
  status: PaymentStatus;

  @ApiPropertyOptional({
    description: 'Payment method used',
    example: 'card',
  })
  paymentMethod?: string;

  @ApiPropertyOptional({
    description: 'Stripe PaymentIntent ID',
    example: 'pi_1234567890abcdef',
  })
  stripePaymentIntentId?: string;

  @ApiProperty({
    description: 'Amount refunded',
    example: 0,
  })
  refundedAmount: number;

  @ApiPropertyOptional({
    description: 'Invoice number',
    example: 'INV-2024-001234',
  })
  invoiceNumber?: string;

  @ApiPropertyOptional({
    description: 'Date when payment was completed',
  })
  paidAt?: Date;

  @ApiProperty({
    description: 'Date when payment record was created',
  })
  createdAt: Date;
}

export class PaymentIntentResponseDto {
  @ApiProperty({
    description: 'Stripe PaymentIntent ID',
    example: 'pi_1234567890abcdef',
  })
  paymentIntentId: string;

  @ApiProperty({
    description: 'Client secret for frontend to complete payment',
    example: 'pi_1234567890abcdef_secret_xyz',
  })
  clientSecret: string;

  @ApiProperty({
    description: 'Amount in currency units',
    example: 50.0,
  })
  amount: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'EUR',
  })
  currency: string;

  @ApiProperty({
    description: 'Payment record ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  paymentId: string;
}

export class RefundResponseDto {
  @ApiProperty({
    description: 'Whether refund was successful',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Stripe refund ID',
    example: 're_1234567890abcdef',
  })
  refundId: string;

  @ApiProperty({
    description: 'Amount refunded',
    example: 50.0,
  })
  amountRefunded: number;

  @ApiProperty({
    description: 'New payment status',
    enum: PaymentStatus,
    example: 'REFUNDED',
  })
  status: PaymentStatus;

  @ApiPropertyOptional({
    description: 'Message describing the refund',
    example: 'Full refund processed',
  })
  message?: string;
}

export class PaymentHistoryResponseDto {
  @ApiProperty({
    description: 'List of payments',
    type: [PaymentResponseDto],
  })
  data: PaymentResponseDto[];

  @ApiProperty({
    description: 'Total number of payments',
    example: 25,
  })
  total: number;

  @ApiProperty({
    description: 'Current page',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Page size',
    example: 10,
  })
  pageSize: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 3,
  })
  totalPages: number;
}
