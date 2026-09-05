# Google Pay

Google Pay uses Stripe as the gateway with Google Pay button / readiness checks.

## Configuration

```ts
providers: {
  stripe: { publishableKey: 'YOUR_STRIPE_PUBLISHABLE_KEY' },
  googlePay: {
    environment: 'TEST',          // or 'PRODUCTION'
    merchantId: 'YOUR_GOOGLE_PAY_MERCHANT_ID', // optional in TEST; required for PRODUCTION
    merchantName: 'Your Store',   // optional
    countryCode: 'US',            // optional
  },
},
backend: {
  createPaymentUrl: 'https://your-backend-domain.example/api/payments/create',
}
```

## Availability

The method is shown when configured, included in `methods`, and Google Pay reports ready (`isReadyToPay`). Do not assume visibility from OS alone.

## TEST vs PRODUCTION

| Mode | Notes |
|------|-------|
| `TEST` | Default. Uses Google’s documented TEST merchant behavior when `merchantId` omitted. |
| `PRODUCTION` | Requires Google Pay & Wallet Console merchant ID and approvals. |

## Backend

Same Stripe PaymentIntent create URL as card/wallets (`createPaymentUrl`).
