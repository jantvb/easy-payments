import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PaymentStatusStore } from './payment-status.store';
import { StripeWebhookService } from './stripe-webhook.service';

describe('StripeWebhookService', () => {
  const webhookSecret = 'whsec_test_secret';

  function createService(secret: string | undefined = webhookSecret): {
    service: StripeWebhookService;
    store: PaymentStatusStore;
  } {
    const store = new PaymentStatusStore();
    const config = {
      get: (key: string) => (key === 'STRIPE_WEBHOOK_SECRET' ? secret : undefined),
    } as ConfigService;
    return { service: new StripeWebhookService(config, store), store };
  }

  function signedPayload(
    type: string,
    intent: Partial<Stripe.PaymentIntent> & { id: string },
    eventId = 'evt_test_1',
  ): { rawBody: Buffer; signature: string } {
    const payload = JSON.stringify({
      id: eventId,
      object: 'event',
      type,
      data: { object: { object: 'payment_intent', amount: 9900, currency: 'usd', ...intent } },
    });
    const rawBody = Buffer.from(payload, 'utf8');
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload: rawBody.toString('utf8'),
      secret: webhookSecret,
    });
    return { rawBody, signature };
  }

  it('accepts a valid payment_intent.succeeded signature', () => {
    const { service, store } = createService();
    const { rawBody, signature } = signedPayload('payment_intent.succeeded', { id: 'pi_1' });

    const result = service.handle(rawBody, signature);

    expect(result.received).toBe(true);
    expect(result.eventType).toBe('payment_intent.succeeded');
    expect(result.apply?.record?.status).toBe('SUCCEEDED');
    expect(store.get('stripe', 'pi_1')?.amount).toBe('99.00');
    expect(JSON.stringify(result)).not.toContain(webhookSecret);
  });

  it('rejects an invalid signature before updating status', () => {
    const { service, store } = createService();
    const { rawBody } = signedPayload('payment_intent.succeeded', { id: 'pi_1' });

    expect(() => service.handle(rawBody, 't=1,v1=bad')).toThrow(BadRequestException);
    expect(store.get('stripe', 'pi_1')).toBeUndefined();
  });

  it('rejects a missing signature', () => {
    const { service } = createService();
    const { rawBody } = signedPayload('payment_intent.succeeded', { id: 'pi_1' });

    expect(() => service.handle(rawBody, undefined)).toThrow(BadRequestException);
  });

  it('returns a configuration error when the webhook secret is missing', () => {
    const { service } = createService('');
    const { rawBody, signature } = signedPayload('payment_intent.succeeded', { id: 'pi_1' });

    expect(() => service.handle(rawBody, signature)).toThrow(ServiceUnavailableException);
    try {
      service.handle(rawBody, signature);
    } catch (error) {
      expect((error as Error).message).not.toContain(webhookSecret);
    }
  });

  it('rejects a malformed payload with an invalid signature envelope', () => {
    const { service } = createService();
    expect(() => service.handle(Buffer.from('{not-json'), 't=1,v1=x')).toThrow(
      BadRequestException,
    );
  });

  it('maps supported Stripe PaymentIntent events', () => {
    const { service, store } = createService();

    const processing = signedPayload('payment_intent.processing', { id: 'pi_flow' }, 'evt_p');
    service.handle(processing.rawBody, processing.signature);
    expect(store.get('stripe', 'pi_flow')?.status).toBe('PROCESSING');

    const failed = signedPayload('payment_intent.payment_failed', { id: 'pi_fail' }, 'evt_f');
    service.handle(failed.rawBody, failed.signature);
    expect(store.get('stripe', 'pi_fail')?.status).toBe('FAILED');

    const canceled = signedPayload('payment_intent.canceled', { id: 'pi_c' }, 'evt_c');
    service.handle(canceled.rawBody, canceled.signature);
    expect(store.get('stripe', 'pi_c')?.status).toBe('CANCELED');
  });

  it('acknowledges unsupported events without changing payment status', () => {
    const { service, store } = createService();
    const { rawBody, signature } = signedPayload('charge.succeeded', { id: 'pi_1' }, 'evt_ignored');

    const result = service.handle(rawBody, signature);
    expect(result.apply).toBeNull();
    expect(store.get('stripe', 'pi_1')).toBeUndefined();
  });

  it('deduplicates repeated delivery of the same event id', () => {
    const { service, store } = createService();
    const first = signedPayload('payment_intent.succeeded', { id: 'pi_1' }, 'evt_dup');
    const second = signedPayload('payment_intent.succeeded', { id: 'pi_1' }, 'evt_dup');

    expect(service.handle(first.rawBody, first.signature).apply?.duplicate).toBe(false);
    expect(service.handle(second.rawBody, second.signature).apply?.duplicate).toBe(true);
    expect(store.get('stripe', 'pi_1')?.status).toBe('SUCCEEDED');
  });

  it('does not downgrade SUCCEEDED when processing arrives out of order', () => {
    const { service, store } = createService();
    const ok = signedPayload('payment_intent.succeeded', { id: 'pi_1' }, 'evt_ok');
    service.handle(ok.rawBody, ok.signature);

    const late = signedPayload('payment_intent.processing', { id: 'pi_1' }, 'evt_late');
    const result = service.handle(late.rawBody, late.signature);

    expect(result.apply?.ignored).toBe(true);
    expect(store.get('stripe', 'pi_1')?.status).toBe('SUCCEEDED');
  });
});
