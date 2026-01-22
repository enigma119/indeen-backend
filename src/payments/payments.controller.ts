import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import {
  CreatePaymentIntentDto,
  ConfirmPaymentDto,
  RefundPaymentDto,
  PaymentIntentResponseDto,
  PaymentResponseDto,
  RefundResponseDto,
  PaymentHistoryResponseDto,
} from './dto';
import { CurrentUser, Roles } from '../common/decorators';
import { User } from '@prisma/client';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create-intent')
  @Roles('MENTEE')
  @ApiOperation({
    summary: 'Create payment intent',
    description: 'Create a Stripe PaymentIntent for a session booking. Returns client_secret for frontend.',
  })
  @ApiResponse({
    status: 201,
    description: 'PaymentIntent created successfully',
    type: PaymentIntentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid session or already paid' })
  @ApiResponse({ status: 403, description: 'Not the mentee for this session' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async createPaymentIntent(
    @Body() dto: CreatePaymentIntentDto,
    @CurrentUser() user: User,
  ): Promise<PaymentIntentResponseDto> {
    return this.paymentsService.createPaymentIntent(user.id, dto);
  }

  @Post('confirm')
  @Roles('MENTEE')
  @ApiOperation({
    summary: 'Confirm payment',
    description: 'Manually confirm a payment (usually handled by webhook).',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment confirmed',
    type: PaymentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Payment not succeeded in Stripe' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async confirmPayment(@Body() dto: ConfirmPaymentDto): Promise<PaymentResponseDto> {
    const payment = await this.paymentsService.confirmPayment(dto.paymentIntentId);
    return {
      id: payment.id,
      sessionId: payment.sessionId,
      amountPaid: Number(payment.amountPaid),
      currencyPaid: payment.currencyPaid,
      amountToMentor: Number(payment.amountToMentor),
      currencyToMentor: payment.currencyToMentor,
      platformFee: Number(payment.platformFee),
      platformFeePercentage: Number(payment.platformFeePercentage),
      paymentProcessorFee: Number(payment.paymentProcessorFee),
      status: payment.status,
      paymentMethod: payment.paymentMethod ?? undefined,
      stripePaymentIntentId: payment.stripePaymentIntentId ?? undefined,
      refundedAmount: Number(payment.refundedAmount),
      invoiceNumber: payment.invoiceNumber ?? undefined,
      paidAt: payment.paidAt ?? undefined,
      createdAt: payment.createdAt,
    };
  }

  @Get('history')
  @ApiOperation({
    summary: 'Get payment history',
    description: 'Get paginated payment history for the current user.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({
    status: 200,
    description: 'Payment history retrieved',
    type: PaymentHistoryResponseDto,
  })
  async getPaymentHistory(
    @CurrentUser() user: User,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<PaymentHistoryResponseDto> {
    return this.paymentsService.getPaymentHistory(user.id, user.role, page, limit);
  }

  @Get(':sessionId')
  @ApiOperation({
    summary: 'Get payment status',
    description: 'Get payment status for a specific session.',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment status retrieved',
    type: PaymentResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Not authorized to view this payment' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async getPaymentStatus(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @CurrentUser() user: User,
  ): Promise<PaymentResponseDto> {
    return this.paymentsService.getPaymentStatus(sessionId, user.id);
  }

  @Post(':sessionId/refund')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Process refund',
    description: 'Process a full or partial refund for a session payment. Admin only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Refund processed',
    type: RefundResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Payment not completed or already refunded' })
  @ApiResponse({ status: 403, description: 'Only admins can process refunds' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async processRefund(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: RefundPaymentDto,
    @CurrentUser() user: User,
  ): Promise<RefundResponseDto> {
    return this.paymentsService.processRefund(sessionId, dto, user.id);
  }
}
