import { BadRequestException } from '@nestjs/common';

export const MERCHANT_METADATA_LIMITS = {
  maxEntries: 10,
  maxKeyLength: 40,
  maxValueLength: 500,
} as const;

export const PAYPAL_ORDER_REFERENCE_MAX_LENGTH = 127;

/**
 * Keep this list identical to
 * `projects/easy-payments/src/lib/metadata/merchant-metadata.ts`.
 */
export const MERCHANT_METADATA_RESERVED_KEYS = [
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
] as const;

const KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,39}$/;

const MESSAGES = {
  shape: 'Merchant metadata must be a flat map of strings.',
  count: 'Merchant metadata exceeds the maximum of 10 entries.',
  emptyKey: 'Merchant metadata contains an empty key.',
  invalidKey: 'Merchant metadata contains an invalid key.',
  reservedKey: 'Merchant metadata contains a reserved key.',
  valueType: 'Merchant metadata values must be strings.',
  emptyValue: 'Merchant metadata values must be non-empty strings.',
  valueLength: 'Merchant metadata values must be at most 500 characters.',
  unsafeValue: 'Merchant metadata contains an unsafe value.',
  paypalLength: 'PayPal orderId metadata must be at most 127 characters.',
} as const;

export function acceptMerchantMetadata(metadata: unknown): Record<string, string> | undefined {
  if (metadata === undefined || metadata === null) {
    return undefined;
  }
  if (!isPlainObject(metadata)) {
    throw new BadRequestException(MESSAGES.shape);
  }

  const entries = Object.entries(metadata);
  if (entries.length > MERCHANT_METADATA_LIMITS.maxEntries) {
    throw new BadRequestException(MESSAGES.count);
  }

  const normalized: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (key.trim() === '') {
      throw new BadRequestException(MESSAGES.emptyKey);
    }
    if (!KEY_PATTERN.test(key)) {
      throw new BadRequestException(MESSAGES.invalidKey);
    }
    if ((MERCHANT_METADATA_RESERVED_KEYS as readonly string[]).includes(key.toLowerCase())) {
      throw new BadRequestException(MESSAGES.reservedKey);
    }
    if (typeof value !== 'string') {
      throw new BadRequestException(MESSAGES.valueType);
    }
    if (value.trim() === '') {
      throw new BadRequestException(MESSAGES.emptyValue);
    }
    if (value.length > MERCHANT_METADATA_LIMITS.maxValueLength) {
      throw new BadRequestException(MESSAGES.valueLength);
    }
    if (isUnsafeMetadataValue(value)) {
      throw new BadRequestException(MESSAGES.unsafeValue);
    }
    normalized[key] = value;
  }

  return normalized;
}

/**
 * Trusted server fields are applied last so browser metadata cannot override
 * product identity, amount, currency, or the demo source marker.
 */
export function mergePaymentIntentMetadata(
  clientMetadata: unknown,
  trusted: Record<string, string>,
): Record<string, string> {
  return {
    ...(acceptMerchantMetadata(clientMetadata) ?? {}),
    ...trusted,
  };
}

export function acceptPayPalOrderReference(orderReference: string | undefined): string | undefined {
  if (orderReference === undefined) {
    return undefined;
  }
  const value = orderReference;
  if (
    value.trim() === '' ||
    value.length > PAYPAL_ORDER_REFERENCE_MAX_LENGTH ||
    isUnsafeMetadataValue(value)
  ) {
    throw new BadRequestException(MESSAGES.paypalLength);
  }
  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isUnsafeMetadataValue(value: string): boolean {
  if (/[\u0000-\u001F\u007F]/.test(value)) {
    return true;
  }
  if (/(?:sk|rk)_(?:test|live)_/i.test(value)) {
    return true;
  }
  if (/bearer\s+\S+/i.test(value) || /client_secret/i.test(value)) {
    return true;
  }
  if (/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\./.test(value)) {
    return true;
  }
  const digits = value.replace(/[ -]/g, '');
  return /^\d{13,19}$/.test(digits);
}
