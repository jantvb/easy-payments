/**
 * Checkout width limits for the embeddable <easy-payments> component.
 *
 * Consumers control overall checkout size via [maxWidth].
 * The library clamps to these bounds and decides internal grid columns
 * from the component's own container width (not the viewport).
 */
export const MIN_CHECKOUT_WIDTH = 320;
export const DEFAULT_CHECKOUT_MAX_WIDTH = 640;
export const MAX_CHECKOUT_WIDTH = 1200;

/**
 * Internal planning constant for payment tiles (not a public API).
 * Used to reason about container-query breakpoints; tiles remain equal-width
 * within each row via CSS Grid.
 */
export const MIN_PAYMENT_TILE_WIDTH = 112;

/**
 * Normalize a consumer [maxWidth] value into a safe pixel max-width.
 * Invalid / missing values fall back to the default.
 */
export function resolveCheckoutMaxWidth(
  value: number | string | null | undefined,
): number {
  if (value === null || value === undefined || value === '') {
    return DEFAULT_CHECKOUT_MAX_WIDTH;
  }

  const numeric = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return DEFAULT_CHECKOUT_MAX_WIDTH;
  }

  return Math.min(MAX_CHECKOUT_WIDTH, Math.max(MIN_CHECKOUT_WIDTH, Math.round(numeric)));
}
