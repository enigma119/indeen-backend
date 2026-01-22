import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

export interface CreatePaymentIntentParams {
  amount: number;
  currency: string;
  customerId?: string;
  metadata?: Record<string, string>;
  idempotencyKey?: string;
}

export interface CreateCustomerParams {
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}

export interface CreateTransferParams {
  amount: number;
  currency: string;
  destinationAccountId: string;
  metadata?: Record<string, string>;
  idempotencyKey?: string;
}

export interface CreateConnectAccountParams {
  email: string;
  country: string;
  type?: Stripe.AccountCreateParams.Type;
  metadata?: Record<string, string>;
}

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe | null;
  private readonly isConfigured: boolean;

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');

    if (secretKey && secretKey !== 'sk_test_your-stripe-secret-key') {
      this.stripe = new Stripe(secretKey, {
        apiVersion: '2024-12-18.acacia',
        typescript: true,
      });
      this.isConfigured = true;
      this.logger.log('Stripe initialized successfully');
    } else {
      this.stripe = null;
      this.isConfigured = false;
      this.logger.warn('Stripe not configured - payments will not work');
    }
  }

  /**
   * Check if Stripe is properly configured
   */
  isStripeConfigured(): boolean {
    return this.isConfigured;
  }

  /**
   * Ensure Stripe is configured before operations
   */
  private ensureConfigured(): Stripe {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }
    return this.stripe;
  }

  // ==================== Customer Management ====================

  /**
   * Create a new Stripe customer
   */
  async createCustomer(params: CreateCustomerParams): Promise<Stripe.Customer> {
    const stripe = this.ensureConfigured();

    const customer = await stripe.customers.create({
      email: params.email,
      name: params.name,
      metadata: params.metadata,
    });

    this.logger.log(`Created Stripe customer: ${customer.id}`);
    return customer;
  }

  /**
   * Retrieve a Stripe customer
   */
  async getCustomer(customerId: string): Promise<Stripe.Customer | null> {
    const stripe = this.ensureConfigured();

    try {
      const customer = await stripe.customers.retrieve(customerId);
      if (customer.deleted) {
        return null;
      }
      return customer as Stripe.Customer;
    } catch (error) {
      this.logger.warn(`Customer not found: ${customerId}`);
      return null;
    }
  }

  /**
   * Update a Stripe customer
   */
  async updateCustomer(
    customerId: string,
    params: Stripe.CustomerUpdateParams,
  ): Promise<Stripe.Customer> {
    const stripe = this.ensureConfigured();
    return stripe.customers.update(customerId, params);
  }

  // ==================== Payment Intents ====================

  /**
   * Create a PaymentIntent for a session booking
   */
  async createPaymentIntent(
    params: CreatePaymentIntentParams,
  ): Promise<Stripe.PaymentIntent> {
    const stripe = this.ensureConfigured();

    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: Math.round(params.amount * 100), // Convert to cents
      currency: params.currency.toLowerCase(),
      customer: params.customerId,
      metadata: params.metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    };

    const options: Stripe.RequestOptions = {};
    if (params.idempotencyKey) {
      options.idempotencyKey = params.idempotencyKey;
    }

    const paymentIntent = await stripe.paymentIntents.create(
      paymentIntentParams,
      options,
    );

    this.logger.log(`Created PaymentIntent: ${paymentIntent.id}`);
    return paymentIntent;
  }

  /**
   * Retrieve a PaymentIntent
   */
  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    const stripe = this.ensureConfigured();
    return stripe.paymentIntents.retrieve(paymentIntentId);
  }

  /**
   * Confirm a PaymentIntent (usually done client-side, but available for server-side)
   */
  async confirmPaymentIntent(
    paymentIntentId: string,
    params?: Stripe.PaymentIntentConfirmParams,
  ): Promise<Stripe.PaymentIntent> {
    const stripe = this.ensureConfigured();

    const paymentIntent = await stripe.paymentIntents.confirm(
      paymentIntentId,
      params,
    );

    this.logger.log(`Confirmed PaymentIntent: ${paymentIntent.id}`);
    return paymentIntent;
  }

  /**
   * Cancel a PaymentIntent
   */
  async cancelPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    const stripe = this.ensureConfigured();

    const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);
    this.logger.log(`Cancelled PaymentIntent: ${paymentIntent.id}`);
    return paymentIntent;
  }

  // ==================== Refunds ====================

  /**
   * Create a refund for a charge
   */
  async createRefund(
    chargeId: string,
    amount?: number,
    reason?: Stripe.RefundCreateParams.Reason,
    idempotencyKey?: string,
  ): Promise<Stripe.Refund> {
    const stripe = this.ensureConfigured();

    const refundParams: Stripe.RefundCreateParams = {
      charge: chargeId,
      reason: reason || 'requested_by_customer',
    };

    if (amount) {
      refundParams.amount = Math.round(amount * 100); // Convert to cents
    }

    const options: Stripe.RequestOptions = {};
    if (idempotencyKey) {
      options.idempotencyKey = idempotencyKey;
    }

    const refund = await stripe.refunds.create(refundParams, options);
    this.logger.log(`Created refund: ${refund.id} for charge: ${chargeId}`);
    return refund;
  }

  /**
   * Create a refund from PaymentIntent
   */
  async refundPaymentIntent(
    paymentIntentId: string,
    amount?: number,
    reason?: Stripe.RefundCreateParams.Reason,
    idempotencyKey?: string,
  ): Promise<Stripe.Refund> {
    const stripe = this.ensureConfigured();

    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: paymentIntentId,
      reason: reason || 'requested_by_customer',
    };

    if (amount) {
      refundParams.amount = Math.round(amount * 100);
    }

    const options: Stripe.RequestOptions = {};
    if (idempotencyKey) {
      options.idempotencyKey = idempotencyKey;
    }

    const refund = await stripe.refunds.create(refundParams, options);
    this.logger.log(`Created refund: ${refund.id} for PaymentIntent: ${paymentIntentId}`);
    return refund;
  }

  // ==================== Stripe Connect ====================

  /**
   * Create a Stripe Connect account for a mentor
   */
  async createConnectAccount(
    params: CreateConnectAccountParams,
  ): Promise<Stripe.Account> {
    const stripe = this.ensureConfigured();

    const account = await stripe.accounts.create({
      type: params.type || 'express',
      country: params.country,
      email: params.email,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: params.metadata,
    });

    this.logger.log(`Created Connect account: ${account.id}`);
    return account;
  }

  /**
   * Create an account link for Stripe Connect onboarding
   */
  async createAccountLink(
    accountId: string,
    refreshUrl: string,
    returnUrl: string,
  ): Promise<Stripe.AccountLink> {
    const stripe = this.ensureConfigured();

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    this.logger.log(`Created account link for: ${accountId}`);
    return accountLink;
  }

  /**
   * Retrieve a Connect account
   */
  async getConnectAccount(accountId: string): Promise<Stripe.Account> {
    const stripe = this.ensureConfigured();
    return stripe.accounts.retrieve(accountId);
  }

  /**
   * Check if a Connect account has completed onboarding
   */
  async isAccountReady(accountId: string): Promise<boolean> {
    const account = await this.getConnectAccount(accountId);
    return account.charges_enabled && account.payouts_enabled;
  }

  /**
   * Create a transfer to a Connect account (payout to mentor)
   */
  async createTransfer(params: CreateTransferParams): Promise<Stripe.Transfer> {
    const stripe = this.ensureConfigured();

    const transferParams: Stripe.TransferCreateParams = {
      amount: Math.round(params.amount * 100), // Convert to cents
      currency: params.currency.toLowerCase(),
      destination: params.destinationAccountId,
      metadata: params.metadata,
    };

    const options: Stripe.RequestOptions = {};
    if (params.idempotencyKey) {
      options.idempotencyKey = params.idempotencyKey;
    }

    const transfer = await stripe.transfers.create(transferParams, options);
    this.logger.log(
      `Created transfer: ${transfer.id} to account: ${params.destinationAccountId}`,
    );
    return transfer;
  }

  // ==================== Webhooks ====================

  /**
   * Construct and verify a webhook event
   */
  constructWebhookEvent(
    payload: Buffer,
    signature: string,
    webhookSecret: string,
  ): Stripe.Event {
    const stripe = this.ensureConfigured();
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }

  // ==================== Fee Calculation ====================

  /**
   * Calculate Stripe processing fee (2.9% + 0.30)
   */
  calculateStripeFee(amount: number): number {
    const percentageFee = amount * 0.029;
    const fixedFee = 0.3;
    return Number((percentageFee + fixedFee).toFixed(2));
  }

  /**
   * Calculate platform fee (15%)
   */
  calculatePlatformFee(amount: number, percentage: number = 15): number {
    return Number((amount * (percentage / 100)).toFixed(2));
  }

  /**
   * Calculate amount to mentor after all fees
   */
  calculateMentorAmount(amountPaid: number, platformFeePercentage: number = 15): {
    platformFee: number;
    stripeFee: number;
    mentorAmount: number;
  } {
    const platformFee = this.calculatePlatformFee(amountPaid, platformFeePercentage);
    const stripeFee = this.calculateStripeFee(amountPaid);
    const mentorAmount = Number((amountPaid - platformFee - stripeFee).toFixed(2));

    return {
      platformFee,
      stripeFee,
      mentorAmount,
    };
  }
}
