import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from './stripe.service';
import {
  CreateConnectAccountDto,
  ConnectAccountResponseDto,
  AccountLinkResponseDto,
  ConnectAccountStatusDto,
} from './dto';

@Injectable()
export class StripeConnectService {
  private readonly logger = new Logger(StripeConnectService.name);
  private readonly frontendUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly configService: ConfigService,
  ) {
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3001';
  }

  /**
   * Create a Stripe Connect account for a mentor
   */
  async createConnectAccount(
    mentorUserId: string,
    dto: CreateConnectAccountDto,
  ): Promise<ConnectAccountResponseDto> {
    // 1. Get mentor profile
    const mentor = await this.prisma.mentorProfile.findUnique({
      where: { userId: mentorUserId },
      include: { user: true },
    });

    if (!mentor) {
      throw new NotFoundException('Mentor profile not found');
    }

    // 2. Check if already has Connect account
    const existingAccountId = (mentor.metadata as any)?.stripeConnectAccountId;
    if (existingAccountId) {
      // Return existing account status as ConnectAccountResponseDto
      const status = await this.getAccountStatus(mentorUserId);
      return {
        accountId: status.accountId,
        isOnboarded: status.isReady,
        chargesEnabled: status.chargesEnabled,
        payoutsEnabled: status.payoutsEnabled,
        onboardingUrl: status.isReady ? undefined : (await this.createAccountLink(mentorUserId)).url,
      };
    }

    // 3. Determine country
    const country = dto.country || mentor.user.countryCode || 'FR';

    // 4. Create Stripe Connect account
    const account = await this.stripeService.createConnectAccount({
      email: mentor.user.email,
      country,
      type: 'express',
      metadata: {
        mentorId: mentor.id,
        userId: mentor.userId,
      },
    });

    // 5. Store Connect account ID in mentor metadata
    const updatedMetadata = {
      ...(mentor.metadata as object),
      stripeConnectAccountId: account.id,
      stripeConnectCountry: country,
      stripeConnectCreatedAt: new Date().toISOString(),
    };

    await this.prisma.mentorProfile.update({
      where: { id: mentor.id },
      data: { metadata: updatedMetadata },
    });

    this.logger.log(`Created Stripe Connect account ${account.id} for mentor ${mentor.id}`);

    // 6. Create onboarding link
    const accountLink = await this.createAccountLink(mentorUserId);

    return {
      accountId: account.id,
      isOnboarded: false,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      onboardingUrl: accountLink.url,
    };
  }

  /**
   * Create an account link for Stripe Connect onboarding
   */
  async createAccountLink(mentorUserId: string): Promise<AccountLinkResponseDto> {
    const mentor = await this.prisma.mentorProfile.findUnique({
      where: { userId: mentorUserId },
    });

    if (!mentor) {
      throw new NotFoundException('Mentor profile not found');
    }

    const accountId = (mentor.metadata as any)?.stripeConnectAccountId;
    if (!accountId) {
      throw new BadRequestException('No Stripe Connect account found. Create one first.');
    }

    const refreshUrl = `${this.frontendUrl}/mentor/stripe/refresh`;
    const returnUrl = `${this.frontendUrl}/mentor/stripe/complete`;

    const accountLink = await this.stripeService.createAccountLink(
      accountId,
      refreshUrl,
      returnUrl,
    );

    return {
      url: accountLink.url,
      expiresAt: new Date(accountLink.expires_at * 1000),
    };
  }

  /**
   * Get Connect account status
   */
  async getAccountStatus(mentorUserId: string): Promise<ConnectAccountStatusDto> {
    const mentor = await this.prisma.mentorProfile.findUnique({
      where: { userId: mentorUserId },
    });

    if (!mentor) {
      throw new NotFoundException('Mentor profile not found');
    }

    const accountId = (mentor.metadata as any)?.stripeConnectAccountId;
    if (!accountId) {
      throw new BadRequestException('No Stripe Connect account found');
    }

    const account = await this.stripeService.getConnectAccount(accountId);

    return {
      accountId: account.id,
      isReady: account.charges_enabled && account.payouts_enabled,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      country: account.country || '',
      defaultCurrency: account.default_currency || 'eur',
      pendingRequirements: account.requirements?.pending_verification || [],
      currentlyDue: account.requirements?.currently_due || [],
    };
  }

  /**
   * Check if mentor can receive payouts
   */
  async canReceivePayouts(mentorId: string): Promise<boolean> {
    const mentor = await this.prisma.mentorProfile.findUnique({
      where: { id: mentorId },
    });

    if (!mentor) {
      return false;
    }

    const accountId = (mentor.metadata as any)?.stripeConnectAccountId;
    if (!accountId) {
      return false;
    }

    try {
      return await this.stripeService.isAccountReady(accountId);
    } catch (error) {
      this.logger.warn(`Error checking account status: ${error.message}`);
      return false;
    }
  }

  /**
   * Handle Stripe Connect webhook for account updates
   */
  async handleAccountUpdate(accountId: string): Promise<void> {
    // Find mentor by Connect account ID
    const mentor = await this.prisma.mentorProfile.findFirst({
      where: {
        metadata: {
          path: ['stripeConnectAccountId'],
          equals: accountId,
        },
      },
    });

    if (!mentor) {
      this.logger.warn(`No mentor found for Connect account: ${accountId}`);
      return;
    }

    const account = await this.stripeService.getConnectAccount(accountId);

    // Update metadata with latest status
    const updatedMetadata = {
      ...(mentor.metadata as object),
      stripeConnectChargesEnabled: account.charges_enabled,
      stripeConnectPayoutsEnabled: account.payouts_enabled,
      stripeConnectUpdatedAt: new Date().toISOString(),
    };

    await this.prisma.mentorProfile.update({
      where: { id: mentor.id },
      data: { metadata: updatedMetadata },
    });

    this.logger.log(
      `Updated Connect account status for mentor ${mentor.id}: charges=${account.charges_enabled}, payouts=${account.payouts_enabled}`,
    );
  }
}
