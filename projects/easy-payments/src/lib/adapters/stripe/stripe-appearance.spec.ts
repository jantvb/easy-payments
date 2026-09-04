import { buildStripeSessionKey, stripeAppearanceThemeName } from './stripe-appearance';

describe('buildStripeSessionKey', () => {
  const product = {
    id: 'premium-plan',
    amount: 99.99,
    currency: 'USD',
    quantity: 1,
  };

  it('is stable for the same product/checkout identity', () => {
    expect(buildStripeSessionKey(product)).toBe(buildStripeSessionKey({ ...product }));
  });

  it('changes when amount, quantity, or currency changes', () => {
    const base = buildStripeSessionKey(product);
    expect(buildStripeSessionKey({ ...product, amount: 10 })).not.toBe(base);
    expect(buildStripeSessionKey({ ...product, quantity: 2 })).not.toBe(base);
    expect(buildStripeSessionKey({ ...product, currency: 'EUR' })).not.toBe(base);
  });

  it('does not depend on theme (theme must not recreate PaymentIntents)', () => {
    // Documented invariant: callers must not include theme in the session key.
    expect(stripeAppearanceThemeName('light')).toBe('stripe');
    expect(stripeAppearanceThemeName('dark')).toBe('night');
    expect(buildStripeSessionKey(product)).toBe(
      buildStripeSessionKey(product, { customer: { email: undefined } }),
    );
  });
});
