import {
  toKlarnaCreatePaymentRequest,
  toPayPalCreateOrderRequest,
} from './create-payment.model';

describe('toPayPalCreateOrderRequest', () => {
  it('maps only provider, productId, quantity, and currency', () => {
    const body = toPayPalCreateOrderRequest({
      productId: 'premium-plan',
      quantity: 1,
      currency: 'usd',
    });

    expect(body).toEqual({
      provider: 'paypal',
      productId: 'premium-plan',
      quantity: 1,
      currency: 'USD',
    });
    expect(Object.keys(body)).not.toContain('amount');
    expect(Object.keys(body)).not.toContain('metadata');
  });

  it('strips accidental extra fields when mapping from a richer object', () => {
    const dirty = {
      productId: 'premium-plan',
      quantity: 2,
      currency: 'USD',
      amount: 1,
      metadata: { productName: 'Premium Plan' },
    };

    const body = toPayPalCreateOrderRequest(dirty);

    expect(Object.keys(body).sort()).toEqual(['currency', 'productId', 'provider', 'quantity']);
    expect(Object.keys(body)).not.toContain('amount');
    expect(Object.keys(body)).not.toContain('metadata');
  });
});

describe('toKlarnaCreatePaymentRequest', () => {
  it('maps only provider, productId, quantity, and currency', () => {
    const body = toKlarnaCreatePaymentRequest({
      productId: 'premium-plan',
      quantity: 1,
      currency: 'eur',
    });

    expect(body).toEqual({
      provider: 'klarna',
      productId: 'premium-plan',
      quantity: 1,
      currency: 'EUR',
    });
    expect(Object.keys(body)).not.toContain('amount');
    expect(Object.keys(body)).not.toContain('metadata');
  });
});
