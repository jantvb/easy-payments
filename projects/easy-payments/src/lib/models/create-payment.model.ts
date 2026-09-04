export interface CreatePaymentRequest {
  provider: 'stripe' | 'paypal';
  productId: string;
  quantity: number;
  currency?: string;
  /**
   * Display/request unit amount from the Angular product (e.g. 99.99).
   * Useful for UI display. Production / demo backends must NOT trust this —
   * derive the authoritative amount server-side from productId / catalog.
   */
  amount?: number;
  /** Optional non-sensitive metadata for the merchant backend. */
  metadata?: Record<string, string>;
}

/**
 * Minimal wire contract for PayPal create-order.
 * Never includes browser-controlled amount or arbitrary metadata.
 */
export interface PayPalCreateOrderRequest {
  provider: 'paypal';
  productId: string;
  quantity: number;
  currency: string;
}

/**
 * Maps product identity fields into the PayPal create-order HTTP body.
 * Strips amount, metadata, and any other internal fields.
 */
export function toPayPalCreateOrderRequest(input: {
  productId: string;
  quantity: number;
  currency: string;
}): PayPalCreateOrderRequest {
  return {
    provider: 'paypal',
    productId: input.productId.trim(),
    quantity: input.quantity,
    currency: input.currency.trim().toUpperCase(),
  };
}

/**
 * Minimal wire contract for Klarna-via-Stripe create PaymentIntent.
 * Never includes browser-controlled amount or arbitrary metadata.
 */
export interface KlarnaCreatePaymentRequest {
  provider: 'klarna';
  productId: string;
  quantity: number;
  currency: string;
}

/**
 * Maps product identity fields into the Klarna create-payment HTTP body.
 * Strips amount, metadata, and any other internal fields.
 */
export function toKlarnaCreatePaymentRequest(input: {
  productId: string;
  quantity: number;
  currency: string;
}): KlarnaCreatePaymentRequest {
  return {
    provider: 'klarna',
    productId: input.productId.trim(),
    quantity: input.quantity,
    currency: input.currency.trim().toUpperCase(),
  };
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

/**
 * Response from POST paypal create-order.
 * The backend alone creates the PayPal order with a trusted catalog amount.
 */
export interface CreatePayPalOrderResponse {
  provider: 'paypal';
  orderId: string;
}

/**
 * Response from POST paypal capture-order after buyer approval.
 */
export interface CapturePayPalOrderResponse {
  provider: 'paypal';
  orderId: string;
  captureId: string;
  status?: string;
}

/**
 * Response from POST klarna create (Klarna-only Stripe PaymentIntent).
 * The backend alone decides the trusted amount and uses the Stripe secret key.
 */
export interface CreateKlarnaPaymentResponse {
  provider: 'klarna';
  clientSecret: string;
  paymentIntentId?: string;
  sessionId?: string;
}

export type CreatePaymentResponse =
  | CreateStripePaymentResponse
  | CreatePayPalOrderResponse
  | CreateKlarnaPaymentResponse;
