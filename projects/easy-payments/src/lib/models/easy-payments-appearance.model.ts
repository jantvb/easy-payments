/**
 * Outer visual shell for `<easy-payments>`.
 *
 * Independent of {@link PaymentTheme}: theme controls colors; appearance controls
 * whether the built-in card/container chrome is drawn around the checkout.
 *
 * - `default` — built-in surface, border, radius, padding, and shadow (backward compatible).
 * - `transparent` — no outer shell so the merchant parent background shows through.
 */
export type EasyPaymentsAppearance = 'default' | 'transparent';
