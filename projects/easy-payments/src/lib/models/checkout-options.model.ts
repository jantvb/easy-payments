export type CheckoutSuccessBehavior = 'confirmation' | 'event-only';

export interface CheckoutOptions {
  successUrl?: string;
  cancelUrl?: string;
  /**
   * Controls built-in success confirmation UI after a successful payment.
   * - confirmation (default): show Easy Payments success screen
   * - event-only: emit (success) only; merchant handles post-payment UX/navigation
   *
   * Existing successUrl / cancelUrl remain merchant-controlled hints and do not
   * trigger automatic redirects inside Easy Payments.
   */
  successBehavior?: CheckoutSuccessBehavior;
  customer?: {
    email?: string;
    name?: string;
  };
  shipping?: {
    required?: boolean;
  };
}
