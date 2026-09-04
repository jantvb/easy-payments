# Easy Payments

Easy Payments is an Angular library that renders a checkout method list (Apple Pay, Google Pay, PayPal, Klarna, Affirm, and card) behind a single component and a single configuration API.

The public API is designed so mock/demo payments and real Stripe card payments use the same inputs, outputs, and result types.

## Current status

**Phase 6 — Real Affirm (via Stripe Payment Element) + Klarna + Google Pay TEST + PayPal Sandbox + Stripe card TEST.**

- Library foundation remains intact (ordering, themes, mocks, validation, events).
- **Real Stripe card** — Payment Element + PaymentIntent.
- **Real PayPal** — official Buttons + Orders v2 create/capture.
- **Real Google Pay TEST** — official `pay.js` + `PaymentsClient` + `createButton`, tokenized through Stripe `PAYMENT_GATEWAY`.
- **Real Klarna** — Stripe Payment Element + Klarna-only PaymentIntent (`payment_method_types: ['klarna']`). No direct Klarna SDK.
- **Real Affirm** — Stripe Payment Element + Affirm-only PaymentIntent (`payment_method_types: ['affirm']`). No Affirm.js / Affirm API secrets in Angular.
- Shared Stripe redirect recovery for Klarna + Affirm (`ep_method` + `retrievePaymentIntent`).
- NestJS demo backend provides trusted catalog pricing for Stripe/PayPal/Google Pay/Klarna/Affirm charges.
- **Mock mode still does not process real payments.**
- Real Apple Pay is **not** implemented yet.

Angular never accepts Stripe secret keys, PayPal Client Secrets, Klarna API secrets, or Affirm API secrets.

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

## Quick start (real Google Pay TEST)

```ts
provideEasyPayments({
  enableMockMode: false,
  providers: {
    stripe: {
      publishableKey: environment.stripePublishableKey,
    },
    googlePay: {
      environment: 'TEST',
      merchantName: 'Easy Payments Demo',
    },
  },
  backend: {
    createPaymentUrl: '/api/payments/create',
  },
});
```

```ts
methods: PaymentMethod[] = ['google-pay', 'card', 'paypal'];
```

Easy Payments loads Google `pay.js`, checks `isReadyToPay`, and renders the official Google Pay button. Stripe is the gateway/processor behind the scenes.

## Quick start (real Klarna via Stripe)

```ts
provideEasyPayments({
  enableMockMode: false,
  providers: {
    stripe: {
      publishableKey: environment.stripePublishableKey,
    },
    klarna: {
      purchaseCountry: 'US',
      locale: 'en-US',
    },
  },
  backend: {
    klarnaCreatePaymentUrl: '/api/payments/klarna/create',
  },
});
```

```ts
methods: PaymentMethod[] = ['klarna', 'card'];
```

Enable Klarna in the Stripe Dashboard (TEST). Angular uses the same `pk_test_...`; Nest uses `sk_test_...`. No Klarna API secrets in the browser.

## Quick start (real Affirm via Stripe)

```ts
provideEasyPayments({
  enableMockMode: false,
  providers: {
    stripe: { publishableKey: environment.stripePublishableKey },
    affirm: {
      purchaseCountry: 'US',
      locale: 'en-US',
    },
  },
  backend: {
    affirmCreatePaymentUrl: '/api/payments/affirm/create',
  },
});
```

```ts
methods: PaymentMethod[] = ['affirm', 'card'];
```

Enable **Affirm** in the Stripe Dashboard (TEST → Settings → Payment methods). Complete any Affirm onboarding Stripe requires. Angular reuses `pk_test_...`; Nest uses `sk_test_...`. No Affirm public/private API keys in the browser.

Demo product `premium-plan` ($99.99 USD) is within Affirm’s typical US presentment range (~$35–$30,000).

## Backend contract (provider-aware)

| Provider | Create | Capture / confirm |
| --- | --- | --- |
| Stripe | `POST /api/payments/create` | Payment Element confirms client-side |
| PayPal | `POST /api/payments/paypal/create` | `POST /api/payments/paypal/capture` |
| Klarna (via Stripe) | `POST /api/payments/klarna/create` | Payment Element confirms client-side |
| Affirm (via Stripe) | `POST /api/payments/affirm/create` | Payment Element confirms client-side |

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

## Google Pay integration

### Architecture decision

Easy Payments uses the **official Google Pay API for Web** (`google.payments.api.PaymentsClient`) with Stripe as the **PAYMENT_GATEWAY** processor.

Why Stripe gateway (not Google Pay Direct):

- Avoids decrypting payment credentials in Easy Payments / Nest
- Keeps PCI scope with Stripe
- Reuses the existing Stripe publishable key + PaymentIntent backend
- Matches Google’s documented Stripe gateway parameters

Public method remains `'google-pay'` (not “another Stripe Card UI”).

### Official APIs / SDK

| Layer | Technology |
| --- | --- |
| Frontend wallet | Google Pay JS `https://pay.google.com/gp/p/js/pay.js` |
| Button | Official `PaymentsClient.createButton(...)` |
| Readiness | Official `isReadyToPay(...)` |
| Tokenization | `PAYMENT_GATEWAY` → `gateway: 'stripe'` + `stripe:publishableKey` |
| Processing | Stripe.js `createPaymentMethod({ card: { token } })` + `confirmCardPayment` |
| Backend | Existing `POST /api/payments/create` (trusted catalog PaymentIntent) |

### Public configuration

```ts
provideEasyPayments({
  enableMockMode: false,
  providers: {
    stripe: {
      publishableKey: environment.stripePublishableKey, // required gateway key
    },
    googlePay: {
      environment: 'TEST', // default
      merchantName: 'Easy Payments Demo',
      countryCode: 'US',
      // merchantId optional in TEST (defaults to Google's TEST merchantId)
      // merchantId required for PRODUCTION
    },
  },
  backend: {
    createPaymentUrl: '/api/payments/create',
  },
});
```

Do **not** configure Stripe twice. Google Pay reuses `providers.stripe.publishableKey`.

### Flow

1. Customer selects **Google Pay** tile
2. Easy Payments lazy-loads `pay.js` once and calls `isReadyToPay`
3. Official Google Pay button is rendered (`createButton`)
4. On click: Nest creates a trusted PaymentIntent (catalog price)
5. Google Pay sheet opens with the **same** total
6. Customer authorizes → Google returns a Stripe gateway token
7. Easy Payments confirms the PaymentIntent via Stripe.js
8. Host receives normalized `(success)` / `(cancel)` / `(error)`

PaymentIntents are created **only on button click**, never on theme changes or method hover.

### Trusted pricing

Real / Test Providers mode loads Nest catalog (`premium-plan` → **99.99 USD**).

Displayed checkout total = Google Pay sheet total = Stripe charge total.

### TEST mode limitations (important)

Google’s `environment: 'TEST'`:

- Is suitable for testing button, sheet, readiness, and request wiring
- Does **not** return live chargeable payment credentials
- Stripe confirmation may therefore fail after a successful sheet close

That is expected Google behavior — Easy Payments does **not** fake success.

Stripe’s own Google Pay test-card suite applies mainly to Stripe-hosted Elements/Checkout paths. This integration uses Google’s native button + Stripe gateway tokens.

### Windows manual testing (Chrome / Edge)

1. Start NestJS: `npm run server:start`
2. Start demo: `npm start`
3. Open latest **Chrome** or **Edge** on Windows (`http://localhost:4200`)
4. Sign into a Google account that has an eligible payment method saved (Google may still require a real card in the wallet for the sheet to appear usefully)
5. Select **Real / Test Providers** (requires Stripe `pk_test_...` + Nest running)
6. Select the **Google Pay** tile
7. Confirm the official Google Pay button appears (not a custom CTA)
8. Click it → Google payment sheet should open
9. Complete / cancel the sheet
10. Inspect Network: `POST /api/payments/create` only after click; Console for Google/Stripe errors

Localhost is supported for Google Pay **TEST** development. Production requires HTTPS + registered domains.

### Cancellation

Closing the Google Pay sheet emits `(cancel)` with `status: 'cancelled'` — not a generic error.

### Common Google Pay errors

| Situation | Typical `PaymentError.code` |
| --- | --- |
| Missing Stripe publishableKey / createPaymentUrl | method unavailable |
| `pay.js` load failure | `SDK_LOAD_FAILED` |
| `isReadyToPay` false | method hidden / unavailable |
| User closes sheet | `PAYMENT_CANCELLED` → `(cancel)` |
| Invalid/non-chargeable TEST token | `PAYMENT_FAILED` / Stripe mapped error |
| Backend / network | `BACKEND_ERROR` / `NETWORK_ERROR` |

### Production requirements (not implemented yet)

- Google Pay & Wallet Console business profile / merchant registration
- Real Google Pay `merchantId` and production approval
- Register every web domain with Stripe Payment Method Domains (and Google as required)
- HTTPS with a valid TLS certificate
- `environment: 'PRODUCTION'`
- Production Stripe account + webhooks/fulfillment
- Google Pay brand compliance for buttons/marks

Do **not** ship PRODUCTION Google Pay until those steps are complete.

## Klarna integration (via Stripe)

Easy Payments does **not** load Klarna.js or use Klarna API credentials in Angular.
Klarna is enabled as a Stripe payment method and rendered through the same Stripe.js **Payment Element** used for cards.

| Layer | Technology |
| --- | --- |
| Frontend | Stripe.js Payment Element (`payment_method_types: ['klarna']` on the PaymentIntent) |
| Backend | Stripe PaymentIntents API with secret key (`sk_test_...` / `sk_live_...`) |
| Pricing | Trusted NestJS catalog (`productId` + `quantity` only) |

### Prerequisites

1. A Stripe account with **Klarna** enabled under Payment methods (Dashboard → Settings → Payment methods). Use TEST mode first.
2. The same Stripe TEST keys you already use for card:
   - `pk_test_...` in Angular (`providers.stripe.publishableKey`)
   - `sk_test_...` in NestJS (`server/.env` → `STRIPE_SECRET_KEY`) only
3. NestJS running with `POST /api/payments/klarna/create`

No Klarna Client ID / secret belongs in the Angular app.

### Configure Angular

```ts
provideEasyPayments({
  enableMockMode: false,
  providers: {
    stripe: {
      publishableKey: environment.stripePublishableKey, // pk_test_...
    },
    klarna: {
      purchaseCountry: 'US',
      locale: 'en-US',
    },
  },
  backend: {
    createPaymentUrl: '/api/payments/create',
    klarnaCreatePaymentUrl: '/api/payments/klarna/create',
  },
});
```

```ts
methods: PaymentMethod[] = ['klarna', 'card'];
```

Presence of `providers.klarna` (even `{}`) opts Klarna in. Runtime also requires Stripe `publishableKey` + `klarnaCreatePaymentUrl`.

### Flow

1. Customer selects the **Klarna** tile
2. Easy Payments creates a Klarna-only PaymentIntent via Nest (`productId` + `quantity` + `currency`)
3. Stripe Payment Element mounts (wallets disabled)
4. Customer completes Klarna within the Element / redirect (`redirect: 'if_required'`)
5. Normalized `PaymentResult` emits with `method: 'klarna'`, `provider: 'klarna'`, and `metadata.gateway: 'stripe'`

### Manual TEST checkout

1. Enable Klarna in the Stripe Dashboard (TEST).
2. Start NestJS with `STRIPE_SECRET_KEY=sk_test_...`.
3. Set `pk_test_...` and `klarnaCreatePaymentUrl` in the demo environment.
4. Switch the demo to **Real / Test Providers**.
5. Select **Klarna** → complete with Stripe’s documented Klarna test customer data (e.g. `customer@email.us` and other values from [Stripe Klarna testing](https://docs.stripe.com/payments/klarna/accept-a-payment#test-klarna)).
6. Confirm the PaymentIntent succeeds in the Stripe Dashboard.

### Production notes (Klarna)

- Activate Klarna for live charges in the Stripe Dashboard (and complete any Stripe/Klarna onboarding).
- Use `pk_live_...` / `sk_live_...` only after go-live checklist.
- Keep amounts server-trusted; never trust a browser-sent amount.
- Prefer HTTPS return URLs for redirects.
- Follow Klarna brand guidelines for marks / wording.

## Affirm integration (via Stripe)

Easy Payments does **not** load Affirm.js or use Affirm API credentials in Angular.
Affirm is enabled as a Stripe payment method and rendered through the Stripe.js **Payment Element**.

| Layer | Technology |
| --- | --- |
| Frontend | Stripe.js Payment Element (`payment_method_types: ['affirm']` on the PaymentIntent) |
| Backend | Stripe PaymentIntents API with secret key (`sk_test_...` / `sk_live_...`) |
| Pricing | Trusted NestJS catalog (`productId` + `quantity` only) |
| Redirect recovery | Shared with Klarna (`ep_method=affirm` + `retrievePaymentIntent`) |

### Prerequisites

1. Stripe Dashboard → Settings → Payment methods → **enable Affirm** (complete any Affirm onboarding Stripe requires — Affirm is not ready just because a Stripe API key exists).
2. Same Stripe TEST keys as card/Klarna:
   - `pk_test_...` in Angular
   - `sk_test_...` in NestJS only
3. NestJS `POST /api/payments/affirm/create`
4. US/CAD presentment; demo targets **US / USD**. Typical Affirm minimum ~**$35**, maximum ~**$30,000** (see [Stripe Affirm docs](https://docs.stripe.com/payments/affirm)).

### Configure Angular

```ts
provideEasyPayments({
  enableMockMode: false,
  providers: {
    stripe: { publishableKey: environment.stripePublishableKey },
    affirm: { purchaseCountry: 'US', locale: 'en-US' },
  },
  backend: {
    affirmCreatePaymentUrl: '/api/payments/affirm/create',
  },
});
```

Presence of `providers.affirm` (even `{}`) opts Affirm in. Runtime also requires Stripe `publishableKey` + `affirmCreatePaymentUrl`.

### Flow

1. Customer selects **Affirm**
2. Nest creates an Affirm-only PaymentIntent (trusted catalog amount)
3. Payment Element mounts
4. Customer completes Affirm (often redirect; `redirect: 'if_required'`)
5. On return, Easy Payments recovers via `retrievePaymentIntent` (does **not** create a new Intent)
6. Success confirmation shows **Paid with Affirm**

### Manual TEST checkout

1. Enable Affirm in Stripe Dashboard (TEST) and finish any required Affirm activation.
2. Start NestJS with `STRIPE_SECRET_KEY=sk_test_...`.
3. Demo env: `pk_test_...` + `affirmCreatePaymentUrl`.
4. **Real / Test Providers** → **Affirm**.
5. Complete Affirm sandbox. If prompted for SSN last-four, Stripe/Affirm docs suggest **`0000`** or **`5678`**.
6. Expect: Processing → Payment successful (Paid with Affirm, $99.99 USD).
7. Cancellation: close Affirm window → PaymentIntent often returns to `requires_payment_method` → error/retry (not silent checkout).
8. Production must verify final state with Stripe webhooks — browser success is not an accounting system.

### Payment Method Messaging

Stripe’s Payment Method Messaging Element can show Affirm financing copy pre-checkout. Not required for this payment flow; documented as a future enhancement.

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

## Checkout width

Easy Payments is fluid within its parent (`width: 100%`). Use `[maxWidth]` to control how wide the checkout may grow:

```html
<easy-payments
  [product]="product"
  [methods]="methods"
  [maxWidth]="1000"
  theme="system">
</easy-payments>
```

- Default max width: **640px** (polished 3×2 method grid for six methods)
- Library clamps to **320–1200px** (invalid / missing values fall back to 640)
- Payment-method columns reorganize from the **component container width** (CSS container queries), not the browser viewport — so sidebars, modals, and CMS embeds layout correctly
- At ~880px+ container width, six methods can sit on one row when each tile stays usable

Do not micro-manage tile columns; only set overall checkout size.

## Themes

`light` · `dark` · `system` (`prefers-color-scheme`, live updates).

## Third-Party Trademarks

Apple Pay, Google Pay, PayPal, Klarna, Affirm, Stripe, Visa, Mastercard, American Express, Discover, and related marks are trademarks of their respective owners. Easy Payments does **not** claim ownership of these marks.

Official provider artwork is used only to identify supported payment options in the checkout selector and must follow each provider’s current brand guidelines. Downloading or installing Easy Payments does **not** grant unrestricted trademark rights.

Consumers are responsible for:

- Merchant / partner onboarding with each payment provider before production use
- Complying with that provider’s branding, button, and checkout requirements
- Obtaining any additional official assets required by the provider

Current asset approach:

| Method | Asset approach |
| --- | --- |
| Card | Generic neutral icon (not a card-network logo) |
| Apple Pay | Official Apple Pay mark from Apple’s marketing mark package |
| Google Pay | Official Google Pay mark from Google’s acceptance mark package |
| PayPal | PayPal-hosted assets (`paypalobjects.com`) |
| Klarna | Klarna-hosted badge CDN |
| Affirm | Affirm-hosted CDN logos |

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
3. ~~Google Pay~~ (Phase 4 — TEST via Stripe gateway)
4. ~~Klarna~~ (Phase 5 — via Stripe Payment Element)
5. ~~Affirm~~ (Phase 6 — via Stripe Payment Element)
6. Apple Pay
7. Samsung Pay — under consideration for a future release

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
