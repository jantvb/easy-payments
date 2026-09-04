/**
 * Example environment for Easy Payments demo (Stripe TEST + PayPal Sandbox).
 *
 * 1. Copy/merge into environment.ts.
 * 2. Paste your Stripe Dashboard TEST publishable key (pk_test_...).
 * 3. Paste your PayPal Sandbox Client ID.
 * 4. Start the NestJS server (server/) with secrets in server/.env only:
 *    - STRIPE_SECRET_KEY=sk_test_...
 *    - PAYPAL_CLIENT_ID=...
 *    - PAYPAL_CLIENT_SECRET=...
 *
 * NEVER put Stripe secret keys (sk_...) or PayPal Client Secret in this Angular app.
 */
export const environment = {
  production: false,
  stripePublishableKey: 'pk_test_REPLACE_ME',
  paypalClientId: 'PAYPAL_SANDBOX_CLIENT_ID_REPLACE_ME',
  createPaymentUrl: 'http://localhost:3000/api/payments/create',
  paypalCreateOrderUrl: 'http://localhost:3000/api/payments/paypal/create',
  paypalCaptureOrderUrl: 'http://localhost:3000/api/payments/paypal/capture',
  catalogProductUrl: 'http://localhost:3000/api/catalog/products',
};
