import {
  DEFAULT_CHECKOUT_MAX_WIDTH,
  MAX_CHECKOUT_WIDTH,
  MIN_CHECKOUT_WIDTH,
  resolveCheckoutMaxWidth,
} from './checkout-layout';

describe('resolveCheckoutMaxWidth', () => {
  it('defaults when value is missing or unusable', () => {
    expect(resolveCheckoutMaxWidth(undefined)).toBe(DEFAULT_CHECKOUT_MAX_WIDTH);
    expect(resolveCheckoutMaxWidth(null)).toBe(DEFAULT_CHECKOUT_MAX_WIDTH);
    expect(resolveCheckoutMaxWidth('')).toBe(DEFAULT_CHECKOUT_MAX_WIDTH);
    expect(resolveCheckoutMaxWidth('abc')).toBe(DEFAULT_CHECKOUT_MAX_WIDTH);
    expect(resolveCheckoutMaxWidth(Number.NaN)).toBe(DEFAULT_CHECKOUT_MAX_WIDTH);
    expect(resolveCheckoutMaxWidth(0)).toBe(DEFAULT_CHECKOUT_MAX_WIDTH);
    expect(resolveCheckoutMaxWidth(-40)).toBe(DEFAULT_CHECKOUT_MAX_WIDTH);
  });

  it('clamps below the supported minimum', () => {
    expect(resolveCheckoutMaxWidth(200)).toBe(MIN_CHECKOUT_WIDTH);
    expect(resolveCheckoutMaxWidth('280')).toBe(MIN_CHECKOUT_WIDTH);
  });

  it('clamps above the supported maximum', () => {
    expect(resolveCheckoutMaxWidth(3000)).toBe(MAX_CHECKOUT_WIDTH);
    expect(resolveCheckoutMaxWidth('2500')).toBe(MAX_CHECKOUT_WIDTH);
  });

  it('accepts valid values in range', () => {
    expect(resolveCheckoutMaxWidth(640)).toBe(640);
    expect(resolveCheckoutMaxWidth(900)).toBe(900);
    expect(resolveCheckoutMaxWidth('1100')).toBe(1100);
  });

  it('rounds fractional pixel values', () => {
    expect(resolveCheckoutMaxWidth(640.6)).toBe(641);
  });
});
