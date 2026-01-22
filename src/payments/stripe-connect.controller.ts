import { Controller, Post, Get, Body } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { StripeConnectService } from './stripe-connect.service';
import {
  CreateConnectAccountDto,
  ConnectAccountResponseDto,
  AccountLinkResponseDto,
  ConnectAccountStatusDto,
} from './dto';
import { CurrentUser, Roles } from '../common/decorators';
import { User } from '@prisma/client';

@ApiTags('Stripe Connect')
@ApiBearerAuth()
@Controller('stripe/connect')
export class StripeConnectController {
  constructor(private readonly stripeConnectService: StripeConnectService) {}

  @Post('create-account')
  @Roles('MENTOR')
  @ApiOperation({
    summary: 'Create Stripe Connect account',
    description: 'Create a Stripe Connect Express account for the mentor to receive payouts.',
  })
  @ApiResponse({
    status: 201,
    description: 'Connect account created',
    type: ConnectAccountResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Account already exists' })
  @ApiResponse({ status: 404, description: 'Mentor profile not found' })
  async createConnectAccount(
    @Body() dto: CreateConnectAccountDto,
    @CurrentUser() user: User,
  ): Promise<ConnectAccountResponseDto> {
    return this.stripeConnectService.createConnectAccount(user.id, dto);
  }

  @Get('account-link')
  @Roles('MENTOR')
  @ApiOperation({
    summary: 'Get Stripe onboarding link',
    description: 'Get a fresh onboarding link for Stripe Connect setup.',
  })
  @ApiResponse({
    status: 200,
    description: 'Account link generated',
    type: AccountLinkResponseDto,
  })
  @ApiResponse({ status: 400, description: 'No Connect account found' })
  @ApiResponse({ status: 404, description: 'Mentor profile not found' })
  async getAccountLink(@CurrentUser() user: User): Promise<AccountLinkResponseDto> {
    return this.stripeConnectService.createAccountLink(user.id);
  }

  @Get('status')
  @Roles('MENTOR')
  @ApiOperation({
    summary: 'Get Connect account status',
    description: 'Get the current status of the mentor\'s Stripe Connect account.',
  })
  @ApiResponse({
    status: 200,
    description: 'Account status retrieved',
    type: ConnectAccountStatusDto,
  })
  @ApiResponse({ status: 400, description: 'No Connect account found' })
  @ApiResponse({ status: 404, description: 'Mentor profile not found' })
  async getAccountStatus(@CurrentUser() user: User): Promise<ConnectAccountStatusDto> {
    return this.stripeConnectService.getAccountStatus(user.id);
  }
}
