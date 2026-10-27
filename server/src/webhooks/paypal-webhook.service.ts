import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PayPalService } from '../paypal/paypal.service';
import { PaymentStatusStore } from './payment-status.store';
import { ApplyWebhookEventResult, ReferencePaymentStatus } from './payment-status.types';

export interface PayPalWebhookHeaders {
  transmissionId?: string;
  transmissionTime?: string;
  transmissionSig?: string;
  certUrl?: string;
  authAlgo?: string;
}

export interface PayPalWebhookHandleResult {
  received: true;
  eventType: string;
  eventId: string;
  apply: ApplyWebhookEventResult | null;
}

interface PayPalWebhookEvent {
  id?: string;
  event_type?: string;
  resource?: Record<string, unknown>;
}

@Injectable()
export class PayPalWebhookService {
  private readonly logger = new Logger(PayPalWebhookService.name);
  private readonly webhookId: string;

  constructor(
    private readonly config: ConfigService,
    private readonly paypalService: PayPalService,
    private readonly paymentStatusStore: PaymentStatusStore,
  ) {
    this.webhookId = this.config.get<string>('PAYPAL_WEBHOOK_ID')?.trim() ?? '';
  }

  async handle(
    headers: PayPalWebhookHeaders,
    body: unknown,
  ): Promise<PayPalWebhookHandleResult> {
    if (!this.webhookId) {
      throw new ServiceUnavailableException(
        'PayPal webhooks are not configured. Set PAYPAL_WEBHOOK_ID in server/.env',
      );
    }

    const transmissionId = headers.transmissionId?.trim();
    const transmissionTime = headers.transmissionTime?.trim();
    const transmissionSig = headers.transmissionSig?.trim();
    const certUrl = headers.certUrl?.trim();
    const authAlgo = headers.authAlgo?.trim();

    if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) {
      throw new BadRequestException('Missing PayPal webhook transmission headers.');
    }

    if (!this.isTrustedPayPalCertUrl(certUrl)) {
      throw new BadRequestException('Invalid PayPal certificate URL.');
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new BadRequestException('Malformed PayPal webhook body.');
    }

    const verified = await this.paypalService.verifyWebhookSignature({
      authAlgo,
      certUrl,
      transmissionId,
      transmissionSig,
      transmissionTime,
      webhookId: this.webhookId,
      webhookEvent: body,
    });

    if (!verified) {
      this.logger.warn('Rejected PayPal webhook: verification failed.');
      throw new BadRequestException('Invalid PayPal webhook signature.');
    }

    const event = body as PayPalWebhookEvent;
    const eventId = typeof event.id === 'string' ? event.id.trim() : '';
    const eventType = typeof event.event_type === 'string' ? event.event_type.trim() : '';

    if (!eventId || !eventType) {
      throw new BadRequestException('Malformed PayPal webhook event.');
    }

    const apply = this.applyPayPalEvent(eventId, eventType, event.resource);
    this.logger.log(
      `PayPal webhook accepted type=${eventType} duplicate=${apply?.duplicate ?? false} ignored=${apply?.ignored ?? true}`,
    );

    return {
      received: true,
      eventType,
      eventId,
      apply,
    };
  }

  private applyPayPalEvent(
    eventId: string,
    eventType: string,
    resource: Record<string, unknown> | undefined,
  ): ApplyWebhookEventResult | null {
    if (eventType === 'CHECKOUT.ORDER.APPROVED') {
      // Order approval is not a completed capture — never mark SUCCEEDED.
      const orderId =
        resource && typeof resource['id'] === 'string' ? String(resource['id']).trim() : '';
      if (!orderId) {
        return null;
      }
      return this.paymentStatusStore.apply({
        provider: 'paypal',
        eventId,
        eventType,
        paymentId: `order:${orderId}`,
        status: 'PENDING',
        orderId,
      });
    }

    const status = this.mapCaptureEvent(eventType);
    if (!status) {
      return null;
    }

    if (!resource || typeof resource !== 'object') {
      this.logger.warn(`PayPal event ${eventType} missing capture resource; ignored.`);
      return null;
    }

    const captureId = typeof resource['id'] === 'string' ? resource['id'].trim() : '';
    if (!captureId) {
      this.logger.warn(`PayPal event ${eventType} missing capture id; ignored.`);
      return null;
    }

    const amountObj = resource['amount'] as { value?: string; currency_code?: string } | undefined;
    const amount = typeof amountObj?.value === 'string' ? amountObj.value : undefined;
    const currency =
      typeof amountObj?.currency_code === 'string'
        ? amountObj.currency_code.toUpperCase()
        : undefined;

    const relatedOrderId = (
      resource['supplementary_data'] as { related_ids?: { order_id?: string } } | undefined
    )?.related_ids?.order_id;
    const orderId =
      typeof relatedOrderId === 'string' && relatedOrderId.trim()
        ? relatedOrderId.trim()
        : undefined;

    // resource.custom_id is merchant descriptive metadata — never ownership proof.
    return this.paymentStatusStore.apply({
      provider: 'paypal',
      eventId,
      eventType,
      paymentId: captureId,
      status,
      amount,
      currency,
      orderId,
    });
  }

  private mapCaptureEvent(eventType: string): ReferencePaymentStatus | null {
    switch (eventType) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        return 'SUCCEEDED';
      case 'PAYMENT.CAPTURE.DENIED':
        return 'FAILED';
      case 'PAYMENT.CAPTURE.PENDING':
        return 'PROCESSING';
      case 'PAYMENT.CAPTURE.REFUNDED':
        return 'REFUNDED';
      default:
        return null;
    }
  }

  /**
   * Defense-in-depth allowlist for PAYPAL-CERT-URL.
   * This backend never fetches the certificate URL; it is forwarded only to
   * PayPal's official verify-webhook-signature API (same PAYPAL_MODE host).
   */
  private isTrustedPayPalCertUrl(certUrl: string): boolean {
    try {
      const parsed = new URL(certUrl);
      if (parsed.protocol !== 'https:') {
        return false;
      }
      // Reject userinfo tricks such as https://api.paypal.com@evil.example/...
      if (parsed.username !== '' || parsed.password !== '') {
        return false;
      }
      // Default HTTPS only — reject unexpected ports (e.g. :8443).
      if (parsed.port !== '' && parsed.port !== '443') {
        return false;
      }
      const host = parsed.hostname.toLowerCase();
      // Exact API hosts only (not arbitrary *.paypal.com).
      return host === 'api.paypal.com' || host === 'api.sandbox.paypal.com';
    } catch {
      return false;
    }
  }
}
