import { PaymentMethod, PaymentProviderName } from '../models';

export type PaymentErrorCode =
  | 'CONFIG_MISSING'
  | 'CONFIG_INVALID'
  | 'PRODUCT_INVALID'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'PAYMENT_CANCELLED'
  | 'PAYMENT_FAILED'
  | 'CARD_DECLINED'
  | 'AUTHENTICATION_REQUIRED'
  | 'AUTHENTICATION_FAILED'
  | 'NETWORK_ERROR'
  | 'SDK_LOAD_FAILED'
  | 'BACKEND_ERROR'
  | 'PROVIDER_NOT_IMPLEMENTED'
  | 'UNKNOWN';

export class PaymentError extends Error {
  readonly code: PaymentErrorCode;
  readonly method?: PaymentMethod;
  readonly provider?: PaymentProviderName;
  readonly originalError?: unknown;

  constructor(options: {
    code: PaymentErrorCode;
    message: string;
    method?: PaymentMethod;
    provider?: PaymentProviderName;
    originalError?: unknown;
  }) {
    super(options.message);
    this.name = 'PaymentError';
    this.code = options.code;
    this.method = options.method;
    this.provider = options.provider;
    this.originalError = options.originalError;
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      method: this.method,
      provider: this.provider,
    };
  }
}

export function normalizeError(
  error: unknown,
  fallback: { method?: PaymentMethod; provider?: PaymentProviderName } = {},
): PaymentError {
  if (error instanceof PaymentError) {
    return error;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('cancel')) {
      return new PaymentError({
        code: 'PAYMENT_CANCELLED',
        message: error.message,
        method: fallback.method,
        provider: fallback.provider,
        originalError: error,
      });
    }

    return new PaymentError({
      code: 'PAYMENT_FAILED',
      message: error.message,
      method: fallback.method,
      provider: fallback.provider,
      originalError: error,
    });
  }

  return new PaymentError({
    code: 'UNKNOWN',
    message: 'An unexpected payment error occurred.',
    method: fallback.method,
    provider: fallback.provider,
    originalError: error,
  });
}
