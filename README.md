# Easy Payments

Easy Payments is an Angular library that renders a checkout method list (Apple Pay, Google Pay, Samsung Pay, PayPal, Klarna, Affirm, and card) behind a single component and a single configuration API.

The public API is designed so mock/demo payments and real Stripe card payments use the same inputs, outputs, and result types.

## Current status

**Phase 2 — Stripe card frontend + NestJS TEST MODE demo backend.**

- Library foundation from Phase 1 remains intact (ordering, themes, mocks, validation, events).
- **Real Stripe card payments** use Stripe Payment Element + PaymentIntent (`clientSecret` from your backend).
- A minimal **NestJS** server under `server/` creates PaymentIntents for local Stripe TEST MODE.
- Easy Payments loads Stripe.js lazily, mounts secure Elements, confirms payment, handles 3D Secure redirects when required, and emits normalized `success` / `cancel` / `error` events.
- **Mock mode still does not process real payments** and does not require Stripe credentials.
- Real PayPal, Apple Pay, Google Pay, Samsung Pay, Klarna, and Affirm are **not** implemented yet.

Angular never accepts Stripe secret keys. Only `pk_test_...` / `pk_live_...` belong in the browser.

## Installation

```bash
npm install
npm run build:lib
npm start
```

Demo: `http://localhost:4200/`.

Peer dependency for real Stripe: `@stripe/stripe-js` (already installed in this workspace).

## Quick start (mock)

```ts
provideEasyPayments({
  enableMockMode: true,
  providers: {},
});
```

```html
<easy-payments
  [product]="product"
  [methods]="methods"
  [theme]="theme"
  (success)="onPaymentSuccess($event)"
  (cancel)="onPaymentCancel($event)"
  (error)="onPaymentError($event)">
</easy-payments>
```

## Quick start (real Stripe card)

```ts
import { provideHttpClient } from '@angular/common/http';
import { provideEasyPayments } from 'easy-payments';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    provideEasyPayments({
      enableMockMode: false,
      providers: {
        stripe: {
          publishableKey: environment.stripePublishableKey, // pk_test_... only
        },
      },
      backend: {
        createPaymentUrl: '/api/payments/create',
      },
    }),
  ],
};
```

```ts
product = {
  id: 'premium-plan',
  name: 'Premium Plan',
  description: 'One year subscription',
  amount: 99.99,
  currency: 'USD',
  quantity: 1,
};

methods: PaymentMethod[] = ['card'];
```

That is enough on the Angular side. You do **not** manually load Stripe.js, create Elements, or call `confirmPayment`.

## Stripe integration

### What it provides

- Lazy load of official Stripe.js via `@stripe/stripe-js` (`loadStripe`) only when card checkout needs it
- Stripe **Payment Element** (card-focused) inside `<easy-payments>`
- Theme mapping: Easy Payments `light` → Stripe `stripe`, `dark` → Stripe `night`, `system` → resolved light/dark
- Internal `elements.submit()` + `stripe.confirmPayment({ redirect: 'if_required' })`
- 3D Secure / authentication handled by Stripe’s recommended confirm flow
- Normalized `PaymentResult` / `PaymentError` for the host app

### Prerequisites

1. A Stripe account
2. Stripe **publishable** test or live key (`pk_test_...` / `pk_live_...`)
3. A merchant backend that:
   - Validates `productId` / quantity (and pricing, tax, discounts, availability)
   - Uses the Stripe **secret** key server-side
   - Creates a PaymentIntent
   - Returns `{ provider: 'stripe', clientSecret: '...' }`

### Why the backend is required

The browser is not trusted for the final charge amount. Easy Payments sends product identity and quantity; your backend decides the real amount and creates the PaymentIntent.

### PaymentIntent flow

1. User sees Card in `<easy-payments>`
2. Easy Payments POSTs to `backend.createPaymentUrl`
3. Backend creates PaymentIntent → returns `clientSecret`
4. Easy Payments mounts Payment Element
5. Customer enters card data in Stripe-hosted fields
6. Easy Payments confirms payment (including 3DS when required)
7. Host receives `(success)` / `(cancel)` / `(error)`

`confirmPaymentUrl` is **not** required for this standard Elements + PaymentIntent flow.

### Expected backend request

```ts
{
  provider: 'stripe',
  productId: 'premium-plan',
  quantity: 1,
  currency: 'USD',
  amount: 99.99, // unit amount for local demos — production must re-price server-side
  metadata?: Record<string, string>
}
```

`amount` is included so the local NestJS demo can create a PaymentIntent without a product database. **Production merchants must not trust browser amounts** — look up `productId` and compute the authoritative total on the server.

### Expected backend response

```ts
{
  provider: 'stripe',
  clientSecret: 'pi_..._secret_...',
  paymentIntentId?: 'pi_...',
  sessionId?: string
}
```

## Stripe local testing with NestJS

### Why a backend is required

Stripe Payment Element needs a PaymentIntent `clientSecret`. Creating that PaymentIntent requires your Stripe **secret** key (`sk_test_...` / `sk_live_...`). Secret keys must stay on a server — never in Angular.

### Responsibility boundary

| Layer | Owns |
| --- | --- |
| **easy-payments (Angular)** | Payment UI abstraction, Stripe.js, Payment Element, confirm/3DS, themes, normalized frontend errors |
| **Merchant backend (NestJS demo / your API)** | Secret key, PaymentIntent creation, server-side Stripe calls, (in production) authoritative pricing |
| **Merchant application** | Product, price, currency, which methods to show, success business flow, provider config |

### Keys

| Key | Where | Example |
| --- | --- | --- |
| Publishable | Angular only | `pk_test_...` |
| Secret | NestJS `.env` only | `sk_test_...` |

### Configure NestJS

```bash
cd server
cp .env.example .env
# Edit server/.env:
# STRIPE_SECRET_KEY=sk_test_...
# PORT=3000
# FRONTEND_ORIGIN=http://localhost:4200
npm install
npm run start:dev
```

Endpoint used by the demo:

`POST http://localhost:3000/api/payments/create`

### Configure Angular demo

In `projects/demo/src/environments/environment.ts`:

```ts
stripePublishableKey: 'pk_test_...', // from Stripe Dashboard → Developers → API keys
createPaymentUrl: 'http://localhost:3000/api/payments/create',
```

Leave `stripePublishableKey` empty to stay in Demo/Mock mode (no Stripe credentials required).

### Start both apps

```bash
# terminal 1
npm run server:start

# terminal 2 (repo root)
npm start
```

Open `http://localhost:4200/`, choose **Real Stripe Mode**, enable **Card**, pay with a Stripe test card.

### Manual test payment (TEST MODE)

1. Get `pk_test_...` and `sk_test_...` from the Stripe Dashboard (Test mode).
2. Put `sk_test_...` in `server/.env` as `STRIPE_SECRET_KEY`.
3. Put `pk_test_...` in Angular `environment.ts` as `stripePublishableKey`.
4. Start NestJS (`npm run server:start`) and the demo (`npm start`).
5. Select **Real Stripe Mode**.
6. In the Stripe Payment Element use test card `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP.
7. Click **Pay with card**.
8. Confirm success in the demo event log and in Stripe Dashboard → Payments (Test mode).

### Manual 3DS test

Use Stripe’s authentication test card, for example:

`4000 0025 0000 3155`

Complete the test authentication modal. Easy Payments uses Stripe’s official `confirmPayment` flow (`redirect: 'if_required'`), so 3DS is handled by Stripe — not custom code.

### Production warning

This NestJS app is a **local Stripe TEST helper**. A production backend must:

- derive/validate price from `productId` (do not trust browser `amount`)
- use HTTPS
- lock down CORS
- never log secrets or full card data

## Security

- Never put `sk_...` in Angular / `provideEasyPayments`
- Never build your own card number / CVC / expiry inputs
- Never log secrets, raw card data, or full Stripe objects to end users
- Config validation rejects secret-key shaped values

### Stripe TEST MODE

1. Use a `pk_test_...` publishable key from the Stripe Dashboard
2. Point `createPaymentUrl` at a backend that uses the matching `sk_test_...` secret key
3. Use Stripe test cards (for example `4242 4242 4242 4242`)
4. In this repo, copy `projects/demo/src/environments/environment.example.ts` into `environment.ts`

Automated unit tests never call Stripe’s network.

### Common errors

| Situation | Typical `PaymentError.code` |
| --- | --- |
| Missing/invalid publishable key | `CONFIG_MISSING` / `CONFIG_INVALID` |
| Missing createPaymentUrl / bad response | `BACKEND_ERROR` |
| Stripe.js load failure | `SDK_LOAD_FAILED` |
| Card declined | `CARD_DECLINED` |
| 3DS / auth issues | `AUTHENTICATION_REQUIRED` / `AUTHENTICATION_FAILED` |
| Network issues | `NETWORK_ERROR` |
| Customer cancels | `PAYMENT_CANCELLED` |

### Troubleshooting

- Card method hidden → check publishable key + `createPaymentUrl` + `enableMockMode: false`
- “HttpClient is required” → add `provideHttpClient()`
- Element never ready → backend must return a valid `clientSecret`
- Theme not updating → Easy Payments maps themes via `elements.update({ appearance })`

## Product configuration

| Field | Rules |
| --- | --- |
| `id` | Non-empty string (backend source of truth for pricing) |
| `name` | Non-empty string |
| `amount` | Display/request number `> 0` (not trusted for charging) |
| `currency` | 3-letter ISO uppercase |
| `quantity` | Optional positive integer |

## Payment methods & ordering

`methods = ['paypal', 'apple-pay', 'card']` renders in that order. Omitted or unavailable methods are hidden.

## Themes

`light` · `dark` · `system` (`prefers-color-scheme`, live updates).

## Events

| Output | Payload |
| --- | --- |
| `success` | `PaymentResult` |
| `cancel` | `PaymentResult` |
| `error` | `PaymentError` |

## Mock / demo mode

`enableMockMode: true` forces mock adapters. Banner: **Demo Mode - No real payment will be processed.**

`MockPaymentController` still supports `success` / `cancelled` / `failed`.

## Real provider roadmap

1. ~~Stripe card~~ (Phase 2)
2. PayPal
3. Apple Pay
4. Google Pay
5. Samsung Pay
6. Klarna
7. Affirm

## Building & testing

```bash
npm run build:lib
npm run build:demo
npm test
npm run test:demo
npm run server:install
npm run server:test
npm run server:build
```
