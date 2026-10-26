/**
 * Example environment for Easy Payments demo
 * (Stripe TEST + PayPal Sandbox + Klarna/Affirm via Stripe).
 *
 * 1. Copy/merge into environment.ts.
 * 2. Replace YOUR_STRIPE_PUBLISHABLE_KEY with pk_test_... from Stripe Dashboard.
 * 3. Replace YOUR_PAYPAL_CLIENT_ID with your PayPal Sandbox Client ID.
 * 4. Start the NestJS server (server/) with secrets in server/.env only.
 *
 * NEVER put Stripe secret keys or PayPal Client Secret in this Angular app.
 *
 * Backend URL options (pick one):
 *
 * 1. Angular dev-server proxy — relative paths, no baseUrl:
 *    createPaymentUrl: '/api/payments/create'
 *
 * 2. NestJS on http://localhost:3000 — one baseUrl plus relative paths:
 *    backendBaseUrl: 'http://localhost:3000'
 *    createPaymentUrl: '/api/payments/create'
 *
 * 3. Production API on another HTTPS origin:
 *    backendBaseUrl: 'https://api.example.com'
 *    createPaymentUrl: '/api/payments/create'
 *
 * An absolute endpoint such as 'https://payments.other-provider.com/create'
 * is used as-is and is not prefixed with backendBaseUrl.
 * Different origins require CORS on the API and HTTPS in production.
 */
export const environment = {
  production: false,
  stripePublishableKey: 'YOUR_STRIPE_PUBLISHABLE_KEY',
  paypalClientId: 'YOUR_PAYPAL_CLIENT_ID',
  backendBaseUrl: '',
  createPaymentUrl: 'http://localhost:3000/api/payments/create',
  paypalCreateOrderUrl: 'http://localhost:3000/api/payments/paypal/create',
  paypalCaptureOrderUrl: 'http://localhost:3000/api/payments/paypal/capture',
  klarnaCreatePaymentUrl: 'http://localhost:3000/api/payments/klarna/create',
  affirmCreatePaymentUrl: 'http://localhost:3000/api/payments/affirm/create',
  catalogProductUrl: 'http://localhost:3000/api/catalog/products',
};
