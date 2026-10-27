import { PaymentError } from '../errors/payment-error';
import { PaymentMethod, PaymentProviderName } from '../models';

/**
 * Flat merchant metadata supplied on `PaymentProduct.metadata`.
 * This is not `PaymentResult.metadata`.
 */
export type EasyPaymentsMerchantMetadata = Record<string, string>;

export const MERCHANT_METADATA_LIMITS = {
  maxEntries: 10,
  maxKeyLength: 40,
  maxValueLength: 500,
} as const;

/** PayPal `custom_id` limit. Only `orderId` is mapped, and it is never truncated. */
export const PAYPAL_ORDER_REFERENCE_MAX_LENGTH = 127;

export const PAYPAL_ORDER_REFERENCE_KEY = 'orderId';

/**
 * Keys the browser must not set. Server-owned payment fields are written
 * after merchant metadata and always win if a caller bypasses this list.
 * Keep this list identical to `server/src/metadata/merchant-metadata.ts`.
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

export interface MerchantMetadataValidationResult {
  valid: boolean;
  errors: string[];
  metadata?: EasyPaymentsMerchantMetadata;
}

export function validateMerchantMetadata(metadata: unknown): MerchantMetadataValidationResult {
  if (metadata === undefined || metadata === null) {
    return { valid: true, errors: [] };
  }

  if (!isPlainObject(metadata)) {
    return { valid: false, errors: [MESSAGES.shape] };
  }

  const entries = Object.entries(metadata);
  if (entries.length > MERCHANT_METADATA_LIMITS.maxEntries) {
    return { valid: false, errors: [MESSAGES.count] };
  }

  const errors: string[] = [];
  const normalized: EasyPaymentsMerchantMetadata = {};

  for (const [key, value] of entries) {
    if (key.trim() === '') {
      pushError(errors, MESSAGES.emptyKey);
      continue;
    }
    if (!KEY_PATTERN.test(key)) {
      pushError(errors, MESSAGES.invalidKey);
      continue;
    }
    if (isReservedMerchantMetadataKey(key)) {
      pushError(errors, MESSAGES.reservedKey);
      continue;
    }
    if (typeof value !== 'string') {
      pushError(errors, MESSAGES.valueType);
      continue;
    }
    if (value.trim() === '') {
      pushError(errors, MESSAGES.emptyValue);
      continue;
    }
    if (value.length > MERCHANT_METADATA_LIMITS.maxValueLength) {
      pushError(errors, MESSAGES.valueLength);
      continue;
    }
    if (isUnsafeMetadataValue(value)) {
      pushError(errors, MESSAGES.unsafeValue);
      continue;
    }
    normalized[key] = value;
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, errors: [], metadata: normalized };
}

export function assertMerchantMetadata(
  metadata: unknown,
  method?: PaymentMethod,
  provider?: PaymentProviderName,
): EasyPaymentsMerchantMetadata | undefined {
  const result = validateMerchantMetadata(metadata);
  if (!result.valid) {
    throw new PaymentError({
      code: 'CONFIG_INVALID',
      message: result.errors[0] ?? MESSAGES.shape,
      method,
      provider,
    });
  }
  return result.metadata;
}

export function assertPayPalOrderReference(
  orderReference: string,
  method: PaymentMethod = 'paypal',
  provider: PaymentProviderName = 'paypal',
): string {
  if (
    orderReference.length > PAYPAL_ORDER_REFERENCE_MAX_LENGTH ||
    orderReference.trim() === '' ||
    isUnsafeMetadataValue(orderReference)
  ) {
    throw new PaymentError({
      code: 'CONFIG_INVALID',
      message: MESSAGES.paypalLength,
      method,
      provider,
    });
  }
  return orderReference;
}

/**
 * Library-added fields (product name, checkout method) are omitted when they
 * fail the same value rules. They are not truncated. When a library field is
 * accepted, it replaces a merchant entry of the same key.
 */
export function buildStripeRequestMetadata(
  merchant: unknown,
  libraryFields: Record<string, string | undefined>,
  method?: PaymentMethod,
  provider?: PaymentProviderName,
): EasyPaymentsMerchantMetadata | undefined {
  const validated = assertMerchantMetadata(merchant, method, provider) ?? {};
  const merged: EasyPaymentsMerchantMetadata = { ...validated };

  for (const [key, value] of Object.entries(libraryFields)) {
    if (value === undefined) {
      continue;
    }
    if (isReservedMerchantMetadataKey(key) || !isAcceptableLibraryValue(value)) {
      continue;
    }
    merged[key] = value;
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
}

export function merchantMetadataSessionPart(
  metadata: Record<string, string> | undefined,
): string {
  if (!metadata) {
    return '';
  }
  // Encode so values containing `&`, `=`, or `|` cannot collide with another map.
  return Object.keys(metadata)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(metadata[key])}`)
    .join('&');
}

export function appendMetadataSessionPart(
  base: string,
  metadata: Record<string, string> | undefined,
): string {
  const part = merchantMetadataSessionPart(metadata);
  return part ? `${base}|${part}` : base;
}

export function isReservedMerchantMetadataKey(key: string): boolean {
  return (MERCHANT_METADATA_RESERVED_KEYS as readonly string[]).includes(key.toLowerCase());
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isAcceptableLibraryValue(value: string): boolean {
  return (
    value.trim() !== '' &&
    value.length <= MERCHANT_METADATA_LIMITS.maxValueLength &&
    !isUnsafeMetadataValue(value)
  );
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

function pushError(errors: string[], message: string): void {
  if (!errors.includes(message)) {
    errors.push(message);
  }
}
