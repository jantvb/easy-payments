import { PaymentError, normalizeError } from './payment-error';

describe('PaymentError', () => {
  it('stores code, message, method, provider, and originalError', () => {
    const original = new Error('sdk blew up');
    const error = new PaymentError({
      code: 'PAYMENT_FAILED',
      message: 'Card was declined.',
      method: 'card',
      provider: 'stripe',
      originalError: original,
    });

    expect(error.code).toBe('PAYMENT_FAILED');
    expect(error.message).toBe('Card was declined.');
    expect(error.method).toBe('card');
    expect(error.provider).toBe('stripe');
    expect(error.originalError).toBe(original);
    expect(error.name).toBe('PaymentError');
  });

  it('does not include originalError in JSON serialization', () => {
    const error = new PaymentError({
      code: 'UNKNOWN',
      message: 'Hidden',
      originalError: { secret: 'nope' },
    });
    expect(error.toJSON()['originalError']).toBeUndefined();
  });
});

describe('normalizeError', () => {
  it('returns an existing PaymentError unchanged', () => {
    const error = new PaymentError({ code: 'BACKEND_ERROR', message: 'Nope' });
    expect(normalizeError(error)).toBe(error);
  });

  it('maps cancel-like Error messages to PAYMENT_CANCELLED', () => {
    const normalized = normalizeError(new Error('User cancelled checkout'), { method: 'paypal' });
    expect(normalized).toBeInstanceOf(PaymentError);
    expect(normalized.code).toBe('PAYMENT_CANCELLED');
    expect(normalized.method).toBe('paypal');
    expect(normalized.originalError).toBeInstanceOf(Error);
  });

  it('maps other Error instances to PAYMENT_FAILED', () => {
    const original = new Error('network down');
    const normalized = normalizeError(original, { provider: 'stripe' });
    expect(normalized.code).toBe('PAYMENT_FAILED');
    expect(normalized.provider).toBe('stripe');
    expect(normalized.originalError).toBe(original);
  });

  it('maps unknown values to UNKNOWN', () => {
    const normalized = normalizeError('weird');
    expect(normalized.code).toBe('UNKNOWN');
    expect(normalized.originalError).toBe('weird');
  });
});
