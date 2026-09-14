/**
 * Public locale API for Easy Payments v1.1.0.
 * `auto` resolves from the browser when available; otherwise English.
 */
export type EasyPaymentsLocale = 'auto' | 'en' | 'es' | 'pt';

/** Resolved dictionary locale (never `auto`). */
export type EasyPaymentsResolvedLocale = 'en' | 'es' | 'pt';

export const EASY_PAYMENTS_SUPPORTED_LOCALES: readonly EasyPaymentsResolvedLocale[] = [
  'en',
  'es',
  'pt',
] as const;

export const EASY_PAYMENTS_DEFAULT_LOCALE: EasyPaymentsLocale = 'auto';
