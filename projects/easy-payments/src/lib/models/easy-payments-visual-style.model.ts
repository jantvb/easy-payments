/**
 * Optional visual overrides for Easy Payments–owned UI.
 *
 * Independent of {@link PaymentTheme} and {@link EasyPaymentsAppearance}.
 * Omitted or invalid fields leave the built-in light/dark tokens unchanged.
 * Does not restyle official provider SDK chrome (Stripe Elements, PayPal,
 * Apple Pay, Google Pay buttons, or provider marks).
 */
export interface EasyPaymentsVisualStyle {
  /**
   * CSS `font-family` list for Easy Payments–owned text, or `'inherit'` to use
   * the host application's font. Default: library Segoe UI / system stack.
   */
  fontFamily?: string;
  /** Primary text color (maps to `--ep-text`). */
  textColor?: string;
  /** Secondary / muted text color (maps to `--ep-text-secondary`). */
  textSecondaryColor?: string;
  /** Host / page background token (maps to `--ep-background`). */
  backgroundColor?: string;
  /** Checkout surface / card background (maps to `--ep-surface`). */
  surfaceColor?: string;
  /** Accent / selection / focus hue (maps to `--ep-accent` and `--ep-focus`). */
  accentColor?: string;
  /** Corner radius CSS length (maps to `--ep-radius` and `--ep-radius-md`). */
  borderRadius?: string;
  /** Spacing scale CSS length (maps to `--ep-spacing`). */
  spacing?: string;
}
