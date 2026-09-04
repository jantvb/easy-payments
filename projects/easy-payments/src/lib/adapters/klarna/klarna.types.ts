import type { StripePaymentElementOptions } from '@stripe/stripe-js';

export type KlarnaUiState =
  | 'idle'
  | 'initializing'
  | 'loading-session'
  | 'ready'
  | 'processing'
  | 'success'
  | 'error';

export interface KlarnaSessionResult {
  clientSecret: string;
  sessionId?: string;
  paymentIntentId?: string;
}

/**
 * Payment Element options for Easy Payments Klarna (via Stripe).
 * Method availability is controlled by the PaymentIntent
 * (`payment_method_types: ['klarna']`). These options keep wallets off.
 */
export const KLARNA_PAYMENT_ELEMENT_OPTIONS: StripePaymentElementOptions = {
  layout: {
    type: 'accordion',
  },
  wallets: {
    applePay: 'never',
    googlePay: 'never',
  },
};

/**
 * Stable session identity for Klarna PaymentIntent reuse.
 * Theme is intentionally excluded — appearance updates must not recreate intents.
 * Amount is excluded — the backend prices from the trusted catalog.
 */
export function buildKlarnaSessionKey(
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
