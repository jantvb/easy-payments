import { formatMajorAmount, getCatalogProduct, listCatalogProducts } from './product-catalog';

describe('product-catalog', () => {
  it('resolves premium-plan with trusted price', () => {
    const product = getCatalogProduct('premium-plan');
    expect(product).toEqual(
      expect.objectContaining({
        id: 'premium-plan',
        unitAmount: 99.99,
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
});
