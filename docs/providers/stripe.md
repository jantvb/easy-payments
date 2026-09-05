# Stripe

Card, Apple Pay, Google Pay, Klarna, and Affirm in Easy Payments all use **Stripe** on the provider side (except PayPal).

## Frontend

```ts
providers: {
  stripe: { publishableKey: 'YOUR_STRIPE_PUBLISHABLE_KEY' },
}
```

Publishable keys only (`pk_test_...` / `pk_live_...`). Never `sk_...` in Angular.

## Backend

```env
STRIPE_SECRET_KEY=YOUR_STRIPE_SECRET_KEY
```

Create a PaymentIntent and return `{ provider: 'stripe', clientSecret }`.

Demo route: `POST /api/payments/create`  
Config field: `backend.createPaymentUrl`

## Methods that need Stripe

| Method | Extra frontend config | Extra backend URL |
|--------|----------------------|-------------------|
| Card | `stripe.publishableKey` | `createPaymentUrl` |
| Apple Pay | `applePay: {}` (+ Stripe) | `createPaymentUrl` |
| Google Pay | `googlePay` (+ Stripe) | `createPaymentUrl` |
| Klarna | `klarna` (+ Stripe) | `klarnaCreatePaymentUrl` |
| Affirm | `affirm` (+ Stripe) | `affirmCreatePaymentUrl` |

## Testing

Use Stripe **Test mode** (`pk_test_` / `sk_test_`) and Stripe’s test cards. Do not use live keys for integration testing.

## Production

- Switch to `pk_live_` / `sk_live_`
- Trusted server-side pricing
- HTTPS
- Register domains for wallets (Payment Method Domains)
- Webhooks for final settlement
