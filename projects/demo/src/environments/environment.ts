/**
 * Demo environment — DO NOT put Stripe or PayPal secrets here.
 *
 * For Real / Test Providers mode:
 * 1. Set stripePublishableKey (pk_test_...) and/or paypalClientId (Sandbox Client ID).
 * 2. Keep backend URLs pointing at the NestJS demo server.
 * 3. Put secrets only in server/.env:
 *    - STRIPE_SECRET_KEY=sk_test_...
 *    - PAYPAL_CLIENT_SECRET=...
 *
 * Leave keys empty to use Demo/Mock mode only.
 */
export const environment = {
  production: false,
  /**
   * Stripe publishable TEST key only (pk_test_...).
   * Never use sk_test_... or sk_live_... in Angular.
   */
  stripePublishableKey: 'pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  /**
   * PayPal Sandbox Client ID only.
   * Never put PAYPAL_CLIENT_SECRET in Angular.
   */
  paypalClientId: 'YOUR_PAYPAL_SANDBOX_CLIENT_ID',
  /**
   * NestJS demo endpoint that creates a Stripe PaymentIntent.
   */
  createPaymentUrl: 'http://localhost:3000/api/payments/create',
  /**
   * NestJS demo endpoints for PayPal Orders v2 create + capture.
   */
  paypalCreateOrderUrl: 'http://localhost:3000/api/payments/paypal/create',
  paypalCaptureOrderUrl: 'http://localhost:3000/api/payments/paypal/capture',
  /**
   * Trusted catalog used by Real / Test Providers so displayed price matches charge.
   */
  catalogProductUrl: 'http://localhost:3000/api/catalog/products',
};
