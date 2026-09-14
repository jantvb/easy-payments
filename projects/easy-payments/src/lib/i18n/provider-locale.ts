import type { EasyPaymentsResolvedLocale } from './locale.types';

/**
 * Stripe.js Elements `locale` option.
 * @see https://docs.stripe.com/js/appendix/supported_locales
 */
export function toStripeElementsLocale(locale: EasyPaymentsResolvedLocale): string {
  switch (locale) {
    case 'es':
      return 'es';
    case 'pt':
      return 'pt-BR';
    case 'en':
    default:
      return 'en';
  }
}

/**
 * PayPal JS SDK `locale` query parameter (underscore form).
 * @see https://developer.paypal.com/sdk/js/configuration/#locale
 */
export function toPayPalSdkLocale(locale: EasyPaymentsResolvedLocale): string {
  switch (locale) {
    case 'es':
      return 'es_ES';
    case 'pt':
      return 'pt_BR';
    case 'en':
    default:
      return 'en_US';
  }
}

/**
 * Klarna / Affirm purchase locale hints when driving Stripe Payment Element.
 */
export function toStripeBnplLocale(locale: EasyPaymentsResolvedLocale): string {
  switch (locale) {
    case 'es':
      return 'es-ES';
    case 'pt':
      return 'pt-BR';
    case 'en':
    default:
      return 'en-US';
  }
}
