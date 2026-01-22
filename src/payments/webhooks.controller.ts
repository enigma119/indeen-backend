import {
  Controller,
  Post,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiExcludeEndpoint } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import Stripe from 'stripe';
import { StripeService } from './stripe.service';
import { PaymentsService } from './payments.service';
import { StripeConnectService } from './stripe-connect.service';
import { Public } from '../common/decorators';

@ApiTags('Webhooks')
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);
  private readonly webhookSecret: string;
  private readonly connectWebhookSecret: string;

  constructor(
    private readonly stripeService: StripeService,
    private readonly paymentsService: PaymentsService,
    private readonly stripeConnectService: StripeConnectService,
    private readonly configService: ConfigService,
  ) {
    this.webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET') || '';
    this.connectWebhookSecret =
      this.configService.get<string>('STRIPE_CONNECT_WEBHOOK_SECRET') || this.webhookSecret;
  }

  @Post('stripe')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Stripe webhook endpoint',
    description: 'Receives webhook events from Stripe for payment processing.',
  })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  @ApiResponse({ status: 400, description: 'Invalid webhook signature' })
  async handleStripeWebhook(
    @Req() req: Request,
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: boolean }> {
    if (!this.webhookSecret) {
      this.logger.warn('Stripe webhook secret not configured');
      throw new BadRequestException('Webhook not configured');
    }

    let event: Stripe.Event;

    try {
      event = this.stripeService.constructWebhookEvent(
        req.body as Buffer,
        signature,
        this.webhookSecret,
      );
    } catch (err) {
      this.logger.error(`Webhook signature verification failed: ${err.message}`);
      throw new BadRequestException('Invalid webhook signature');
    }

    this.logger.log(`Received Stripe webhook: ${event.type}`);

    try {
      await this.handleEvent(event);
    } catch (error) {
      this.logger.error(`Error processing webhook ${event.type}: ${error.message}`);
      // Still return 200 to acknowledge receipt
    }

    return { received: true };
  }

  @Post('stripe/connect')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async handleStripeConnectWebhook(
    @Req() req: Request,
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: boolean }> {
    if (!this.connectWebhookSecret) {
      this.logger.warn('Stripe Connect webhook secret not configured');
      throw new BadRequestException('Webhook not configured');
    }

    let event: Stripe.Event;

    try {
      event = this.stripeService.constructWebhookEvent(
        req.body as Buffer,
        signature,
        this.connectWebhookSecret,
      );
    } catch (err) {
      this.logger.error(`Connect webhook signature verification failed: ${err.message}`);
      throw new BadRequestException('Invalid webhook signature');
    }

    this.logger.log(`Received Stripe Connect webhook: ${event.type}`);

    try {
      await this.handleConnectEvent(event);
    } catch (error) {
      this.logger.error(`Error processing Connect webhook ${event.type}: ${error.message}`);
    }

    return { received: true };
  }

  // ==================== Event Handlers ====================

  private async handleEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case 'charge.refunded':
        await this.handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      case 'transfer.created':
        await this.handleTransferCreated(event.data.object as Stripe.Transfer);
        break;

      default:
        this.logger.debug(`Unhandled event type: ${event.type}`);
    }
  }

  private async handleConnectEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'account.updated':
        await this.handleAccountUpdated(event.data.object as Stripe.Account);
        break;

      case 'account.application.deauthorized':
        this.logger.warn(
          `Connect account deauthorized: ${(event.data.object as any).id}`,
        );
        break;

      default:
        this.logger.debug(`Unhandled Connect event type: ${event.type}`);
    }
  }

  // ==================== Payment Event Handlers ====================

  private async handlePaymentIntentSucceeded(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    this.logger.log(`PaymentIntent succeeded: ${paymentIntent.id}`);

    try {
      await this.paymentsService.confirmPayment(paymentIntent.id);
      this.logger.log(`Payment confirmed for PaymentIntent: ${paymentIntent.id}`);
    } catch (error) {
      this.logger.error(`Failed to confirm payment: ${error.message}`);
    }
  }

  private async handlePaymentIntentFailed(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    this.logger.warn(`PaymentIntent failed: ${paymentIntent.id}`);

    try {
      await this.paymentsService.handleFailedPayment(paymentIntent.id);
    } catch (error) {
      this.logger.error(`Failed to handle payment failure: ${error.message}`);
    }
  }

  private async handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
    this.logger.log(`Charge refunded: ${charge.id}, refunded amount: ${charge.amount_refunded}`);

    // The refund is already processed via processRefund, this is just for logging/verification
    const paymentIntentId = charge.payment_intent as string;
    if (paymentIntentId) {
      this.logger.log(
        `Refund processed for PaymentIntent: ${paymentIntentId}`,
      );
    }
  }

  private async handleTransferCreated(transfer: Stripe.Transfer): Promise<void> {
    this.logger.log(
      `Transfer created: ${transfer.id} to ${transfer.destination}, amount: ${transfer.amount}`,
    );

    const paymentId = transfer.metadata?.paymentId;
    if (paymentId) {
      this.logger.log(`Transfer completed for payment: ${paymentId}`);
    }
  }

  // ==================== Connect Event Handlers ====================

  private async handleAccountUpdated(account: Stripe.Account): Promise<void> {
    this.logger.log(
      `Connect account updated: ${account.id}, charges: ${account.charges_enabled}, payouts: ${account.payouts_enabled}`,
    );

    try {
      await this.stripeConnectService.handleAccountUpdate(account.id);
    } catch (error) {
      this.logger.error(`Failed to handle account update: ${error.message}`);
    }
  }
}
