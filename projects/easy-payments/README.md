# Easy Payments

### A unified payment experience for Angular.

Easy Payments gives Angular apps one consistent checkout for multiple payment methods — simple on the outside, powerful on the inside.

![Version 1.0.0](https://img.shields.io/badge/version-1.0.0-0A7EA4)
![Angular 20.3+ · 21 · 22](https://img.shields.io/badge/Angular-≥20.3%20·%2021%20·%2022-DD0031)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

| | |
|---|---|
| **Version** | 1.0.0 (first stable public release) |
| **Framework** | Angular |
| **Compatibility** | Angular **20.3+**, **21**, **22** (`>=20.3.0 <23.0.0`) |
| **Workspace** | Built with Angular **22.1.5** |
| **Methods** | Card · PayPal · Apple Pay · Google Pay · Klarna · Affirm |

<p align="center">
  <img src="https://raw.githubusercontent.com/jantvb/easy-payments/v1.0.0/docs/assets/easy-payments-desktop.png" alt="Easy Payments checkout — desktop viewport" width="640" />
</p>

<p align="center">
  <a href="docs/getting-started.md">Getting Started</a> ·
  <a href="docs/api.md">API</a> ·
  <a href="docs/payment-flow.md">Payment flow</a> ·
  <a href="docs/configuration.md">Configuration</a> ·
  <a href="projects/demo">Demo source</a> ·
  <a href="https://github.com/jantvb/easy-payments/issues">Issues</a>
</p>

---

## Angular Compatibility

| Easy Payments | Angular |
|---------------|---------|
| **1.0.0** | `>=20.3.0 <23.0.0` |

- **Workspace / build:** Angular **22.1.5**
- **Consumer peers:** `>=20.3.0 <23.0.0`
- **Validated** with packed installs into fresh apps on Angular **20**, **21**, and **22**

v1.0.0 does **not** support Angular 19, Angular 23+, or non-Angular frameworks.

---

## Preview

Screenshots are **real captures** of the local demo using browser viewport emulation (not physical device claims).

<table>
  <tr>
    <td align="center" width="50%">
      <strong>Desktop</strong><br />
      <img src="https://raw.githubusercontent.com/jantvb/easy-payments/v1.0.0/docs/assets/easy-payments-desktop.png" alt="Desktop viewport" width="420" />
    </td>
    <td align="center" width="50%">
      <strong>Mobile</strong><br />
      <img src="https://raw.githubusercontent.com/jantvb/easy-payments/v1.0.0/docs/assets/easy-payments-mobile.png" alt="Mobile viewport" width="220" />
    </td>
  </tr>
  <tr>
    <td align="center">
      <strong>Tablet</strong><br />
      <img src="https://raw.githubusercontent.com/jantvb/easy-payments/v1.0.0/docs/assets/easy-payments-tablet.png" alt="Tablet viewport" width="360" />
    </td>
    <td align="center">
      <strong>iPad viewport</strong><br />
      <img src="https://raw.githubusercontent.com/jantvb/easy-payments/v1.0.0/docs/assets/easy-payments-ipad.png" alt="iPad viewport" width="360" />
    </td>
  </tr>
  <tr>
    <td align="center">
      <strong>Light</strong><br />
      <img src="https://raw.githubusercontent.com/jantvb/easy-payments/v1.0.0/docs/assets/easy-payments-light.png" alt="Light theme" width="360" />
    </td>
    <td align="center">
      <strong>Dark</strong><br />
      <img src="https://raw.githubusercontent.com/jantvb/easy-payments/v1.0.0/docs/assets/easy-payments-dark.png" alt="Dark theme" width="360" />
    </td>
  </tr>
  <tr>
    <td align="center">
      <strong>Default appearance</strong><br />
      <img src="https://raw.githubusercontent.com/jantvb/easy-payments/v1.0.0/docs/assets/easy-payments-default.png" alt="Default appearance" width="360" />
    </td>
    <td align="center">
      <strong>Transparent appearance</strong><br />
      <img src="https://raw.githubusercontent.com/jantvb/easy-payments/v1.0.0/docs/assets/easy-payments-transparent.png" alt="Transparent appearance" width="360" />
    </td>
  </tr>
  <tr>
    <td align="center">
      <strong>Success</strong><br />
      <img src="https://raw.githubusercontent.com/jantvb/easy-payments/v1.0.0/docs/assets/easy-payments-success.png" alt="Success confirmation" width="360" />
    </td>
    <td align="center">
      <strong>Custom method order</strong><br />
      <img src="https://raw.githubusercontent.com/jantvb/easy-payments/v1.0.0/docs/assets/easy-payments-method-order.png" alt="Custom payment method order" width="360" />
    </td>
  </tr>
</table>

<p align="center">
  <strong>Laptop</strong><br />
  <img src="https://raw.githubusercontent.com/jantvb/easy-payments/v1.0.0/docs/assets/easy-payments-laptop.png" alt="Laptop viewport" width="480" />
</p>

> **npm note:** Screenshot `src` values use immutable absolute URLs on the `v1.0.0` tag (`raw.githubusercontent.com/.../v1.0.0/docs/assets/...`) so images render on npm after publish. See [docs/npm-readme-images.md](docs/npm-readme-images.md).

---

## Payment Experience

Customers move through a consistent journey even when providers differ mid-flow:

**Checkout → Provider interaction → Processing → Success**

Alternate outcomes: **Processing → Error**, or **Provider flow → Cancelled**.

<table>
  <tr>
    <td align="center" width="50%">
      <strong>Processing</strong><br />
      <img src="https://raw.githubusercontent.com/jantvb/easy-payments/v1.0.0/docs/assets/easy-payments-processing.png" alt="Processing payment" width="360" />
    </td>
    <td align="center" width="50%">
      <strong>Success</strong><br />
      <img src="https://raw.githubusercontent.com/jantvb/easy-payments/v1.0.0/docs/assets/easy-payments-success.png" alt="Payment successful" width="360" />
    </td>
  </tr>
  <tr>
    <td align="center">
      <strong>Error</strong><br />
      <img src="https://raw.githubusercontent.com/jantvb/easy-payments/v1.0.0/docs/assets/easy-payments-error.png" alt="Payment failed" width="360" />
    </td>
    <td align="center">
      <strong>Cancelled</strong><br />
      <img src="https://raw.githubusercontent.com/jantvb/easy-payments/v1.0.0/docs/assets/easy-payments-cancelled.png" alt="Payment cancelled" width="360" />
    </td>
  </tr>
</table>

Full states (redirects, `successBehavior`, events): **[docs/payment-flow.md](docs/payment-flow.md)**

---

## What Easy Payments is / is not

**Is:** Angular payment integration library · unified checkout UI · provider abstraction · normalized events/errors  

**Is not:** a payment processor · bank · merchant of record · Stripe/PayPal replacement · trusted pricing backend  

Money settles to **your** Stripe / PayPal (and related) merchant accounts.

---

## Installation

```bash
npm install @easy-payments/angular @stripe/stripe-js
```

> Package name: **`@easy-payments/angular`**. Until npm publish of 1.0.0, install from a local `npm pack` of `dist/easy-payments` or a `file:` path.

Peers: `@angular/core` / `@angular/common` `>=20.3.0 <23.0.0`, `@stripe/stripe-js` `^8.0.0`.

---

## Quick Start

1. Install  
2. Configure providers + backend URLs with `provideEasyPayments(...)`  
3. Define a `PaymentProduct`  
4. Choose `methods` (allow-list **and** visual order — no separate `order` input)  
5. Add `<easy-payments>`  
6. Handle `(success)` / `(cancel)` / `(error)` / `(successContinue)`

```ts
import { provideEasyPayments } from '@easy-payments/angular';

provideEasyPayments({
  providers: {
    stripe: { publishableKey: 'YOUR_STRIPE_PUBLISHABLE_KEY' },
    paypal: { clientId: 'YOUR_PAYPAL_CLIENT_ID' },
    applePay: {},
    googlePay: { environment: 'TEST' },
    klarna: {},
    affirm: {},
  },
  backend: {
    createPaymentUrl: '/api/payments/create',
    paypalCreateOrderUrl: '/api/payments/paypal/create',
    paypalCaptureOrderUrl: '/api/payments/paypal/capture',
    klarnaCreatePaymentUrl: '/api/payments/klarna/create',
    affirmCreatePaymentUrl: '/api/payments/affirm/create',
  },
});
```

```html
<easy-payments
  [product]="product"
  [methods]="['card', 'paypal', 'apple-pay', 'google-pay', 'klarna', 'affirm']"
  theme="system"
  appearance="default"
  [maxWidth]="640"
  (success)="onSuccess($event)"
  (cancel)="onCancel($event)"
  (error)="onError($event)"
/>
```

Full walkthrough: **[docs/getting-started.md](docs/getting-started.md)**  

**View complete example:** [`projects/demo`](projects/demo) · **Library source:** [`projects/easy-payments`](projects/easy-payments) · **Reference backend:** [`server`](server)

---

## Component API (summary)

| Input | Type | Default | Notes |
|-------|------|---------|-------|
| `product` | `PaymentProduct` | — | **Required** |
| `methods` | `PaymentMethod[]` | `['apple-pay','google-pay','paypal','card']` | Allow-list + order |
| `checkout` | `CheckoutOptions` | — | Optional URLs / successBehavior / customer |
| `theme` | `'light' \| 'dark' \| 'system'` | `'system'` | System follows OS and updates live |
| `appearance` | `'default' \| 'transparent'` | `'default'` | Independent of theme |
| `maxWidth` | `number \| string \| null` | `640` | Clamped **320–1200** |
| `successBehavior` | `'confirmation' \| 'event-only'` | `'confirmation'` | Overridable via `checkout` |

| Output | Payload |
|--------|---------|
| `success` | `PaymentResult` |
| `cancel` | `PaymentResult` |
| `error` | `PaymentError` |
| `successContinue` | `PaymentResult` |

Complete reference: **[docs/api.md](docs/api.md)** · Recipes: **[docs/configuration.md](docs/configuration.md)**

---

## Responsive Design

Checkout is fluid up to `[maxWidth]`. The payment method grid reflows from the **component container width** (works in sidebars, modals, and embeds — not viewport-only). See Preview screenshots above.

---

## Provider credentials

| Provider | Frontend | Backend | Notes |
|----------|----------|---------|-------|
| **Stripe** | `pk_test_` / `pk_live_` | `sk_test_` / `sk_live_` | Card + wallets + Klarna + Affirm |
| **PayPal** | Client ID | Client Secret | Create + capture URLs |
| **Apple Pay** | `applePay: {}` + Stripe | Stripe secret via create URL | Stripe ECE; capability-based |
| **Google Pay** | `googlePay` + Stripe | Stripe secret via create URL | `TEST` / `PRODUCTION` |
| **Klarna** | `klarna` + Stripe | Stripe + `klarnaCreatePaymentUrl` | Redirect + return recovery |
| **Affirm** | `affirm` + Stripe | Stripe + `affirmCreatePaymentUrl` | ~$35 min in library; eligibility varies |

Details: [docs/providers/](docs/providers/) · Security: [docs/security.md](docs/security.md)

> **Never** put Stripe secret keys or PayPal Client Secrets in Angular.

---

## Backend

A backend is required for secrets, trusted pricing, and captures.

Any language works (NestJS, Express, .NET, Java, PHP, Python, Go, …) if it implements the [HTTP contract](docs/backend.md).

This repo’s [`server/`](server) NestJS app is a **reference example**, not a production mandate.

---

## Explore the Project

| Area | Path |
|------|------|
| Library | [`projects/easy-payments`](projects/easy-payments) |
| Angular demo | [`projects/demo`](projects/demo) |
| Reference backend | [`server`](server) |
| Documentation | [`docs`](docs) |
| Issues | [GitHub Issues](https://github.com/jantvb/easy-payments/issues) |

Public-facing release branch: **`release/1.0.0`** (see [docs/release-branch.md](docs/release-branch.md)).

---

## Running the Example Locally

```bash
npm install
npm run build:lib
npm start
```

Demo: http://localhost:4200

```bash
cd server
npm install
# copy .env.example → .env (TEST secrets only)
npm run start:dev
```

API: http://localhost:3000  

More: [docs/demo.md](docs/demo.md)

---

## Testing Payments

- Stripe **Test** mode + test cards  
- PayPal **Sandbox**  
- Google Pay `environment: 'TEST'`  
- Demo Mode in the playground (mocks — no real charges)  

Do not use live credentials for basic integration testing.

---

## Going to Production

- Live publishable / secret credentials (backend secrets stay server-side)  
- Trusted server pricing  
- HTTPS  
- Stripe Payment Method Domains (wallets)  
- PayPal Live + Google Pay PRODUCTION merchant ID when applicable  
- Klarna / Affirm eligibility & approvals  
- Webhooks / reconciliation  
- Auth, rate limits, logging, CSP review  

---

## FAQ

**What Angular versions are supported?** 20.3+, 21, and 22 (`>=20.3.0 <23.0.0`).  

**Is Easy Payments a payment processor?** No — it integrates your Stripe/PayPal accounts.  

**Where does the money go?** To your merchant accounts with those providers.  

**Do I need Stripe / PayPal?** Only for the methods you enable.  

**Do I need a backend?** Yes for real payments.  

**Can I use my own backend language?** Yes — implement the contract.  

**Can I choose method order?** Yes — `methods` array order. No separate `order` property.  

**Dark / light / system / transparent / width?** Yes — see [configuration](docs/configuration.md).  

**Does Apple Pay / Google Pay always appear?** No — capability and configuration dependent.  

**How do I report a bug or suggest a feature?** [GitHub Issues](https://github.com/jantvb/easy-payments/issues).  

**Can I inspect the source / demo / backend?** Yes — links above.  

**How can I support the project?** Optional contributions via [PayPal](https://paypal.me/JoseVicente07) — not required to use the library.

---

## Community & Feedback

Prefer **[GitHub Issues](https://github.com/jantvb/easy-payments/issues)** for bugs, features, provider ideas, docs, compatibility, and a11y/UX suggestions.

Project contact (general / private): **jantvb@gmail.com**

Contributing guide: [CONTRIBUTING.md](CONTRIBUTING.md)

---

## Support Easy Payments

Easy Payments is open source and free to use.

If Easy Payments saves you development time or helps your project, you can support its continued development with an optional contribution.

[Support Easy Payments via PayPal](https://paypal.me/JoseVicente07)

This is an optional way to support the open-source project. It is **not** a license fee, subscription, or related to merchant payments processed through Easy Payments.

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for **1.0.0**.

---

## License

MIT © 2026 Jose Vicente — see [LICENSE](LICENSE).
