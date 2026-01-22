import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, Length } from 'class-validator';

export class CreateConnectAccountDto {
  @ApiPropertyOptional({
    description: 'Country code for the Connect account (defaults to user country)',
    example: 'FR',
  })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;
}

export class ConnectAccountResponseDto {
  @ApiProperty({
    description: 'Stripe Connect account ID',
    example: 'acct_1234567890',
  })
  accountId: string;

  @ApiProperty({
    description: 'Whether the account is fully onboarded',
    example: false,
  })
  isOnboarded: boolean;

  @ApiProperty({
    description: 'Whether charges are enabled',
    example: false,
  })
  chargesEnabled: boolean;

  @ApiProperty({
    description: 'Whether payouts are enabled',
    example: false,
  })
  payoutsEnabled: boolean;

  @ApiPropertyOptional({
    description: 'Onboarding URL if not yet completed',
    example: 'https://connect.stripe.com/setup/...',
  })
  onboardingUrl?: string;
}

export class AccountLinkResponseDto {
  @ApiProperty({
    description: 'URL to redirect user for Stripe onboarding',
    example: 'https://connect.stripe.com/setup/...',
  })
  url: string;

  @ApiProperty({
    description: 'Expiration timestamp for the link',
  })
  expiresAt: Date;
}

export class ConnectAccountStatusDto {
  @ApiProperty({
    description: 'Stripe Connect account ID',
    example: 'acct_1234567890',
  })
  accountId: string;

  @ApiProperty({
    description: 'Whether the account is fully onboarded and ready',
    example: true,
  })
  isReady: boolean;

  @ApiProperty({
    description: 'Whether charges are enabled',
    example: true,
  })
  chargesEnabled: boolean;

  @ApiProperty({
    description: 'Whether payouts are enabled',
    example: true,
  })
  payoutsEnabled: boolean;

  @ApiProperty({
    description: 'Account country',
    example: 'FR',
  })
  country: string;

  @ApiProperty({
    description: 'Default currency for payouts',
    example: 'eur',
  })
  defaultCurrency: string;

  @ApiPropertyOptional({
    description: 'Requirements pending for full activation',
  })
  pendingRequirements?: string[];

  @ApiPropertyOptional({
    description: 'Currently due requirements',
  })
  currentlyDue?: string[];
}
