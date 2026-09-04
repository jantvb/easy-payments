/**
 * Demo environment — DO NOT put Stripe secret keys here.
 *
 * For Real Stripe mode:
 * 1. Set stripePublishableKey to your Dashboard TEST publishable key (pk_test_...).
 * 2. Keep createPaymentUrl pointing at the NestJS demo server.
 * 3. Put STRIPE_SECRET_KEY=sk_test_... only in server/.env (never here).
 *
 * Leave stripePublishableKey empty to use Demo/Mock mode only.
 */
export const environment = {
  production: false,
  /**
   * Stripe publishable TEST key only (pk_test_...).
   * Never use sk_test_... or sk_live_... in Angular.
   */
  stripePublishableKey: 'pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  /**
   * NestJS demo endpoint that creates a PaymentIntent and returns
   * { provider: 'stripe', clientSecret, paymentIntentId }.
   */
  createPaymentUrl: 'http://localhost:3000/api/payments/create',
};
