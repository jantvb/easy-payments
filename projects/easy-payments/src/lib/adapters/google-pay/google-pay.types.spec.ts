import { formatGooglePayTotalPrice, buildGooglePayRenderKey } from './google-pay.types';

describe('google-pay.types helpers', () => {
  it('formats trusted totals with two decimals', () => {
    expect(formatGooglePayTotalPrice(99.99, 1)).toBe('99.99');
    expect(formatGooglePayTotalPrice(99.99, 2)).toBe('199.98');
  });

  it('builds a stable render key that ignores theme', () => {
    const product = {
      id: 'premium-plan',
      amount: 99.99,
      currency: 'USD',
      quantity: 1,
    };
    expect(buildGooglePayRenderKey(product)).toBe(buildGooglePayRenderKey(product));
    expect(buildGooglePayRenderKey(product)).not.toBe(
      buildGooglePayRenderKey({ ...product, quantity: 2 }),
    );
  });
});
