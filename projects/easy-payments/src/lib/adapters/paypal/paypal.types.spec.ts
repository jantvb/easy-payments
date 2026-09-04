import { buildPayPalRenderKey } from './paypal.types';

describe('buildPayPalRenderKey', () => {
  it('is stable for the same product identity', () => {
    const product = {
      id: 'premium-plan',
      name: 'Premium',
      amount: 99.99,
      currency: 'USD',
      quantity: 1,
    };
    expect(buildPayPalRenderKey(product)).toBe(buildPayPalRenderKey(product));
  });

  it('changes when quantity changes', () => {
    const base = {
      id: 'premium-plan',
      name: 'Premium',
      amount: 99.99,
      currency: 'USD',
      quantity: 1,
    };
    expect(buildPayPalRenderKey(base)).not.toBe(
      buildPayPalRenderKey({ ...base, quantity: 2 }),
    );
  });
});
