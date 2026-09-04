import type { StripePaymentElementOptions } from '@stripe/stripe-js';

export type AffirmUiState =
  | 'idle'
  | 'initializing'
  | 'loading-session'
  | 'ready'
  | 'processing'
  | 'success'
  | 'error';

export interface AffirmSessionResult {
  clientSecret: string;
  sessionId?: string;
  paymentIntentId?: string;
}

/**
 * Payment Element options for Easy Payments Affirm (via Stripe).
 * Method availability is controlled by the PaymentIntent
 * (`payment_method_types: ['affirm']`). These options keep wallets off.
 */
export const AFFIRM_PAYMENT_ELEMENT_OPTIONS: StripePaymentElementOptions = {
  layout: {
    type: 'accordion',
  },
  wallets: {
    applePay: 'never',
    googlePay: 'never',
  },
};

/**
 * Stable session identity for Affirm PaymentIntent reuse.
 * Theme is intentionally excluded — appearance updates must not recreate intents.
 * Amount is excluded — the backend prices from the trusted catalog.
 */
export function buildAffirmSessionKey(
  product: {
    id: string;
    currency: string;
    quantity?: number;
  },
  checkout?: { customer?: { email?: string; name?: string } } | null,
): string {
  const quantity = product.quantity ?? 1;
  const email = checkout?.customer?.email ?? '';
  const name = checkout?.customer?.name ?? '';
  return [product.id, quantity, product.currency, email, name].join('|');
}
