import { PaymentProduct } from '../../models';

export type ApplePayUiState =
  | 'idle'
  | 'initializing'
  | 'ready'
  | 'unavailable'
  | 'processing'
  | 'success'
  | 'error';

/**
 * Production Apple Pay availability — decided only by the mounted Express Checkout
 * Element `ready` event (never by a hidden probe, timeout, UA sniffing, OS checks,
 * or ApplePaySession).
 *
 * - `idle` / `checking` = UNKNOWN (must not expose Apple Pay in the method list)
 * - `available` = Stripe reported applePay:true for the current session
 * - `unavailable` / `error` = Stripe reported applePay:false or load failure
 */
export type ApplePayAvailabilityState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'unavailable'
  | 'error'
  | 'indeterminate';

/** Stripe minor units for Elements / Payment Request (display amount only). */
export function toStripeAmountCents(product: PaymentProduct): number {
  const quantity = product.quantity ?? 1;
  return Math.round(product.amount * quantity * 100);
}

export function buildApplePayRenderKey(product: PaymentProduct): string {
  return [
    product.id,
    product.quantity ?? 1,
    product.currency.trim().toUpperCase(),
    product.amount,
  ].join('|');
}
