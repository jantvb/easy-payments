# Apple Pay

Easy Payments implements Apple Pay through **Stripe Express Checkout Element**.

Stripe handles Apple Pay merchant validation for this integration. You normally do **not** implement a separate Apple merchant-certificate / validation endpoint for Easy Payments’ Stripe path.

## What you need

- Stripe publishable + secret keys (see [stripe.md](./stripe.md))  
- `providers.applePay` enabled in Easy Payments config  
- `backend.createPaymentUrl`  
- HTTPS frontend  
- Compatible Apple device / Safari / Wallet setup  
- Frontend hostname registered as a Stripe **Payment Method Domain**

## Frontend configuration

Apple Pay is enabled in Easy Payments by including `providers.applePay` **and** using your existing Stripe configuration (`publishableKey` + `backend.createPaymentUrl`).

```ts
providers: {
  // Required — Apple Pay uses this Stripe publishable key (Express Checkout Element).
  stripe: { publishableKey: 'pk_test_...' },

  // Opt in to Apple Pay in Easy Payments.
  //
  // applePay: {} does NOT mean "Apple Pay requires no configuration."
  // It means there are currently no additional Apple Pay-specific frontend
  // credentials required here (no Apple Merchant ID / certificates in Angular).
  // Stripe handles merchant validation for this integration.
  //
  // You can optionally pass display fields:
  //   applePay: { merchantName: 'Your Store', countryCode: 'US' }
  applePay: {},
},
backend: {
  // Same Stripe PaymentIntent create URL used by card / Google Pay.
  createPaymentUrl: '/api/payments/create',
}
```

**Still required outside `provideEasyPayments()`:**

- HTTPS frontend  
- Compatible Apple device / Safari / Wallet  
- Stripe Payment Method Domain registration for the checkout hostname  
- Stripe Dashboard payment-method enablement for your Test/Live mode  

See the troubleshooting section below if Apple Pay does not appear.

## Backend configuration

Same Stripe PaymentIntent create endpoint used for card / Google Pay (`createPaymentUrl`). Trusted catalog pricing on the server.

## Dashboard / provider setup

1. Enable Apple Pay / wallets in Stripe Dashboard as required.  
2. Register the checkout hostname under Payment Method Domains.  
3. Test on a real Apple Pay-capable device/browser when possible.

Official docs:

- [Express Checkout Element](https://docs.stripe.com/elements/express-checkout-element)  
- [Accept a payment](https://docs.stripe.com/elements/express-checkout-element/accept-a-payment)  
- [Payment Method Domains](https://docs.stripe.com/payments/payment-methods/pmd-registration)

## Localization

- Easy Payments passes Stripe Elements `locale` into Express Checkout.  
- That may localize Stripe ECE **button** chrome.  
- The **Apple Pay system wallet sheet** follows Apple / device / Wallet language. Easy Payments cannot officially force that language.

## Testing

- HTTPS required  
- Wallet must have a usable card  
- Test vs Live Stripe environments must match your keys  
- Availability is authoritative: Easy Payments shows Apple Pay only when Stripe reports it available

## Production checklist

- [ ] Live Stripe keys  
- [ ] Production domain registered for Payment Method Domains  
- [ ] HTTPS  
- [ ] Real-device verification  

## Common problems — “Apple Pay does not appear”

Check:

1. HTTPS  
2. Safari / device compatibility  
3. Wallet / card setup  
4. Stripe test vs live environment mismatch  
5. Payment method enabled in Dashboard  
6. Exact frontend hostname registered (not a path, not the backend tunnel)  
7. Temporary tunnel hostname changed since last registration  
