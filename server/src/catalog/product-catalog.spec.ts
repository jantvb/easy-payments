import {
  formatMajorAmount,
  getCatalogProduct,
  listCatalogProducts,
  resolveUnitAmount,
} from './product-catalog';

describe('product-catalog', () => {
  it('resolves premium-plan with catalog price', () => {
    const product = getCatalogProduct('premium-plan');
    expect(product).toEqual(
      expect.objectContaining({
        id: 'premium-plan',
        unitAmount: 99,
        currency: 'USD',
      }),
    );
  });

  it('returns null for unknown productId', () => {
    expect(getCatalogProduct('does-not-exist')).toBeNull();
    expect(getCatalogProduct('')).toBeNull();
  });

  it('lists catalog products', () => {
    const products = listCatalogProducts();
    expect(products.length).toBeGreaterThanOrEqual(1);
    expect(products.some((p) => p.id === 'premium-plan')).toBe(true);
  });

  it('formats PayPal amounts with two decimals', () => {
    expect(formatMajorAmount(99.99)).toBe('99.99');
    expect(formatMajorAmount(10)).toBe('10.00');
  });

  describe('resolveUnitAmount', () => {
    const product = getCatalogProduct('premium-plan')!;

    it('honours a requested amount inside the demo bounds', () => {
      expect(resolveUnitAmount(product, 12.5)).toBe(12.5);
      expect(resolveUnitAmount(product, 0.5)).toBe(0.5);
    });

    it('rounds to cents', () => {
      expect(resolveUnitAmount(product, 12.567)).toBe(12.57);
    });

    it('falls back to the catalog price when the request is missing or out of bounds', () => {
      expect(resolveUnitAmount(product)).toBe(99);
      expect(resolveUnitAmount(product, 0.1)).toBe(99);
      expect(resolveUnitAmount(product, 1_000_000)).toBe(99);
      expect(resolveUnitAmount(product, Number.NaN)).toBe(99);
    });
  });
});
