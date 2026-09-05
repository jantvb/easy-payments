# Affirm

Affirm is integrated **via Stripe** (Affirm-only PaymentIntent). No Affirm private API keys in Angular.

## Configuration

```ts
providers: {
  stripe: { publishableKey: 'YOUR_STRIPE_PUBLISHABLE_KEY' },
  affirm: {
    purchaseCountry: 'US', // optional
    locale: 'en-US',       // optional
  },
},
backend: {
  affirmCreatePaymentUrl: 'https://your-backend-domain.example/api/payments/affirm/create',
}
```

## Eligibility

Provider and Stripe rules apply (currency, country, amount). Easy Payments also hides Affirm when the checkout total is below about **$35** (major units), matching Stripe Affirm presentment guidance.

The demo playground defaults to **$99** so Affirm can appear during local testing — that price is a demo choice, not a product requirement.

## Flow

Similar to Klarna: redirect / return recovery through Stripe, then normalized `success` / `cancel` / `error` events.

## Demo

Reference route: `POST /api/payments/affirm/create`  
See [backend.md](../backend.md).
