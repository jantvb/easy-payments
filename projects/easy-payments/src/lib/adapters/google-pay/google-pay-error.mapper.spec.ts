import { mapGooglePayError } from './google-pay-error.mapper';
import { PaymentError } from '../../errors/payment-error';

describe('mapGooglePayError', () => {
  it('normalizes Google Pay cancellation', () => {
    const error = mapGooglePayError({ statusCode: 'CANCELED', statusMessage: 'closed' });
    expect(error.code).toBe('PAYMENT_CANCELLED');
    expect(error.method).toBe('google-pay');
    expect(error.provider).toBe('googlePay');
  });

  it('normalizes developer errors', () => {
    const error = mapGooglePayError({ statusCode: 'DEVELOPER_ERROR', statusMessage: 'bad request' });
    expect(error.code).toBe('CONFIG_INVALID');
  });

  it('preserves PaymentError with google-pay method', () => {
    const original = new PaymentError({
      code: 'SDK_LOAD_FAILED',
      message: 'boom',
      method: 'google-pay',
      provider: 'googlePay',
    });
    expect(mapGooglePayError(original)).toBe(original);
  });
});
