/**
 * LOCAL demo credentials — gitignored.
 *
 * Copy from environment.local.example.ts:
 *   cp projects/demo/src/environments/environment.local.example.ts ^
 *      projects/demo/src/environments/environment.local.ts
 *
 * Then replace YOUR_* placeholders with TEST keys only.
 * Never commit this file.
 */
export const environment = {
  production: false,
  stripePublishableKey: 'YOUR_STRIPE_PUBLISHABLE_KEY',
  paypalClientId: 'YOUR_PAYPAL_CLIENT_ID',
  createPaymentUrl: 'http://localhost:3000/api/payments/create',
  paypalCreateOrderUrl: 'http://localhost:3000/api/payments/paypal/create',
  paypalCaptureOrderUrl: 'http://localhost:3000/api/payments/paypal/capture',
  klarnaCreatePaymentUrl: 'http://localhost:3000/api/payments/klarna/create',
  affirmCreatePaymentUrl: 'http://localhost:3000/api/payments/affirm/create',
  catalogProductUrl: 'http://localhost:3000/api/catalog/products',
};
