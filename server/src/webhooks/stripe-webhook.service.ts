import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PaymentStatusStore } from './payment-status.store';
import { ApplyWebhookEventResult, ReferencePaymentStatus } from './payment-status.types';

export interface StripeWebhookHandleResult {
  received: true;
  eventType: string;
  eventId: string;
  apply: ApplyWebhookEventResult | null;
}

@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);
  private readonly webhookSecret: string;

  constructor(
    private readonly config: ConfigService,
    private readonly paymentStatusStore: PaymentStatusStore,
  ) {
    this.webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET')?.trim() ?? '';
  }

  handle(rawBody: Buffer | undefined, signature: string | undefined): StripeWebhookHandleResult {
    if (!this.webhookSecret) {
      throw new ServiceUnavailableException(
        'Stripe webhooks are not configured. Set STRIPE_WEBHOOK_SECRET in server/.env',
      );
    }

    if (!signature?.trim()) {
      throw new BadRequestException('Missing Stripe-Signature header.');
    }

    if (!rawBody || rawBody.length === 0) {
      throw new BadRequestException('Missing Stripe webhook body.');
    }

    let event: Stripe.Event;
    try {
      // Default Stripe tolerance is 300s; pass it explicitly for clarity.
      event = Stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret, 300);
    } catch {
      this.logger.warn('Rejected Stripe webhook: invalid signature or payload.');
      throw new BadRequestException('Invalid Stripe webhook signature.');
    }

    const apply = this.applyStripeEvent(event);
    this.logger.log(
      `Stripe webhook accepted type=${event.type} duplicate=${apply?.duplicate ?? false} ignored=${apply?.ignored ?? true}`,
    );

    return {
      received: true,
      eventType: event.type,
      eventId: event.id,
      apply,
    };
  }

  private applyStripeEvent(event: Stripe.Event): ApplyWebhookEventResult | null {
    const status = this.mapStripeEvent(event.type);
    if (!status) {
      return null;
    }

    const intent = event.data?.object as Stripe.PaymentIntent | undefined;
    if (!intent || typeof intent !== 'object' || typeof intent.id !== 'string' || !intent.id) {
      this.logger.warn(`Stripe event ${event.type} missing PaymentIntent object; ignored.`);
      return null;
    }

    const amount =
      typeof intent.amount === 'number' && Number.isFinite(intent.amount)
        ? (intent.amount / 100).toFixed(2)
        : undefined;
    const currency =
      typeof intent.currency === 'string' ? intent.currency.toUpperCase() : undefined;

    // Metadata on the intent is descriptive only — never used as ownership proof.
    return this.paymentStatusStore.apply({
      provider: 'stripe',
      eventId: event.id,
      eventType: event.type,
      paymentId: intent.id,
      status,
      amount,
      currency,
    });
  }

  private mapStripeEvent(type: string): ReferencePaymentStatus | null {
    switch (type) {
      case 'payment_intent.succeeded':
        return 'SUCCEEDED';
      case 'payment_intent.payment_failed':
        return 'FAILED';
      case 'payment_intent.processing':
        return 'PROCESSING';
      case 'payment_intent.canceled':
        return 'CANCELED';
      default:
        return null;
    }
  }
}
