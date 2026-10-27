import { PaymentError } from '../errors/payment-error';
import {
  MERCHANT_METADATA_LIMITS,
  MERCHANT_METADATA_RESERVED_KEYS,
  PAYPAL_ORDER_REFERENCE_MAX_LENGTH,
  assertMerchantMetadata,
  assertPayPalOrderReference,
  buildStripeRequestMetadata,
  merchantMetadataSessionPart,
  validateMerchantMetadata,
} from './merchant-metadata';

const RESERVED_KEY_LIST = [
  'amount',
  'authorization',
  'cardnumber',
  'catalogunitamount',
  'clientsecret',
  'constructor',
  'currency',
  'cvc',
  'cvv',
  'pan',
  'password',
  'paymentmethod',
  'productid',
  'prototype',
  'provider',
  'quantity',
  'secret',
  'secretkey',
  'source',
  'token',
  'trustedunitamount',
  'unitamount',
  '__proto__',
].join(',');

describe('validateMerchantMetadata', () => {
  it('accepts omitted metadata', () => {
    expect(validateMerchantMetadata(undefined)).toEqual({ valid: true, errors: [] });
    expect(validateMerchantMetadata(null)).toEqual({ valid: true, errors: [] });
  });

  it('accepts a flat string map', () => {
    const result = validateMerchantMetadata({
      orderId: 'ORDER-12345',
      customerReference: 'CUSTOMER-789',
    });
    expect(result.valid).toBeTrue();
    expect(result.metadata).toEqual({
      orderId: 'ORDER-12345',
      customerReference: 'CUSTOMER-789',
    });
  });

  it('accepts the maximum entry count and key and value lengths', () => {
    const metadata: Record<string, string> = {};
    for (let index = 0; index < MERCHANT_METADATA_LIMITS.maxEntries; index += 1) {
      const key = `k${index}`.padEnd(MERCHANT_METADATA_LIMITS.maxKeyLength, 'x');
      metadata[key] = 'v'.repeat(MERCHANT_METADATA_LIMITS.maxValueLength);
    }
    expect(validateMerchantMetadata(metadata).valid).toBeTrue();
  });

  it('rejects more than 10 entries without truncating', () => {
    const metadata: Record<string, string> = {};
    for (let index = 0; index < MERCHANT_METADATA_LIMITS.maxEntries + 1; index += 1) {
      metadata[`key${index}`] = 'value';
    }
    const result = validateMerchantMetadata(metadata);
    expect(result.valid).toBeFalse();
    expect(result.metadata).toBeUndefined();
    expect(result.errors).toEqual(['Merchant metadata exceeds the maximum of 10 entries.']);
  });

  it('rejects an empty key and an overlong key', () => {
    expect(validateMerchantMetadata({ '': 'value' }).errors).toContain(
      'Merchant metadata contains an empty key.',
    );
    const longKey = 'a'.repeat(MERCHANT_METADATA_LIMITS.maxKeyLength + 1);
    expect(validateMerchantMetadata({ [longKey]: 'value' }).errors).toContain(
      'Merchant metadata contains an invalid key.',
    );
  });

  it('rejects unsupported, nested, and empty values without echoing them', () => {
    const nested = { orderId: { id: 'SECRET-NESTED' } };
    const result = validateMerchantMetadata(nested);
    expect(result.valid).toBeFalse();
    expect(result.errors).toContain('Merchant metadata values must be strings.');
    expect(result.errors.join(' ')).not.toContain('SECRET-NESTED');

    expect(validateMerchantMetadata(['ORDER-1']).errors).toContain(
      'Merchant metadata must be a flat map of strings.',
    );
    expect(validateMerchantMetadata({ orderId: 12 }).errors).toContain(
      'Merchant metadata values must be strings.',
    );
    expect(validateMerchantMetadata({ orderId: '   ' }).errors).toContain(
      'Merchant metadata values must be non-empty strings.',
    );
    const longValue = 'v'.repeat(MERCHANT_METADATA_LIMITS.maxValueLength + 1);
    expect(validateMerchantMetadata({ orderId: longValue }).errors).toContain(
      'Merchant metadata values must be at most 500 characters.',
    );
    expect(validateMerchantMetadata({ orderId: longValue }).errors.join(' ')).not.toContain(longValue);
  });

  it('rejects reserved keys and unsafe values without echoing them', () => {
    expect(MERCHANT_METADATA_RESERVED_KEYS.join(',')).toBe(RESERVED_KEY_LIST);
    expect(validateMerchantMetadata({ productId: 'other-plan' }).errors).toContain(
      'Merchant metadata contains a reserved key.',
    );
    expect(validateMerchantMetadata({ SOURCE: 'web-checkout' }).errors).toContain(
      'Merchant metadata contains a reserved key.',
    );

    const secret = ['sk', '_test_', 'example'].join('');
    const unsafe = validateMerchantMetadata({ orderId: secret });
    expect(unsafe.valid).toBeFalse();
    expect(unsafe.errors).toContain('Merchant metadata contains an unsafe value.');
    expect(unsafe.errors.join(' ')).not.toContain(secret);
    expect(validateMerchantMetadata({ orderId: '4242424242424242' }).errors).toContain(
      'Merchant metadata contains an unsafe value.',
    );
  });

  it('throws a configuration error that omits the raw value', () => {
    const secret = ['rk', '_live_', 'example'].join('');
    try {
      assertMerchantMetadata({ token: secret }, 'card', 'stripe');
      fail('expected metadata to be rejected');
    } catch (error) {
      expect(error).toBeInstanceOf(PaymentError);
      expect((error as PaymentError).code).toBe('CONFIG_INVALID');
      expect((error as PaymentError).message).not.toContain(secret);
    }
  });

  it('keeps library checkout fields and merchant references together', () => {
    expect(
      buildStripeRequestMetadata(
        { orderId: 'ORDER-12345', checkoutMethod: 'card' },
        { checkoutMethod: 'apple-pay', productName: 'Premium Plan' },
        'apple-pay',
        'applePay',
      ),
    ).toEqual({
      orderId: 'ORDER-12345',
      checkoutMethod: 'apple-pay',
      productName: 'Premium Plan',
    });
  });

  it('rejects a PayPal order reference that exceeds 127 characters', () => {
    expect(() => assertPayPalOrderReference('a'.repeat(PAYPAL_ORDER_REFERENCE_MAX_LENGTH + 1))).toThrowError(
      PaymentError,
      'PayPal orderId metadata must be at most 127 characters.',
    );
  });

  it('changes the session identity when metadata changes and ignores browser globals', () => {
    expect(merchantMetadataSessionPart(undefined)).toBe('');
    expect(merchantMetadataSessionPart({ b: '2', a: '1' })).toBe(
      merchantMetadataSessionPart({ a: '1', b: '2' }),
    );
    expect(merchantMetadataSessionPart({ orderId: 'ORDER-1' })).not.toBe(
      merchantMetadataSessionPart({ orderId: 'ORDER-2' }),
    );
    expect(validateMerchantMetadata.toString()).not.toMatch(/\bwindow\b/);
    expect(validateMerchantMetadata.toString()).not.toMatch(/\bdocument\b/);
    expect(validateMerchantMetadata.toString()).not.toMatch(/\blocalStorage\b/);
  });

  it('does not collide session keys when a value contains metadata delimiters', () => {
    expect(merchantMetadataSessionPart({ a: '1&b=2' })).not.toBe(
      merchantMetadataSessionPart({ a: '1', b: '2' }),
    );
    expect(merchantMetadataSessionPart({ orderId: 'ORDER|123' })).not.toBe(
      merchantMetadataSessionPart({ orderId: 'ORDER', extra: '123' }),
    );
  });
});
