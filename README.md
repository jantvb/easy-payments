# Easy Payments

Easy Payments is an Angular library that renders a checkout method list (Apple Pay, Google Pay, Samsung Pay, PayPal, Klarna, Affirm, and card) behind a single component and a single configuration API.

The public API is designed so mock/demo payments and real Stripe card payments use the same inputs, outputs, and result types.

## Current status

**Phase 3 — Real PayPal Sandbox + Stripe card TEST + NestJS demo backend.**

- Library foundation from Phase 1 remains intact (ordering, themes, mocks, validation, events).
- **Real Stripe card payments** use Stripe Payment Element + PaymentIntent (`clientSecret` from your backend).
- **Real PayPal payments** use the official PayPal JS SDK Buttons + Orders v2 create/capture.
- A minimal **NestJS** server under `server/` creates Stripe PaymentIntents and PayPal orders for local TEST / Sandbox.
- Both providers use a **trusted server-side product catalog** — browser amounts are not authoritative.
- Easy Payments loads Stripe.js / PayPal JS lazily, mounts official provider UI, and emits normalized `success` / `cancel` / `error` events.
- **Mock mode still does not process real payments** and does not require provider credentials.
- Real Apple Pay, Google Pay, Samsung Pay, Klarna, and Affirm are **not** implemented yet.

Angular never accepts Stripe secret keys or PayPal Client Secrets. Only publishable / Client ID values belong in the browser.

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

## Quick start (real PayPal)

```ts
provideEasyPayments({
  enableMockMode: false,
  providers: {
    paypal: {
      clientId: environment.paypalClientId, // Sandbox / Live Client ID only
    },
    // Optional: enable Stripe Card at the same time
    stripe: {
      publishableKey: environment.stripePublishableKey,
    },
  },
  backend: {
    createPaymentUrl: '/api/payments/create',
    paypalCreateOrderUrl: '/api/payments/paypal/create',
    paypalCaptureOrderUrl: '/api/payments/paypal/capture',
  },
});
```

```ts
methods: PaymentMethod[] = ['paypal', 'card'];
```

Easy Payments loads the official PayPal JS SDK and renders PayPal Buttons. You do **not** invent a fake PayPal CTA.

## Backend contract (provider-aware)

| Provider | Create | Capture / confirm |
| --- | --- | --- |
| Stripe | `POST /api/payments/create` | Payment Element confirms client-side |
| PayPal | `POST /api/payments/paypal/create` | `POST /api/payments/paypal/capture` |

This scales cleanly to future providers without forcing unrelated frontend conventions. Shared trusted pricing lives in `server/src/catalog/product-catalog.ts`.

### Trusted pricing

The browser may send `productId` + `quantity` (+ optional currency hint). The NestJS demo resolves:

`premium-plan` → **99.99 USD** (unit)

Changing the displayed amount in DevTools does **not** change the charged amount.

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

`amount` may still be sent for display/back-compat. **The NestJS demo ignores it** and uses the trusted catalog price for `productId`. Production merchants must also re-price server-side.

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

Open `http://localhost:4200/`, choose **Real / Test Providers**, enable **Card**, pay with a Stripe test card.

### Manual test payment (TEST MODE)

1. Get `pk_test_...` and `sk_test_...` from the Stripe Dashboard (Test mode).
2. Put `sk_test_...` in `server/.env` as `STRIPE_SECRET_KEY`.
3. Put `pk_test_...` in Angular `environment.ts` as `stripePublishableKey`.
4. Start NestJS (`npm run server:start`) and the demo (`npm start`).
5. Select **Real / Test Providers**.
6. In the Stripe Payment Element use test card `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP.
7. Click **Pay with card**.
8. Confirm success in the demo event log and in Stripe Dashboard → Payments (Test mode).

### Manual 3DS test

Use Stripe’s authentication test card, for example:

`4000 0025 0000 3155`

Complete the test authentication modal. Easy Payments uses Stripe’s official `confirmPayment` flow (`redirect: 'if_required'`), so 3DS is handled by Stripe — not custom code.

### Production warning

This NestJS app is a **local Stripe TEST / PayPal Sandbox helper**. A production backend must:

- derive/validate price from `productId` (do not trust browser `amount`)
- use HTTPS
- lock down CORS
- never log secrets or full card / PayPal credential data

## PayPal integration

### Official APIs / SDK used

| Layer | Technology |
| --- | --- |
| Frontend | PayPal JavaScript SDK v5 Buttons (`https://www.paypal.com/sdk/js`, `components=buttons`) — still documented as CURRENT / STANDARD |
| Backend | PayPal REST **Orders v2** (`POST /v2/checkout/orders`, `POST /v2/checkout/orders/{id}/capture`) + OAuth2 client credentials |
| Auth | `PAYPAL_CLIENT_ID` + `PAYPAL_CLIENT_SECRET` on the server only |

### Prerequisites

1. A [PayPal Developer](https://developer.paypal.com/) account
2. A Sandbox app with **Client ID** + **Client Secret**
3. A merchant backend that creates and captures orders with a trusted amount

### Where credentials belong

| Credential | Where | Example |
| --- | --- | --- |
| Client ID | Angular only | `paypalClientId` in `environment.ts` |
| Client Secret | NestJS `.env` only | `PAYPAL_CLIENT_SECRET=...` |

Never put the Client Secret in Angular.

### Create Order flow

1. Customer selects the **PayPal** tile
2. Easy Payments shows official PayPal Buttons
3. Customer clicks PayPal
4. Easy Payments POSTs `{ provider: 'paypal', productId, quantity }` to `paypalCreateOrderUrl`
5. NestJS validates catalog product → creates PayPal order with trusted amount
6. Returns `{ provider: 'paypal', orderId }`
7. PayPal checkout UI opens for approval

### Capture Order flow

1. Customer approves in PayPal
2. Buttons `onApprove` fires with `orderID`
3. Easy Payments POSTs `{ orderId }` to `paypalCaptureOrderUrl`
4. NestJS captures via Orders v2
5. Easy Payments emits normalized success:

```ts
{
  status: 'success',
  method: 'paypal',
  provider: 'paypal',
  transactionId: captureId,
  sessionId: orderId,
}
```

### Cancellation

Closing the PayPal popup / cancelling checkout emits `(cancel)` with `status: 'cancelled'`. It is **not** treated as a generic failure.

### Configure NestJS for PayPal

```bash
cd server
cp .env.example .env
# Edit server/.env:
# PAYPAL_CLIENT_ID=...
# PAYPAL_CLIENT_SECRET=...
# PAYPAL_MODE=sandbox
# STRIPE_SECRET_KEY=sk_test_...   # optional if testing card too
npm install
npm run start:dev
```

Endpoints:

- `POST http://localhost:3000/api/payments/paypal/create`
- `POST http://localhost:3000/api/payments/paypal/capture`

### Configure Angular demo for PayPal

In `projects/demo/src/environments/environment.ts`:

```ts
paypalClientId: 'YOUR_SANDBOX_CLIENT_ID',
paypalCreateOrderUrl: 'http://localhost:3000/api/payments/paypal/create',
paypalCaptureOrderUrl: 'http://localhost:3000/api/payments/paypal/capture',
```

### Manual PayPal Sandbox test

1. Create a Sandbox app at [developer.paypal.com/dashboard](https://developer.paypal.com/dashboard/).
2. Copy **Client ID** → Angular `environment.paypalClientId`.
3. Copy **Client Secret** → `server/.env` as `PAYPAL_CLIENT_SECRET` (and matching `PAYPAL_CLIENT_ID`).
4. Start NestJS (`npm run server:start`) and the demo (`npm start`).
5. Select **Real / Test Providers**.
6. Select the **PayPal** tile → official PayPal button appears.
7. Click PayPal → sign in with a **Sandbox buyer** account from the Developer Dashboard.
8. Approve the payment.
9. Confirm `(success)` in the demo event log (`transactionId` = capture id).
10. Verify the transaction under PayPal Developer Dashboard → Sandbox → Transactions.

### Manual cancellation test

1. Click the official PayPal button.
2. Close the PayPal window / cancel checkout.
3. Confirm the demo event log shows `Cancelled (paypal)` — not an error.

### Common PayPal errors

| Situation | Typical `PaymentError.code` |
| --- | --- |
| Missing Client ID | method unavailable / `CONFIG_MISSING` |
| Missing create/capture URLs | method unavailable / `BACKEND_ERROR` |
| SDK load failure | `SDK_LOAD_FAILED` |
| Create-order failure / invalid response | `BACKEND_ERROR` |
| Capture failure / declined | `PAYMENT_FAILED` |
| Network issues | `NETWORK_ERROR` |
| Customer cancels / popup closed | `PAYMENT_CANCELLED` → `(cancel)` |

### Production considerations (PayPal)

- Switch to Live Client ID / Secret only on a hardened merchant backend
- Keep `PAYPAL_MODE=live` (or live API host) out of local demos until ready
- Implement idempotent capture handling and webhook verification for fulfillment
- Follow [PayPal brand guidelines](https://www.paypal.com/us/webapps/mpp/logo-center) for Buttons
- NestJS in this repo is a **reference** backend — merchants may implement the same contract on any stack

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

## Third-Party Trademarks

Apple Pay, Google Pay, Samsung Pay, PayPal, Klarna, Affirm, Stripe, Visa, Mastercard, American Express, Discover, and related marks are trademarks of their respective owners. Easy Payments does **not** claim ownership of these marks.

Official provider artwork is used only to identify supported payment options in the checkout selector and must follow each provider’s current brand guidelines. Downloading or installing Easy Payments does **not** grant unrestricted trademark rights.

Consumers are responsible for:

- Merchant / partner onboarding with each payment provider before production use
- Complying with that provider’s branding, button, and checkout requirements
- Obtaining any additional official assets required by the provider (for example Samsung Developer branding packs)

Current asset approach:

| Method | Asset approach |
| --- | --- |
| Card | Generic neutral icon (not a card-network logo) |
| Apple Pay | Official Apple Pay mark from Apple’s marketing mark package |
| Google Pay | Official Google Pay mark from Google’s acceptance mark package |
| PayPal | PayPal-hosted assets (`paypalobjects.com`) |
| Klarna | Klarna-hosted badge CDN |
| Affirm | Affirm-hosted CDN logos |
| Samsung Pay | Text fallback until an official Samsung mark is supplied |

See `projects/easy-payments/src/lib/assets/payment-methods/SOURCES.md`.

## Events

| Output | Payload |
| --- | --- |
| `success` | `PaymentResult` |
| `cancel` | `PaymentResult` |
| `error` | `PaymentError` |

## Mock / demo mode

`enableMockMode: true` forces mock adapters. Selector tiles show a subtle **Demo** badge.

`MockPaymentController` still supports `success` / `cancelled` / `failed`.

## Real provider roadmap

1. ~~Stripe card~~ (Phase 2)
2. ~~PayPal~~ (Phase 3)
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
