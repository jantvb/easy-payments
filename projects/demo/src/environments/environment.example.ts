/**
 * Example environment for Easy Payments demo (Stripe TEST MODE).
 *
 * 1. Copy/merge into environment.ts.
 * 2. Paste your Stripe Dashboard TEST publishable key (pk_test_...).
 * 3. Start the NestJS server (server/) with STRIPE_SECRET_KEY=sk_test_... in server/.env.
 *
 * NEVER put Stripe secret keys (sk_...) in this Angular app.
 */
export const environment = {
  production: false,
  stripePublishableKey: 'pk_test_REPLACE_ME',
  createPaymentUrl: 'http://localhost:3000/api/payments/create',
};
