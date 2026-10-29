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
  /**
   * Host backdrop (maps to `--ep-background` on `<easy-payments>`).
   * Use `'transparent'` to keep the host clear. Independent of `appearance`.
   */
  backgroundColor?: string;
  /**
   * EP-owned surface fill (maps to `--ep-surface`): default shell card, tiles,
   * and other solid panels. With `appearance="transparent"`, the outer shell
   * stays clear; tiles/panels still use this surface.
   */
  surfaceColor?: string;
  /**
   * Accent / selection / focus hue (maps to `--ep-accent`, `--ep-focus`, and a
   * derived `--ep-accent-soft`). Does not recolor provider logos or SDK chrome.
   */
  accentColor?: string;
  /**
   * Outer corner radius (maps to `--ep-radius`). Inner EP controls use
   * `--ep-radius-md` derived as `calc(var(--ep-radius) * 0.625)`.
   */
  borderRadius?: string;
  /**
   * Spacing scale (maps to `--ep-spacing`). Shell padding uses `--ep-padding`
   * (`calc(var(--ep-spacing) * 1.25)`).
   */
  spacing?: string;
}
