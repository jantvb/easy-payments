import { resolveMessages } from './resolve-messages';
import { EN_TRANSLATIONS } from './en';
import { ES_TRANSLATIONS } from './es';
import { PT_TRANSLATIONS } from './pt';
import { interpolate } from './translations.types';
import {
  toPayPalSdkLocale,
  toStripeBnplLocale,
  toStripeElementsLocale,
} from './provider-locale';
import { formatMoney } from '../utils/format-money';

describe('resolveMessages', () => {
  it('returns English dictionary for en', () => {
    expect(resolveMessages('en').successTitle).toBe(EN_TRANSLATIONS.successTitle);
  });

  it('returns Spanish dictionary for es', () => {
    expect(resolveMessages('es').successTitle).toBe(ES_TRANSLATIONS.successTitle);
    expect(resolveMessages('es').payWithCard).toBe(ES_TRANSLATIONS.payWithCard);
  });

  it('returns Portuguese dictionary for pt', () => {
    expect(resolveMessages('pt').successTitle).toBe(PT_TRANSLATIONS.successTitle);
  });

  it('applies partial custom overrides with locale fallback for remaining keys', () => {
    const messages = resolveMessages('es', {
      successTitle: '¡Pedido confirmado!',
      successContinue: 'Seguir',
    });
    expect(messages.successTitle).toBe('¡Pedido confirmado!');
    expect(messages.successContinue).toBe('Seguir');
    expect(messages.errorTitle).toBe(ES_TRANSLATIONS.errorTitle);
  });

  it('ignores blank override values and keeps dictionary text', () => {
    const messages = resolveMessages('en', { successTitle: '   ' });
    expect(messages.successTitle).toBe(EN_TRANSLATIONS.successTitle);
  });
});

describe('interpolate', () => {
  it('replaces tokens', () => {
    expect(interpolate('Pay {{amount}} with {{method}}', { amount: '$10.00', method: 'Card' })).toBe(
      'Pay $10.00 with Card',
    );
  });
});

describe('provider-locale mappers', () => {
  it('maps Stripe Elements locales', () => {
    expect(toStripeElementsLocale('en')).toBe('en');
    expect(toStripeElementsLocale('es')).toBe('es');
    expect(toStripeElementsLocale('pt')).toBe('pt-BR');
  });

  it('maps PayPal SDK locales', () => {
    expect(toPayPalSdkLocale('en')).toBe('en_US');
    expect(toPayPalSdkLocale('es')).toBe('es_ES');
    expect(toPayPalSdkLocale('pt')).toBe('pt_BR');
  });

  it('maps BNPL locale hints', () => {
    expect(toStripeBnplLocale('en')).toBe('en-US');
    expect(toStripeBnplLocale('es')).toBe('es-ES');
    expect(toStripeBnplLocale('pt')).toBe('pt-BR');
  });
});

describe('formatMoney locale formatting', () => {
  it('keeps currency code while changing formatting locale', () => {
    const en = formatMoney(99, 'USD', 1, 'en');
    const es = formatMoney(99, 'USD', 1, 'es');
    expect(en).toContain('99');
    expect(es).toContain('99');
    // Both remain USD — no conversion.
    expect(en.toUpperCase()).toMatch(/USD|\$/);
    expect(es.toUpperCase()).toMatch(/USD|\$|US\$/);
  });
});
