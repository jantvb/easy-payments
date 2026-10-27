import { Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { PayPalWebhookService } from './paypal-webhook.service';

@Controller('api/webhooks')
export class PayPalWebhookController {
  constructor(private readonly paypalWebhookService: PayPalWebhookService) {}

  /**
   * PayPal webhook receiver.
   * Authenticity is verified with PayPal's verify-webhook-signature API.
   * Body is read from the request so the global ValidationPipe does not reshape it.
   */
  @Post('paypal')
  @HttpCode(200)
  handlePayPal(
    @Req() req: Request,
    @Headers('paypal-transmission-id') transmissionId?: string,
    @Headers('paypal-transmission-time') transmissionTime?: string,
    @Headers('paypal-transmission-sig') transmissionSig?: string,
    @Headers('paypal-cert-url') certUrl?: string,
    @Headers('paypal-auth-algo') authAlgo?: string,
  ) {
    return this.paypalWebhookService.handle(
      {
        transmissionId,
        transmissionTime,
        transmissionSig,
        certUrl,
        authAlgo,
      },
      req.body,
    );
  }
}
