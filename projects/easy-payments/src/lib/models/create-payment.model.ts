export interface CreatePaymentRequest {
  provider: 'stripe';
  productId: string;
  quantity: number;
  currency?: string;
  /**
   * Display/request unit amount from the Angular product (e.g. 99.99).
   * Useful for local demos. Production merchants should not trust this value —
   * derive the authoritative amount server-side from productId / catalog.
   */
  amount?: number;
  /** Optional non-sensitive metadata for the merchant backend. */
  metadata?: Record<string, string>;
}

/**
 * Response expected from the merchant backend after creating a Stripe PaymentIntent.
 * The backend alone decides the trusted amount and uses the Stripe secret key.
 */
export interface CreateStripePaymentResponse {
  provider: 'stripe';
  clientSecret: string;
  sessionId?: string;
  paymentIntentId?: string;
}

export type CreatePaymentResponse = CreateStripePaymentResponse;
