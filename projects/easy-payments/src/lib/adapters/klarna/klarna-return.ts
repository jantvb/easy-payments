/**
 * Klarna-specific wrappers around the shared Stripe redirect return helpers.
 * Prefer importing from `../stripe/stripe-redirect-return` for new BNPL methods.
 */

import {
  buildStripeReturnUrl,
  clearStripePendingReturn,
  clearStripeReturnParamsFromUrl,
  isStripeReturnAttempt,
  markStripePendingReturn,
  readStripePendingReturn,
  readStripeReturnParams,
  STRIPE_PENDING_STORAGE_KEY,
  STRIPE_PROCESSING_DELAY_MS,
  STRIPE_PROCESSING_MAX_ATTEMPTS,
  STRIPE_RETURN_METHOD_PARAM,
  type StripePendingReturn,
  type StripeReturnParams,
} from '../stripe/stripe-redirect-return';

export const KLARNA_RETURN_METHOD_PARAM = STRIPE_RETURN_METHOD_PARAM;
export const KLARNA_PENDING_STORAGE_KEY = STRIPE_PENDING_STORAGE_KEY;
export const KLARNA_PROCESSING_MAX_ATTEMPTS = STRIPE_PROCESSING_MAX_ATTEMPTS;
export const KLARNA_PROCESSING_DELAY_MS = STRIPE_PROCESSING_DELAY_MS;

export type KlarnaPendingReturn = StripePendingReturn;
export type { StripeReturnParams };

export function buildKlarnaReturnUrl(baseUrl?: string, locationHref?: string): string {
  return buildStripeReturnUrl('klarna', baseUrl, locationHref);
}

export { readStripeReturnParams, clearStripeReturnParamsFromUrl };

export function markKlarnaPendingReturn(productId: string, storage?: Storage): void {
  markStripePendingReturn('klarna', productId, storage);
}

export function readKlarnaPendingReturn(storage?: Storage): KlarnaPendingReturn | null {
  const pending = readStripePendingReturn(storage);
  return pending?.method === 'klarna' ? pending : null;
}

export function clearKlarnaPendingReturn(storage?: Storage): void {
  clearStripePendingReturn(storage);
}

export function isKlarnaReturnAttempt(search?: string, storage?: Storage): boolean {
  return isStripeReturnAttempt('klarna', search, storage);
}

export function isKlarnaStripeReturn(search?: string, storage?: Storage): boolean {
  const { clientSecret } = readStripeReturnParams(search);
  if (!clientSecret) {
    return false;
  }
  return isKlarnaReturnAttempt(search, storage);
}

/** Any Stripe BNPL return (Klarna or Affirm) — used by demo mode bootstrap. */
export function isAnyStripeBnplReturnAttempt(search?: string, storage?: Storage): boolean {
  return isStripeReturnAttempt(undefined, search, storage);
}
