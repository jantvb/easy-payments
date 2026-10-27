import {
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import type { Request } from 'express';
import { StripeWebhookService } from './stripe-webhook.service';

@Controller('api/webhooks')
export class StripeWebhookController {
  constructor(private readonly stripeWebhookService: StripeWebhookService) {}

  /**
   * Stripe webhook receiver.
   * Requires the exact raw body for signature verification (Nest rawBody: true).
   */
  @Post('stripe')
  @HttpCode(200)
  handleStripe(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature?: string,
  ) {
    return this.stripeWebhookService.handle(req.rawBody, signature);
  }
}
