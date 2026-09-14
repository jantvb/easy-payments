import { localizePaymentError } from './localize-payment-error';
import { EN_TRANSLATIONS } from './en';
import { ES_TRANSLATIONS } from './es';
import { PT_TRANSLATIONS } from './pt';

describe('localizePaymentError', () => {
  it('never returns English diagnostics for Spanish locale codes', () => {
    expect(localizePaymentError('PAYMENT_FAILED', ES_TRANSLATIONS)).toBe(ES_TRANSLATIONS.errorBody);
    expect(localizePaymentError('CARD_DECLINED', ES_TRANSLATIONS)).toBe(
      ES_TRANSLATIONS.errorDetailCardDeclined,
    );
    expect(localizePaymentError('BACKEND_ERROR', ES_TRANSLATIONS)).toBe(
      ES_TRANSLATIONS.errorDetailBackend,
    );
    expect(localizePaymentError('PAYMENT_FAILED', ES_TRANSLATIONS)).not.toContain('Klarna');
  });

  it('localizes known codes for Portuguese', () => {
    expect(localizePaymentError('NETWORK_ERROR', PT_TRANSLATIONS)).toBe(
      PT_TRANSLATIONS.errorDetailNetwork,
    );
    expect(localizePaymentError('SDK_LOAD_FAILED', PT_TRANSLATIONS)).toBe(
      PT_TRANSLATIONS.errorDetailSdkLoad,
    );
  });

  it('falls back to errorBody for unknown / generic failures in English', () => {
    expect(localizePaymentError('UNKNOWN', EN_TRANSLATIONS)).toBe(EN_TRANSLATIONS.errorBody);
    expect(localizePaymentError(undefined, EN_TRANSLATIONS)).toBe(EN_TRANSLATIONS.errorBody);
  });
});
