import { normalizePaymentResult } from './payment-result.model';

describe('normalizePaymentResult', () => {
  it('returns a stable PaymentResult shape and copies metadata', () => {
    const metadata = { mock: true };
    const result = normalizePaymentResult({
      status: 'success',
      method: 'card',
      provider: 'stripe',
      transactionId: 'txn_1',
      message: '[DEMO] done',
      metadata,
    });

    expect(result).toEqual({
      status: 'success',
      method: 'card',
      provider: 'stripe',
      transactionId: 'txn_1',
      message: '[DEMO] done',
      metadata: { mock: true },
    });
    expect(result.metadata).not.toBe(metadata);
  });

  it('omits optional fields that were not provided', () => {
    const result = normalizePaymentResult({
      status: 'cancelled',
      method: 'paypal',
      provider: 'paypal',
    });

    expect(result.transactionId).toBeUndefined();
    expect(result.sessionId).toBeUndefined();
    expect(result.metadata).toBeUndefined();
  });
});
