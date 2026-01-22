import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from './stripe.service';
import {
  CreatePaymentIntentDto,
  PaymentIntentResponseDto,
  RefundPaymentDto,
  RefundResponseDto,
  PaymentResponseDto,
  PaymentHistoryResponseDto,
} from './dto';
import type { Payment, PaymentStatus, Session } from '@prisma/client';

const PLATFORM_FEE_PERCENTAGE = 15;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
  ) {}

  /**
   * Create a PaymentIntent for a session booking
   */
  async createPaymentIntent(
    menteeUserId: string,
    dto: CreatePaymentIntentDto,
  ): Promise<PaymentIntentResponseDto> {
    // 1. Get the session with mentor info
    const session = await this.prisma.session.findUnique({
      where: { id: dto.sessionId },
      include: {
        mentorProfile: {
          include: { user: true },
        },
        menteeProfile: {
          include: { user: true },
        },
        payment: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    // 2. Verify mentee owns the session
    if (session.menteeProfile.userId !== menteeUserId) {
      throw new ForbiddenException('You are not the mentee for this session');
    }

    // 3. Check if payment already exists
    if (session.payment) {
      if (session.payment.status === 'COMPLETED') {
        throw new BadRequestException('Session is already paid');
      }
      // Return existing pending PaymentIntent
      if (session.payment.stripePaymentIntentId) {
        const existingIntent = await this.stripeService.getPaymentIntent(
          session.payment.stripePaymentIntentId,
        );
        return {
          paymentIntentId: existingIntent.id,
          clientSecret: existingIntent.client_secret!,
          amount: Number(session.payment.amountPaid),
          currency: session.payment.currencyPaid,
          paymentId: session.payment.id,
        };
      }
    }

    // 4. Calculate amount based on session duration and mentor rate
    const mentor = session.mentorProfile;
    if (!mentor.hourlyRate && !mentor.freeSessionsOnly) {
      throw new BadRequestException('Mentor has no hourly rate set');
    }

    // Free session handling
    if (mentor.freeSessionsOnly) {
      // Create a payment record with zero amount
      const payment = await this.prisma.payment.create({
        data: {
          sessionId: session.id,
          payerUserId: menteeUserId,
          payeeMentorId: mentor.id,
          amountPaid: 0,
          currencyPaid: mentor.currency,
          amountToMentor: 0,
          currencyToMentor: mentor.currency,
          platformFee: 0,
          platformFeePercentage: 0,
          paymentProcessorFee: 0,
          status: 'COMPLETED',
          paidAt: new Date(),
        },
      });

      return {
        paymentIntentId: 'free_session',
        clientSecret: '',
        amount: 0,
        currency: mentor.currency,
        paymentId: payment.id,
      };
    }

    // Calculate pro-rated amount based on session duration
    const hourlyRate = Number(mentor.hourlyRate);
    const durationHours = session.durationMinutes / 60;
    const amount = Number((hourlyRate * durationHours).toFixed(2));

    // 5. Calculate fees
    const fees = this.stripeService.calculateMentorAmount(amount, PLATFORM_FEE_PERCENTAGE);

    // 6. Create Stripe PaymentIntent
    const paymentIntent = await this.stripeService.createPaymentIntent({
      amount,
      currency: mentor.currency,
      metadata: {
        sessionId: session.id,
        mentorId: mentor.id,
        menteeId: session.menteeProfile.id,
        mentorUserId: mentor.userId,
        menteeUserId: session.menteeProfile.userId,
      },
      idempotencyKey: dto.idempotencyKey || `session_${session.id}_payment`,
    });

    // 7. Create payment record
    const payment = await this.prisma.payment.create({
      data: {
        sessionId: session.id,
        payerUserId: menteeUserId,
        payeeMentorId: mentor.id,
        amountPaid: amount,
        currencyPaid: mentor.currency,
        amountToMentor: fees.mentorAmount,
        currencyToMentor: mentor.currency,
        platformFee: fees.platformFee,
        platformFeePercentage: PLATFORM_FEE_PERCENTAGE,
        paymentProcessorFee: fees.stripeFee,
        status: 'PENDING',
        stripePaymentIntentId: paymentIntent.id,
      },
    });

    this.logger.log(
      `Created PaymentIntent ${paymentIntent.id} for session ${session.id}, amount: ${amount} ${mentor.currency}`,
    );

    return {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret!,
      amount,
      currency: mentor.currency,
      paymentId: payment.id,
    };
  }

  /**
   * Confirm payment (called after Stripe webhook or manual confirmation)
   */
  async confirmPayment(paymentIntentId: string): Promise<Payment> {
    const payment = await this.prisma.payment.findUnique({
      where: { stripePaymentIntentId: paymentIntentId },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status === 'COMPLETED') {
      return payment;
    }

    // Get PaymentIntent from Stripe to verify
    const paymentIntent = await this.stripeService.getPaymentIntent(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      throw new BadRequestException(
        `Payment not succeeded. Status: ${paymentIntent.status}`,
      );
    }

    // Update payment status
    const updatedPayment = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'COMPLETED',
        paymentMethod: paymentIntent.payment_method_types?.[0] || 'card',
        stripeChargeId: paymentIntent.latest_charge as string,
        paidAt: new Date(),
        invoiceNumber: this.generateInvoiceNumber(),
      },
    });

    this.logger.log(`Payment ${payment.id} confirmed for session ${payment.sessionId}`);

    return updatedPayment;
  }

  /**
   * Get payment status for a session
   */
  async getPaymentStatus(sessionId: string, userId: string): Promise<PaymentResponseDto> {
    const payment = await this.prisma.payment.findUnique({
      where: { sessionId },
      include: {
        session: {
          include: {
            mentorProfile: true,
            menteeProfile: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found for this session');
    }

    // Verify user can access this payment
    const isParticipant =
      payment.session.mentorProfile.userId === userId ||
      payment.session.menteeProfile.userId === userId;

    if (!isParticipant) {
      // Check if admin
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (user?.role !== 'ADMIN') {
        throw new ForbiddenException('You cannot view this payment');
      }
    }

    return this.toPaymentResponse(payment);
  }

  /**
   * Process refund for a session
   */
  async processRefund(
    sessionId: string,
    dto: RefundPaymentDto,
    initiatorUserId: string,
  ): Promise<RefundResponseDto> {
    const payment = await this.prisma.payment.findUnique({
      where: { sessionId },
      include: {
        session: {
          include: {
            mentorProfile: true,
            menteeProfile: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found for this session');
    }

    // Only admin can manually refund, or system for auto-refund
    const user = await this.prisma.user.findUnique({
      where: { id: initiatorUserId },
    });

    if (user?.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can process manual refunds');
    }

    if (payment.status !== 'COMPLETED') {
      throw new BadRequestException('Can only refund completed payments');
    }

    const amountPaid = Number(payment.amountPaid);
    const alreadyRefunded = Number(payment.refundedAmount);
    const maxRefundable = amountPaid - alreadyRefunded;

    const refundAmount = dto.amount
      ? Math.min(dto.amount, maxRefundable)
      : maxRefundable;

    if (refundAmount <= 0) {
      throw new BadRequestException('No amount available to refund');
    }

    // Process refund via Stripe
    const refund = await this.stripeService.refundPaymentIntent(
      payment.stripePaymentIntentId!,
      refundAmount,
      'requested_by_customer',
      `refund_${payment.id}_${Date.now()}`,
    );

    // Update payment record
    const newRefundedAmount = alreadyRefunded + refundAmount;
    const isFullyRefunded = newRefundedAmount >= amountPaid;

    const updatedPayment = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        refundedAmount: newRefundedAmount,
        status: isFullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
      },
    });

    this.logger.log(
      `Refund processed: ${refundAmount} ${payment.currencyPaid} for payment ${payment.id}`,
    );

    return {
      success: true,
      refundId: refund.id,
      amountRefunded: refundAmount,
      status: updatedPayment.status,
      message: isFullyRefunded ? 'Full refund processed' : 'Partial refund processed',
    };
  }

  /**
   * Process automatic refund based on cancellation policy
   */
  async processAutomaticRefund(
    sessionId: string,
    refundPercentage: number,
  ): Promise<RefundResponseDto | null> {
    if (refundPercentage <= 0) {
      return null;
    }

    const payment = await this.prisma.payment.findUnique({
      where: { sessionId },
    });

    if (!payment || payment.status !== 'COMPLETED') {
      return null;
    }

    const amountPaid = Number(payment.amountPaid);
    const refundAmount = Number(((amountPaid * refundPercentage) / 100).toFixed(2));

    if (refundAmount <= 0) {
      return null;
    }

    // Process refund via Stripe
    const refund = await this.stripeService.refundPaymentIntent(
      payment.stripePaymentIntentId!,
      refundAmount,
      'requested_by_customer',
      `auto_refund_${payment.id}_${Date.now()}`,
    );

    // Update payment record
    const alreadyRefunded = Number(payment.refundedAmount);
    const newRefundedAmount = alreadyRefunded + refundAmount;
    const isFullyRefunded = newRefundedAmount >= amountPaid;

    const updatedPayment = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        refundedAmount: newRefundedAmount,
        status: isFullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
      },
    });

    this.logger.log(
      `Automatic refund: ${refundPercentage}% (${refundAmount} ${payment.currencyPaid}) for session ${sessionId}`,
    );

    return {
      success: true,
      refundId: refund.id,
      amountRefunded: refundAmount,
      status: updatedPayment.status,
      message: `${refundPercentage}% refund processed`,
    };
  }

  /**
   * Transfer funds to mentor after session completion
   */
  async transferToMentor(paymentId: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        payeeMentor: true,
        session: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.session.status !== 'COMPLETED') {
      throw new BadRequestException('Session must be completed before transfer');
    }

    if (payment.status !== 'COMPLETED') {
      throw new BadRequestException('Payment must be completed before transfer');
    }

    // Check if mentor has Stripe Connect account
    const mentorStripeAccount = (payment.payeeMentor.metadata as any)?.stripeConnectAccountId;

    if (!mentorStripeAccount) {
      this.logger.warn(
        `Mentor ${payment.payeeMentor.id} has no Stripe Connect account. Transfer skipped.`,
      );
      return;
    }

    // Calculate transfer amount (after refunds if any)
    const amountPaid = Number(payment.amountPaid);
    const refunded = Number(payment.refundedAmount);
    const netPaid = amountPaid - refunded;

    if (netPaid <= 0) {
      this.logger.warn(`No net amount to transfer for payment ${paymentId}`);
      return;
    }

    // Recalculate mentor amount based on net paid
    const fees = this.stripeService.calculateMentorAmount(netPaid, PLATFORM_FEE_PERCENTAGE);

    // Create transfer
    await this.stripeService.createTransfer({
      amount: fees.mentorAmount,
      currency: payment.currencyToMentor,
      destinationAccountId: mentorStripeAccount,
      metadata: {
        paymentId: payment.id,
        sessionId: payment.sessionId,
        mentorId: payment.payeeMentorId,
      },
      idempotencyKey: `transfer_${payment.id}`,
    });

    // Update payment metadata to mark transfer complete
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        // We don't have a transferredAt field, using the session's completedAt
        // In production, you might want to add this field to the schema
      },
    });

    this.logger.log(
      `Transferred ${fees.mentorAmount} ${payment.currencyToMentor} to mentor for payment ${paymentId}`,
    );
  }

  /**
   * Get payment history for a user
   */
  async getPaymentHistory(
    userId: string,
    userRole: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaymentHistoryResponseDto> {
    const skip = (page - 1) * limit;

    let where: any = {};

    if (userRole === 'MENTEE') {
      where.payerUserId = userId;
    } else if (userRole === 'MENTOR') {
      const mentor = await this.prisma.mentorProfile.findUnique({
        where: { userId },
      });
      if (mentor) {
        where.payeeMentorId = mentor.id;
      }
    }
    // ADMIN sees all

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
          session: {
            include: {
              mentorProfile: {
                include: { user: { select: { firstName: true, lastName: true } } },
              },
              menteeProfile: {
                include: { user: { select: { firstName: true, lastName: true } } },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      data: payments.map((p) => this.toPaymentResponse(p)),
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Handle failed payment
   */
  async handleFailedPayment(paymentIntentId: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { stripePaymentIntentId: paymentIntentId },
    });

    if (!payment) {
      this.logger.warn(`Payment not found for failed PaymentIntent: ${paymentIntentId}`);
      return;
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'FAILED' },
    });

    this.logger.log(`Payment ${payment.id} marked as FAILED`);
  }

  /**
   * Calculate platform fee
   */
  calculatePlatformFee(amount: number): number {
    return this.stripeService.calculatePlatformFee(amount, PLATFORM_FEE_PERCENTAGE);
  }

  // ==================== Private Methods ====================

  private toPaymentResponse(payment: Payment): PaymentResponseDto {
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

  private generateInvoiceNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `INV-${year}-${random}`;
  }
}
