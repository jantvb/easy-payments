import { PaymentStatusStore } from './payment-status.store';

describe('PaymentStatusStore', () => {
  let store: PaymentStatusStore;

  beforeEach(() => {
    store = new PaymentStatusStore();
  });

  it('records a new payment status', () => {
    const result = store.apply({
      provider: 'stripe',
      eventId: 'evt_1',
      eventType: 'payment_intent.succeeded',
      paymentId: 'pi_1',
      status: 'SUCCEEDED',
      amount: '99.00',
      currency: 'USD',
    });

    expect(result.duplicate).toBe(false);
    expect(result.ignored).toBe(false);
    expect(result.record?.status).toBe('SUCCEEDED');
    expect(store.get('stripe', 'pi_1')?.lastEventId).toBe('evt_1');
  });

  it('deduplicates the same provider event id without repeating side effects', () => {
    store.apply({
      provider: 'stripe',
      eventId: 'evt_1',
      eventType: 'payment_intent.succeeded',
      paymentId: 'pi_1',
      status: 'SUCCEEDED',
    });

    const second = store.apply({
      provider: 'stripe',
      eventId: 'evt_1',
      eventType: 'payment_intent.succeeded',
      paymentId: 'pi_1',
      status: 'SUCCEEDED',
    });

    expect(second.duplicate).toBe(true);
    expect(second.ignored).toBe(true);
    expect(second.record?.status).toBe('SUCCEEDED');
  });

  it('allows distinct events for the same payment when transitions are valid', () => {
    store.apply({
      provider: 'paypal',
      eventId: 'WH-1',
      eventType: 'PAYMENT.CAPTURE.PENDING',
      paymentId: 'CAP-1',
      status: 'PROCESSING',
    });

    const completed = store.apply({
      provider: 'paypal',
      eventId: 'WH-2',
      eventType: 'PAYMENT.CAPTURE.COMPLETED',
      paymentId: 'CAP-1',
      status: 'SUCCEEDED',
    });

    expect(completed.ignored).toBe(false);
    expect(completed.previousStatus).toBe('PROCESSING');
    expect(completed.record?.status).toBe('SUCCEEDED');
  });

  it('does not downgrade SUCCEEDED when a delayed PROCESSING event arrives', () => {
    store.apply({
      provider: 'stripe',
      eventId: 'evt_ok',
      eventType: 'payment_intent.succeeded',
      paymentId: 'pi_1',
      status: 'SUCCEEDED',
    });

    const delayed = store.apply({
      provider: 'stripe',
      eventId: 'evt_late',
      eventType: 'payment_intent.processing',
      paymentId: 'pi_1',
      status: 'PROCESSING',
    });

    expect(delayed.duplicate).toBe(false);
    expect(delayed.ignored).toBe(true);
    expect(store.get('stripe', 'pi_1')?.status).toBe('SUCCEEDED');
  });

  it('allows REFUNDED after SUCCEEDED and then freezes the record', () => {
    store.apply({
      provider: 'paypal',
      eventId: 'WH-ok',
      eventType: 'PAYMENT.CAPTURE.COMPLETED',
      paymentId: 'CAP-1',
      status: 'SUCCEEDED',
    });

    const refunded = store.apply({
      provider: 'paypal',
      eventId: 'WH-refund',
      eventType: 'PAYMENT.CAPTURE.REFUNDED',
      paymentId: 'CAP-1',
      status: 'REFUNDED',
    });

    expect(refunded.ignored).toBe(false);
    expect(refunded.record?.status).toBe('REFUNDED');

    const after = store.apply({
      provider: 'paypal',
      eventId: 'WH-again',
      eventType: 'PAYMENT.CAPTURE.COMPLETED',
      paymentId: 'CAP-1',
      status: 'SUCCEEDED',
    });

    expect(after.ignored).toBe(true);
    expect(store.get('paypal', 'CAP-1')?.status).toBe('REFUNDED');
  });

  it('treats FAILED and CANCELED as terminal', () => {
    store.apply({
      provider: 'stripe',
      eventId: 'evt_fail',
      eventType: 'payment_intent.payment_failed',
      paymentId: 'pi_fail',
      status: 'FAILED',
    });

    expect(
      store.apply({
        provider: 'stripe',
        eventId: 'evt_ok',
        eventType: 'payment_intent.succeeded',
        paymentId: 'pi_fail',
        status: 'SUCCEEDED',
      }).ignored,
    ).toBe(true);

    store.apply({
      provider: 'stripe',
      eventId: 'evt_cancel',
      eventType: 'payment_intent.canceled',
      paymentId: 'pi_cancel',
      status: 'CANCELED',
    });

    expect(
      store.apply({
        provider: 'stripe',
        eventId: 'evt_proc',
        eventType: 'payment_intent.processing',
        paymentId: 'pi_cancel',
        status: 'PROCESSING',
      }).ignored,
    ).toBe(true);
  });

  it('keeps Stripe and PayPal payment ids in separate namespaces', () => {
    store.apply({
      provider: 'stripe',
      eventId: 'evt_1',
      eventType: 'payment_intent.succeeded',
      paymentId: 'shared-id',
      status: 'SUCCEEDED',
    });
    store.apply({
      provider: 'paypal',
      eventId: 'WH-1',
      eventType: 'PAYMENT.CAPTURE.COMPLETED',
      paymentId: 'shared-id',
      status: 'PROCESSING',
    });

    expect(store.get('stripe', 'shared-id')?.status).toBe('SUCCEEDED');
    expect(store.get('paypal', 'shared-id')?.status).toBe('PROCESSING');
  });

  it('keeps PayPal order approval ids distinct from capture ids', () => {
    store.apply({
      provider: 'paypal',
      eventId: 'WH-order',
      eventType: 'CHECKOUT.ORDER.APPROVED',
      paymentId: 'order:ORDER-1',
      status: 'PENDING',
      orderId: 'ORDER-1',
    });
    store.apply({
      provider: 'paypal',
      eventId: 'WH-cap',
      eventType: 'PAYMENT.CAPTURE.COMPLETED',
      paymentId: 'ORDER-1',
      status: 'SUCCEEDED',
    });

    expect(store.get('paypal', 'order:ORDER-1')?.status).toBe('PENDING');
    expect(store.get('paypal', 'ORDER-1')?.status).toBe('SUCCEEDED');
  });

  it('handles burst duplicate apply calls without repeating transitions', () => {
    const results = Array.from({ length: 20 }, (_, index) =>
      store.apply({
        provider: 'stripe',
        eventId: 'evt_burst',
        eventType: 'payment_intent.succeeded',
        paymentId: 'pi_burst',
        status: 'SUCCEEDED',
        amount: String(index),
      }),
    );

    expect(results.filter((result) => !result.duplicate && !result.ignored)).toHaveLength(1);
    expect(results.filter((result) => result.duplicate)).toHaveLength(19);
    expect(store.get('stripe', 'pi_burst')?.amount).toBe('0');
    expect(store.get('stripe', 'pi_burst')?.lastEventId).toBe('evt_burst');
  });
});
