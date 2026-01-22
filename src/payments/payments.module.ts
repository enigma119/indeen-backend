import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma';
import { StripeService } from './stripe.service';
import { PaymentsService } from './payments.service';
import { StripeConnectService } from './stripe-connect.service';
import { InvoiceService } from './invoice.service';
import { PaymentsController } from './payments.controller';
import { StripeConnectController } from './stripe-connect.controller';
import { WebhooksController } from './webhooks.controller';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [PaymentsController, StripeConnectController, WebhooksController],
  providers: [StripeService, PaymentsService, StripeConnectService, InvoiceService],
  exports: [PaymentsService, StripeService, StripeConnectService],
})
export class PaymentsModule {}
