# Apple Pay

Apple Pay in Easy Payments is powered by **Stripe Express Checkout Element** (official Stripe-rendered Apple Pay button).

## Configuration

```ts
providers: {
  stripe: { publishableKey: 'YOUR_STRIPE_PUBLISHABLE_KEY' },
  applePay: {
    merchantName: 'Optional display name',
    countryCode: 'US', // optional, default US
  },
},
backend: {
  createPaymentUrl: 'https://your-backend-domain.example/api/payments/create',
}
```

No Apple Merchant ID or certificates in Angular. Stripe handles domain registration and merchant validation.

## Availability

Apple Pay appears only when:

1. `methods` includes `'apple-pay'`, and  
2. Stripe ECE reports Apple Pay available (`ready.availablePaymentMethods.applePay`)

Configured ≠ always visible. Availability is **capability-based**, not inferred solely from OS or browser brand.

## Requirements

- HTTPS in production (and typically for real-device testing)
- Stripe **Payment Method Domain** registration for your domain
- Stripe Test vs Live keys as appropriate

## Docs note on screenshots

Dedicated Apple Pay screenshots are included in documentation **only** when the environment actually renders Stripe’s Apple Pay button. Text availability is never forced for marketing shots.
