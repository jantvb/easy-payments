import { PaymentError, PaymentErrorCode } from '../../errors/payment-error';

export interface StripeLikeError {
  type?: string;
  code?: string;
  decline_code?: string;
  message?: string;
  payment_intent?: { status?: string };
}

export function mapStripeError(error: unknown): PaymentError {
  if (error instanceof PaymentError) {
    return error;
  }

  const stripeError = (error ?? {}) as StripeLikeError;
  const message = stripeError.message?.trim() || 'Stripe payment failed.';
  const code = (stripeError.code ?? '').toLowerCase();
  const type = (stripeError.type ?? '').toLowerCase();
  const decline = (stripeError.decline_code ?? '').toLowerCase();

  if (
    code === 'payment_intent_authentication_failure' ||
    (type === 'invalid_request_error' && message.toLowerCase().includes('authenticat'))
  ) {
    return new PaymentError({
      code: 'AUTHENTICATION_FAILED',
      message: message || 'Payment authentication failed.',
      method: 'card',
      provider: 'stripe',
      originalError: error,
    });
  }

  if (
    code.includes('authentication') ||
    message.toLowerCase().includes('authentication required')
  ) {
    return new PaymentError({
      code: 'AUTHENTICATION_REQUIRED',
      message,
      method: 'card',
      provider: 'stripe',
      originalError: error,
    });
  }

  if (
    type === 'card_error' ||
    decline ||
    code === 'card_declined' ||
    code === 'insufficient_funds' ||
    code === 'expired_card' ||
    code === 'incorrect_cvc'
  ) {
    return new PaymentError({
      code: 'CARD_DECLINED',
      message,
      method: 'card',
      provider: 'stripe',
      originalError: error,
    });
  }

  if (
    code === 'canceled' ||
    message.toLowerCase().includes('cancel') ||
    stripeError.payment_intent?.status === 'canceled'
  ) {
    return new PaymentError({
      code: 'PAYMENT_CANCELLED',
      message,
      method: 'card',
      provider: 'stripe',
      originalError: error,
    });
  }

  if (type === 'api_connection_error' || message.toLowerCase().includes('network')) {
    return new PaymentError({
      code: 'NETWORK_ERROR',
      message: 'A network error occurred while contacting Stripe.',
      method: 'card',
      provider: 'stripe',
      originalError: error,
    });
  }

  let mapped: PaymentErrorCode = 'PAYMENT_FAILED';
  if (type === 'invalid_request_error') {
    mapped = 'CONFIG_INVALID';
  }

  return new PaymentError({
    code: mapped,
    message,
    method: 'card',
    provider: 'stripe',
    originalError: error,
  });
}
