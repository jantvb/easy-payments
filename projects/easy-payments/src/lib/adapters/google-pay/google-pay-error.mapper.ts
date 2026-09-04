import { PaymentError, PaymentErrorCode } from '../../errors/payment-error';
import { mapStripeError } from '../stripe/stripe-error.mapper';

/**
 * Maps Google Pay / Stripe-from-Google-Pay failures into PaymentError.
 */
export function mapGooglePayError(
  error: unknown,
  fallbackCode: PaymentErrorCode = 'PAYMENT_FAILED',
  fallbackMessage = 'Google Pay payment failed.',
): PaymentError {
  if (error instanceof PaymentError) {
    if (error.method === 'google-pay' && error.provider === 'googlePay') {
      return error;
    }
    return new PaymentError({
      code: error.code,
      message: error.message,
      method: 'google-pay',
      provider: 'googlePay',
      originalError: error.originalError ?? error,
    });
  }

  const statusCode =
    typeof error === 'object' && error !== null && 'statusCode' in error
      ? String((error as { statusCode?: string }).statusCode ?? '')
      : '';

  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : typeof error === 'object' &&
            error !== null &&
            'statusMessage' in error &&
            typeof (error as { statusMessage?: string }).statusMessage === 'string'
          ? String((error as { statusMessage: string }).statusMessage)
          : fallbackMessage;

  const lower = `${statusCode} ${message}`.toLowerCase();

  if (
    statusCode === 'CANCELED' ||
    lower.includes('cancel') ||
    lower.includes('closed') ||
    lower.includes('dismiss')
  ) {
    return new PaymentError({
      code: 'PAYMENT_CANCELLED',
      message: 'Google Pay checkout was cancelled.',
      method: 'google-pay',
      provider: 'googlePay',
      originalError: error,
    });
  }

  if (statusCode === 'DEVELOPER_ERROR' || lower.includes('developer_error')) {
    return new PaymentError({
      code: 'CONFIG_INVALID',
      message: message || 'Google Pay request was rejected (developer configuration error).',
      method: 'google-pay',
      provider: 'googlePay',
      originalError: error,
    });
  }

  if (lower.includes('sdk') || lower.includes('script') || lower.includes('paymentsclient')) {
    return new PaymentError({
      code: 'SDK_LOAD_FAILED',
      message: 'Google Pay SDK failed to load.',
      method: 'google-pay',
      provider: 'googlePay',
      originalError: error,
    });
  }

  // Stripe processing errors from confirmCardPayment / createPaymentMethod
  if (
    typeof error === 'object' &&
    error !== null &&
    ('type' in error || 'decline_code' in error || 'payment_intent' in error)
  ) {
    const stripeMapped = mapStripeError(error);
    return new PaymentError({
      code: stripeMapped.code,
      message: stripeMapped.message,
      method: 'google-pay',
      provider: 'googlePay',
      originalError: stripeMapped.originalError ?? error,
    });
  }

  return new PaymentError({
    code: fallbackCode,
    message: message || fallbackMessage,
    method: 'google-pay',
    provider: 'googlePay',
    originalError: error,
  });
}
