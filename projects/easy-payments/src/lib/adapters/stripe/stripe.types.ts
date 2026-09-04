import type {
  PaymentIntent,
  Stripe,
  StripeElements,
  StripeError,
  StripePaymentElement,
} from '@stripe/stripe-js';

export type {
  PaymentIntent,
  Stripe,
  StripeElements,
  StripeError,
  StripePaymentElement,
};

export type StripeCardUiState =
  | 'idle'
  | 'initializing'
  | 'loading-session'
  | 'ready'
  | 'processing'
  | 'success'
  | 'error';

export interface StripeSessionResult {
  clientSecret: string;
  sessionId?: string;
  paymentIntentId?: string;
}
