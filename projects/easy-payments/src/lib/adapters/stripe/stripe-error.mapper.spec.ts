import { mapStripeError } from './stripe-error.mapper';
import { PaymentError } from '../../errors/payment-error';

describe('mapStripeError', () => {
  it('maps card declines', () => {
    const error = mapStripeError({
      type: 'card_error',
      code: 'card_declined',
      message: 'Your card was declined.',
    });
    expect(error).toBeInstanceOf(PaymentError);
    expect(error.code).toBe('CARD_DECLINED');
    expect(error.method).toBe('card');
    expect(error.provider).toBe('stripe');
  });

  it('maps authentication failures', () => {
    const error = mapStripeError({
      code: 'payment_intent_authentication_failure',
      message: 'Authentication failed.',
    });
    expect(error.code).toBe('AUTHENTICATION_FAILED');
  });

  it('maps authentication required messaging', () => {
    const error = mapStripeError({
      message: 'Authentication required to complete payment.',
    });
    expect(error.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('maps cancellations', () => {
    const error = mapStripeError({
      code: 'canceled',
      message: 'Payment canceled by customer.',
    });
    expect(error.code).toBe('PAYMENT_CANCELLED');
  });

  it('maps network-style errors', () => {
    const error = mapStripeError({
      type: 'api_connection_error',
      message: 'Network failed',
    });
    expect(error.code).toBe('NETWORK_ERROR');
  });

  it('passes through existing PaymentError instances', () => {
    const original = new PaymentError({
      code: 'BACKEND_ERROR',
      message: 'Nope',
      method: 'card',
      provider: 'stripe',
    });
    expect(mapStripeError(original)).toBe(original);
  });
});
