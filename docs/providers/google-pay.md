# Google Pay

Easy Payments uses the **official Google Pay Web API** (`PaymentsClient` / `createButton`) and confirms the tokenized payment with **Stripe** as the gateway.

## What you need

- Stripe publishable + secret keys  
- `providers.googlePay` config  
- `backend.createPaymentUrl`  
- Browser / Google account conditions that make Google Pay available  
- HTTPS for realistic testing  
- Stripe Payment Method Domain registration where required  

## Frontend configuration

```ts
providers: {
  stripe: { publishableKey: 'pk_test_...' },
  googlePay: {
    environment: 'TEST', // or 'PRODUCTION'
    merchantName: 'Your Store',
    countryCode: 'US',
    // PRODUCTION requires a real Google Pay merchantId
    // merchantId: '01234567890123456789',
  },
},
backend: {
  createPaymentUrl: '/api/payments/create',
}
```

**SAFE FOR FRONTEND:** Stripe publishable key, Google Pay merchant display name, TEST environment flag.  
**SERVER ONLY:** Stripe secret key.

## Backend configuration

Create a Stripe PaymentIntent and return `clientSecret` (same contract as card). Easy Payments creates the Intent on button click, then confirms with the Google Pay token.

## Dashboard / provider setup

1. Enable card / wallet methods in Stripe as needed.  
2. For PRODUCTION Google Pay, complete Google Pay & Wallet Console merchant approval and pass `merchantId`.  
3. Register checkout domains with Stripe when required.

Official docs:

- [Google Pay Web overview](https://developers.google.com/pay/api/web/overview)  
- [Request / Button options](https://developers.google.com/pay/api/web/reference/request-objects)  
- [Stripe Payment Method Domains](https://docs.stripe.com/payments/payment-methods/pmd-registration)

## Localization

| UI | Controllable? |
|----|---------------|
| Easy Payments chrome around Google Pay | Yes — follows `[locale]` |
| Official Google Pay **button** text | Yes — Easy Payments sets `buttonLocale` (`en` / `es` / `pt`) |
| Google-hosted payment sheet | No official override — follows Google account / browser / OS language |

## Testing vs production

- `environment: 'TEST'` uses Google’s test merchant behavior  
- `environment: 'PRODUCTION'` requires a real `merchantId`  
- Keep Stripe test/live keys aligned with the environment you intend to exercise  

## Common problems

| Symptom | Check |
|---------|-------|
| Button missing | Browser support, Google account, `isReadyToPay`, Stripe config |
| PRODUCTION init fails | Missing/invalid `merchantId` |
| Sheet language not Spanish | Expected — sheet is provider/OS owned; button can still follow `buttonLocale` |
