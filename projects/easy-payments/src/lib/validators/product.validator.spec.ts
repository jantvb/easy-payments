import { validatePaymentProduct } from './product.validator';
import { SAMPLE_PRODUCT } from '../testing/test-doubles';

describe('validatePaymentProduct', () => {
  it('accepts a valid product', () => {
    const result = validatePaymentProduct(SAMPLE_PRODUCT);
    expect(result.valid).toBeTrue();
    expect(result.errors).toEqual([]);
  });

  it('rejects a missing product', () => {
    const result = validatePaymentProduct(null);
    expect(result.valid).toBeFalse();
    expect(result.errors).toContain('Product is required.');
  });

  it('rejects an amount that is not greater than 0', () => {
    const result = validatePaymentProduct({ ...SAMPLE_PRODUCT, amount: 0 });
    expect(result.valid).toBeFalse();
    expect(result.errors.some((error) => error.includes('amount'))).toBeTrue();
  });

  it('rejects a negative amount', () => {
    const result = validatePaymentProduct({ ...SAMPLE_PRODUCT, amount: -5 });
    expect(result.valid).toBeFalse();
  });

  it('rejects a non-ISO currency code', () => {
    const result = validatePaymentProduct({ ...SAMPLE_PRODUCT, currency: 'usd' });
    expect(result.valid).toBeFalse();
    expect(result.errors.some((error) => error.includes('currency'))).toBeTrue();
  });
});
