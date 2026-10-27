import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { PaymentStatusStore } from './payment-status.store';
import { WebhookProvider } from './payment-status.types';

/**
 * Reference read API for local inspection of verified webhook-derived status.
 * Not a fulfillment API. In-memory only.
 */
@Controller('api/webhooks')
export class WebhooksStatusController {
  constructor(private readonly paymentStatusStore: PaymentStatusStore) {}

  @Get('status/:provider/:paymentId')
  getStatus(
    @Param('provider') provider: string,
    @Param('paymentId') paymentId: string,
  ) {
    if (provider !== 'stripe' && provider !== 'paypal') {
      throw new NotFoundException('Unknown webhook provider.');
    }
    const record = this.paymentStatusStore.get(provider as WebhookProvider, paymentId);
    if (!record) {
      throw new NotFoundException('No verified webhook status for this payment.');
    }
    return record;
  }
}
