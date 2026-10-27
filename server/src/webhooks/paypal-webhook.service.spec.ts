import {
  BadRequestException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PayPalService } from '../paypal/paypal.service';
import { PaymentStatusStore } from './payment-status.store';
import { PayPalWebhookService } from './paypal-webhook.service';

describe('PayPalWebhookService', () => {
  const webhookId = 'WH-TEST-ID';

  const validHeaders = {
    transmissionId: 'tx-1',
    transmissionTime: '2026-10-26T00:00:00Z',
    transmissionSig: 'sig',
    certUrl: 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT-1',
    authAlgo: 'SHA256withRSA',
  };

  function createService(options?: {
    webhookId?: string;
    verify?: jest.Mock;
  }): {
    service: PayPalWebhookService;
    store: PaymentStatusStore;
    verify: jest.Mock;
  } {
    const store = new PaymentStatusStore();
    const verify = options?.verify ?? jest.fn().mockResolvedValue(true);
    const paypalService = {
      verifyWebhookSignature: verify,
    } as unknown as PayPalService;
    const config = {
      get: (key: string) =>
        key === 'PAYPAL_WEBHOOK_ID'
          ? options?.webhookId === undefined
            ? webhookId
            : options.webhookId
          : undefined,
    } as ConfigService;

    return {
      service: new PayPalWebhookService(config, paypalService, store),
      store,
      verify,
    };
  }

  function captureEvent(
    eventType: string,
    resource: Record<string, unknown>,
    eventId = 'WH-EVENT-1',
  ): Record<string, unknown> {
    return {
      id: eventId,
      event_type: eventType,
      resource,
    };
  }

  it('accepts a verified PAYMENT.CAPTURE.COMPLETED event', async () => {
    const { service, store, verify } = createService();
    const body = captureEvent('PAYMENT.CAPTURE.COMPLETED', {
      id: 'CAP-1',
      amount: { value: '99.00', currency_code: 'USD' },
      supplementary_data: { related_ids: { order_id: 'ORDER-1' } },
      custom_id: 'ORDER-12345',
    });

    const result = await service.handle(validHeaders, body);

    expect(verify).toHaveBeenCalled();
    expect(result.apply?.record?.status).toBe('SUCCEEDED');
    expect(store.get('paypal', 'CAP-1')?.orderId).toBe('ORDER-1');
    expect(store.get('paypal', 'CAP-1')?.status).toBe('SUCCEEDED');
    expect(JSON.stringify(result)).not.toContain(webhookId);
  });

  it('rejects failed verification before updating status', async () => {
    const { service, store } = createService({
      verify: jest.fn().mockResolvedValue(false),
    });

    await expect(
      service.handle(
        validHeaders,
        captureEvent('PAYMENT.CAPTURE.COMPLETED', { id: 'CAP-1' }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(store.get('paypal', 'CAP-1')).toBeUndefined();
  });

  it('rejects missing transmission headers', async () => {
    const { service, verify } = createService();

    await expect(
      service.handle(
        { ...validHeaders, transmissionId: undefined },
        captureEvent('PAYMENT.CAPTURE.COMPLETED', { id: 'CAP-1' }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(verify).not.toHaveBeenCalled();
  });

  it('returns a configuration error when PAYPAL_WEBHOOK_ID is missing', async () => {
    const { service, verify } = createService({ webhookId: '' });

    await expect(
      service.handle(validHeaders, captureEvent('PAYMENT.CAPTURE.COMPLETED', { id: 'CAP-1' })),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(verify).not.toHaveBeenCalled();
  });

  it('rejects malicious or overly broad certificate URLs before calling PayPal', async () => {
    const { service, verify } = createService();
    const body = captureEvent('PAYMENT.CAPTURE.COMPLETED', { id: 'CAP-1' });

    const rejected = [
      'https://evil.example/cert',
      'https://api.paypal.com.evil.example/cert',
      'https://www.paypal.com/cert',
      'https://api.paypal.com@evil.example/cert',
      'https://user:pass@api.sandbox.paypal.com/cert',
      'https://api.sandbox.paypal.com:8443/cert',
      'http://api.sandbox.paypal.com/cert',
    ];

    for (const certUrl of rejected) {
      await expect(
        service.handle({ ...validHeaders, certUrl }, body),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(verify).not.toHaveBeenCalled();
  });

  it('accepts exact PayPal API certificate hosts on default HTTPS', async () => {
    const { service, verify } = createService();
    const body = captureEvent('PAYMENT.CAPTURE.COMPLETED', { id: 'CAP-1' }, 'WH-CERT-OK');

    await expect(
      service.handle(
        {
          ...validHeaders,
          certUrl: 'https://api.sandbox.paypal.com/v1/notifications/certs/CERT-1',
        },
        body,
      ),
    ).resolves.toEqual(expect.objectContaining({ received: true }));
    expect(verify).toHaveBeenCalledTimes(1);
  });

  it('surfaces verification API failures safely', async () => {
    const { service } = createService({
      verify: jest.fn().mockRejectedValue(new InternalServerErrorException('PayPal webhook verification failed.')),
    });

    await expect(
      service.handle(validHeaders, captureEvent('PAYMENT.CAPTURE.COMPLETED', { id: 'CAP-1' })),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('maps capture denied, pending, and refunded', async () => {
    const { service, store } = createService();

    await service.handle(
      validHeaders,
      captureEvent('PAYMENT.CAPTURE.DENIED', { id: 'CAP-D' }, 'WH-D'),
    );
    expect(store.get('paypal', 'CAP-D')?.status).toBe('FAILED');

    await service.handle(
      validHeaders,
      captureEvent('PAYMENT.CAPTURE.PENDING', { id: 'CAP-P' }, 'WH-P'),
    );
    expect(store.get('paypal', 'CAP-P')?.status).toBe('PROCESSING');

    await service.handle(
      validHeaders,
      captureEvent('PAYMENT.CAPTURE.COMPLETED', { id: 'CAP-R' }, 'WH-C'),
    );
    await service.handle(
      validHeaders,
      captureEvent('PAYMENT.CAPTURE.REFUNDED', { id: 'CAP-R' }, 'WH-R'),
    );
    expect(store.get('paypal', 'CAP-R')?.status).toBe('REFUNDED');
  });

  it('does not mark CHECKOUT.ORDER.APPROVED as payment success', async () => {
    const { service, store } = createService();

    const result = await service.handle(
      validHeaders,
      captureEvent('CHECKOUT.ORDER.APPROVED', { id: 'ORDER-9' }, 'WH-APPROVED'),
    );

    expect(result.apply?.record?.status).toBe('PENDING');
    expect(store.get('paypal', 'order:ORDER-9')?.status).toBe('PENDING');
    expect(store.get('paypal', 'ORDER-9')).toBeUndefined();
  });

  it('deduplicates repeated delivery of the same event id', async () => {
    const { service } = createService();
    const body = captureEvent('PAYMENT.CAPTURE.COMPLETED', { id: 'CAP-1' }, 'WH-DUP');

    const first = await service.handle(validHeaders, body);
    const second = await service.handle(validHeaders, body);

    expect(first.apply?.duplicate).toBe(false);
    expect(second.apply?.duplicate).toBe(true);
  });

  it('does not process the body when verification fails', async () => {
    const { service, store } = createService({
      verify: jest.fn().mockResolvedValue(false),
    });
    const body = captureEvent('PAYMENT.CAPTURE.COMPLETED', { id: 'CAP-SECRET' }, 'WH-BAD');

    await expect(service.handle(validHeaders, body)).rejects.toBeInstanceOf(BadRequestException);
    expect(store.get('paypal', 'CAP-SECRET')).toBeUndefined();
  });
});
