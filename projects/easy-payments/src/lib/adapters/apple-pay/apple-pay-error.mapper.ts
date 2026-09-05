import { PaymentError } from '../../errors/payment-error';

/**
 * Maps Stripe / Apple Pay wallet errors to customer-safe PaymentError.
 * Never surfaces Apple payment tokens or raw Stripe JSON.
 */
export function mapApplePayError(
  error: unknown,
  fallbackCode: PaymentError['code'] = 'PAYMENT_FAILED',
  fallbackMessage = 'Apple Pay payment failed.',
): PaymentError {
  if (error instanceof PaymentError) {
    return error;
  }

  const stripeLike = error as {
    type?: string;
    code?: string;
    message?: string;
    decline_code?: string;
  } | null;

  const message =
    typeof stripeLike?.message === 'string' && stripeLike.message.trim()
      ? stripeLike.message.trim()
      : fallbackMessage;

  const code = stripeLike?.code?.toLowerCase() ?? '';
  const type = stripeLike?.type?.toLowerCase() ?? '';

  if (
    code === 'canceled' ||
    code === 'cancelled' ||
    type === 'canceled' ||
    /cancel/i.test(message)
  ) {
    return new PaymentError({
      code: 'PAYMENT_CANCELLED',
      message: 'Apple Pay was cancelled.',
      method: 'apple-pay',
      provider: 'applePay',
      originalError: error,
    });
  }

  return new PaymentError({
    code: fallbackCode,
    message,
    method: 'apple-pay',
    provider: 'applePay',
    originalError: error,
  });
}
