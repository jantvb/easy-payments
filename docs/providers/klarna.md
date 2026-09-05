# Klarna

Klarna is integrated **via Stripe** (Klarna-only PaymentIntent), not via separate Klarna API secrets in Angular.

## Configuration

```ts
providers: {
  stripe: { publishableKey: 'YOUR_STRIPE_PUBLISHABLE_KEY' },
  klarna: {
    purchaseCountry: 'US', // optional
    locale: 'en-US',       // optional
  },
},
backend: {
  klarnaCreatePaymentUrl: 'https://your-backend-domain.example/api/payments/klarna/create',
}
```

## Flow

1. Customer selects Klarna  
2. Backend creates a Klarna PaymentIntent (catalog-priced)  
3. Customer may be redirected to Klarna  
4. Easy Payments recovers the return via Stripe redirect helpers and emits success/cancel/error  

Enable Klarna in the Stripe Dashboard (Test/Live) for your account. Eligibility can depend on amount, currency, and country.

## Demo

Reference route: `POST /api/payments/klarna/create`  
See [backend.md](../backend.md).
