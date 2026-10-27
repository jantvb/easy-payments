import { Module } from '@nestjs/common';
import { PayPalModule } from '../paypal/paypal.module';
import { PaymentStatusStore } from './payment-status.store';
import { PayPalWebhookController } from './paypal-webhook.controller';
import { PayPalWebhookService } from './paypal-webhook.service';
import { StripeWebhookController } from './stripe-webhook.controller';
import { StripeWebhookService } from './stripe-webhook.service';
import { WebhooksStatusController } from './webhooks.controller';

@Module({
  imports: [PayPalModule],
  controllers: [StripeWebhookController, PayPalWebhookController, WebhooksStatusController],
  providers: [PaymentStatusStore, StripeWebhookService, PayPalWebhookService],
  exports: [PaymentStatusStore],
})
export class WebhooksModule {}
