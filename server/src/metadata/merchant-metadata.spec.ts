import { BadRequestException } from '@nestjs/common';
import {
  MERCHANT_METADATA_LIMITS,
  MERCHANT_METADATA_RESERVED_KEYS,
  acceptMerchantMetadata,
  acceptPayPalOrderReference,
  mergePaymentIntentMetadata,
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

describe('merchant metadata', () => {
  it('keeps the same limits and reserved keys as the Angular library', () => {
    expect(MERCHANT_METADATA_LIMITS).toEqual({
      maxEntries: 10,
      maxKeyLength: 40,
      maxValueLength: 500,
    });
    expect(MERCHANT_METADATA_RESERVED_KEYS.join(',')).toBe(RESERVED_KEY_LIST);
  });

  it('accepts omitted and valid metadata', () => {
    expect(acceptMerchantMetadata(undefined)).toBeUndefined();
    expect(
      acceptMerchantMetadata({
        orderId: 'ORDER-12345',
        customerReference: 'CUSTOMER-789',
      }),
    ).toEqual({
      orderId: 'ORDER-12345',
      customerReference: 'CUSTOMER-789',
    });
  });

  it('rejects empty keys, unsupported types, nested values, and unsafe values', () => {
    expect(() => acceptMerchantMetadata({ '': 'x' })).toThrow(BadRequestException);
    expect(() => acceptMerchantMetadata({ orderId: { nested: true } })).toThrow(
      'Merchant metadata values must be strings.',
    );
    expect(() => acceptMerchantMetadata(['ORDER-1'])).toThrow(
      'Merchant metadata must be a flat map of strings.',
    );
    const secret = ['sk', '_test_', 'example'].join('');
    expect(() => acceptMerchantMetadata({ orderId: secret })).toThrow(
      'Merchant metadata contains an unsafe value.',
    );
    try {
      acceptMerchantMetadata({ orderId: secret });
    } catch (error) {
      expect((error as BadRequestException).message).not.toContain(secret);
    }
  });

  it('rejects reserved keys and lets trusted server metadata win', () => {
    expect(() => acceptMerchantMetadata({ productId: 'evil-plan', amount: '1' })).toThrow(
      'Merchant metadata contains a reserved key.',
    );

    expect(
      mergePaymentIntentMetadata(
        { orderId: 'ORDER-12345', productName: 'Browser name' },
        {
          productId: 'premium-plan',
          quantity: '1',
          source: 'easy-payments-demo',
          unitAmount: '99',
        },
      ),
    ).toEqual({
      orderId: 'ORDER-12345',
      productName: 'Browser name',
      productId: 'premium-plan',
      quantity: '1',
      source: 'easy-payments-demo',
      unitAmount: '99',
    });
  });

  it('does not truncate an overlong PayPal order reference', () => {
    expect(() => acceptPayPalOrderReference('a'.repeat(128))).toThrow(
      'PayPal orderId metadata must be at most 127 characters.',
    );
    expect(acceptPayPalOrderReference('ORDER-12345')).toBe('ORDER-12345');
  });
});
