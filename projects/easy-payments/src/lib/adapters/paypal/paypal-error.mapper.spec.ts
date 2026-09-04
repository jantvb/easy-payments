import { mapPayPalError } from './paypal-error.mapper';
import { PaymentError } from '../../errors/payment-error';

describe('mapPayPalError', () => {
  it('preserves PaymentError instances', () => {
    const original = new PaymentError({
      code: 'BACKEND_ERROR',
      message: 'boom',
      method: 'paypal',
      provider: 'paypal',
    });
    expect(mapPayPalError(original)).toBe(original);
  });

  it('normalizes cancellation / popup closed', () => {
    const error = mapPayPalError(new Error('Popup closed by user'));
    expect(error.code).toBe('PAYMENT_CANCELLED');
    expect(error.method).toBe('paypal');
  });

  it('normalizes network failures', () => {
    expect(mapPayPalError(new Error('network timeout')).code).toBe('NETWORK_ERROR');
  });

  it('normalizes declined payments', () => {
    expect(mapPayPalError(new Error('INSTRUMENT_DECLINED')).code).toBe('PAYMENT_FAILED');
  });
});
