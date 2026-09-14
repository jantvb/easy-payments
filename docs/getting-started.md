# Getting Started

Easy Payments **v1.1.0** is an **Angular** library that renders a unified checkout for:

Card · PayPal · Apple Pay · Google Pay · Klarna · Affirm

Built-in UI locales: **`auto` · `en` · `es` · `pt`**.

You mainly:

1. Install the package  
2. Configure providers + backend URLs with `provideEasyPayments(...)`  
3. Pass a `PaymentProduct` and allowed `methods`  
4. Optionally set `theme` / `appearance` / `maxWidth` / `locale`  
5. Handle `success` / `cancel` / `error` / `successContinue`

---

## Angular compatibility

| Easy Payments | Angular peers |
|---------------|---------------|
| **1.1.x** | `>=20.3.0 <23.0.0` |
| **1.0.x** | `>=20.3.0 <23.0.0` |

- Workspace build: **Angular 22.1.5**
- Validated consumers: **Angular 20**, **21**, and **22**
- Not supported: Angular 19, Angular 23+, or non-Angular frameworks

---

## Installation

```bash
npm install @easy-payments/angular @stripe/stripe-js
```

> The npm package name is `@easy-payments/angular`.

Peer dependencies:

- `@angular/core` / `@angular/common` `>=20.3.0 <23.0.0`
- `@stripe/stripe-js` `^8.0.0`

---

## Quick Start (standalone Angular)

File-by-file walkthrough. **No NgModules.**

### 1. Install

```bash
npm install @easy-payments/angular @stripe/stripe-js
```

### 2. `app.config.ts`

Register HTTP and Easy Payments configuration:

```ts
import { ApplicationConfig } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideEasyPayments } from '@easy-payments/angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    provideEasyPayments({
      providers: {
        stripe: { publishableKey: 'pk_test_...' },
        paypal: { clientId: 'YOUR_PAYPAL_CLIENT_ID', currency: 'USD', intent: 'capture' },
        applePay: {},
        googlePay: { environment: 'TEST' },
        klarna: { purchaseCountry: 'US' },
        affirm: { purchaseCountry: 'US' },
      },
      backend: {
        createPaymentUrl: 'https://your-backend.example/api/payments/create',
        paypalCreateOrderUrl: 'https://your-backend.example/api/payments/paypal/create',
        paypalCaptureOrderUrl: 'https://your-backend.example/api/payments/paypal/capture',
        klarnaCreatePaymentUrl: 'https://your-backend.example/api/payments/klarna/create',
        affirmCreatePaymentUrl: 'https://your-backend.example/api/payments/affirm/create',
      },
    }),
  ],
};
```

`EasyPaymentsConfig`:

```ts
{
  providers: {
    stripe?: { publishableKey: string };
    paypal?: { clientId: string; currency?: string; intent?: 'capture' | 'authorize' };
    applePay?: { /* optional display fields */ };
    googlePay?: { merchantId?; merchantName?; environment?; countryCode? };
    klarna?: { purchaseCountry?; locale? };
    affirm?: { purchaseCountry?; locale? };
  };
  backend?: {
    createPaymentUrl?;
    paypalCreateOrderUrl?;
    paypalCaptureOrderUrl?;
    klarnaCreatePaymentUrl?;
    affirmCreatePaymentUrl?;
  };
  enableMockMode?: boolean;
}
```

Never put Stripe secret keys or PayPal Client Secrets in Angular.

### 3. `app.component.ts`

```ts
import { Component } from '@angular/core';
import {
  EasyPaymentsComponent,
  PaymentError,
  PaymentMethod,
  PaymentProduct,
  PaymentResult,
  type EasyPaymentsTranslationOverrides,
} from '@easy-payments/angular';

@Component({
  selector: 'app-root',
  imports: [EasyPaymentsComponent],
  templateUrl: './app.component.html',
})
export class AppComponent {
  readonly product: PaymentProduct = {
    id: 'premium-plan',
    name: 'Premium Plan',
    description: 'One year subscription',
    amount: 99, // major units: 99 = $99.00 USD (not cents)
    currency: 'USD',
    quantity: 1,
  };

  readonly methods: PaymentMethod[] = [
    'card',
    'paypal',
    'apple-pay',
    'google-pay',
    'klarna',
    'affirm',
  ];

  /** Optional partial overrides for Easy Payments-owned UI text. */
  readonly translations: EasyPaymentsTranslationOverrides = {
    // successTitle: 'You are all set!',
  };

  onSuccess(result: PaymentResult): void {
    console.log('paid', result);
  }

  onCancel(result: PaymentResult): void {
    console.log('cancelled', result);
  }

  onError(error: PaymentError): void {
    console.error(error.code, error.message);
  }

  onContinue(result: PaymentResult): void {
    console.log('continue after confirmation', result);
  }
}
```

`PaymentProduct` fields: `id`, `name`, `amount`, `currency` (required); `quantity?`, `description?`, `imageUrl?`, `metadata?`.

**Amount is major currency units** (dollars, not cents). Example: `amount: 99` + `currency: 'USD'` → **$99.00**.

### 4. `app.component.html`

```html
<easy-payments
  [product]="product"
  [methods]="methods"
  theme="system"
  appearance="default"
  [maxWidth]="640"
  locale="auto"
  [translations]="translations"
  (success)="onSuccess($event)"
  (cancel)="onCancel($event)"
  (error)="onError($event)"
  (successContinue)="onContinue($event)"
/>
```

| Input | Notes |
|-------|--------|
| `product` | Required |
| `methods` | Allow-list **and** visual order (no separate `order`) |
| `checkout` | Optional checkout options |
| `theme` | `'light' \| 'dark' \| 'system'` |
| `appearance` | `'default' \| 'transparent'` |
| `maxWidth` | Default `640`, clamped 320–1200 |
| `successBehavior` | `'confirmation' \| 'event-only'` |
| `locale` | `'auto' \| 'en' \| 'es' \| 'pt'` (default `auto`) |
| `translations` | Partial string overrides |

| Output | Notes |
|--------|--------|
| `success` | `PaymentResult` |
| `cancel` | `PaymentResult` — **not** `cancelled` |
| `error` | `PaymentError` |
| `successContinue` | Fired when the customer continues from the built-in success screen |

---

## Complete copy/paste example

Minimal standalone app pieces:

**`app.config.ts`**

```ts
import { ApplicationConfig } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideEasyPayments } from '@easy-payments/angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    provideEasyPayments({
      providers: {
        stripe: { publishableKey: 'pk_test_...' },
      },
      backend: {
        createPaymentUrl: '/api/payments/create',
      },
    }),
  ],
};
```

**`app.component.ts`**

```ts
import { Component } from '@angular/core';
import {
  EasyPaymentsComponent,
  PaymentError,
  PaymentProduct,
  PaymentResult,
} from '@easy-payments/angular';

@Component({
  selector: 'app-root',
  imports: [EasyPaymentsComponent],
  templateUrl: './app.component.html',
})
export class AppComponent {
  readonly product: PaymentProduct = {
    id: 'sku-1',
    name: 'Demo Product',
    amount: 49.99,
    currency: 'USD',
  };

  onSuccess(r: PaymentResult): void {
    console.log(r);
  }
  onCancel(r: PaymentResult): void {
    console.log(r);
  }
  onError(e: PaymentError): void {
    console.error(e);
  }
}
```

**`app.component.html`**

```html
<easy-payments
  [product]="product"
  [methods]="['card']"
  locale="auto"
  (success)="onSuccess($event)"
  (cancel)="onCancel($event)"
  (error)="onError($event)"
/>
```

---

## Localization

- Default `locale="auto"` follows the browser language when possible.
- Force a language with `locale="en"`, `locale="es"`, or `locale="pt"`.
- Override individual strings with `[translations]`.
- Locale formats money for **display only** — it does **not** convert currency.

Details: **[localization.md](./localization.md)**

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `'easy-payments' is not a known element` | Add `EasyPaymentsComponent` to the host component `imports` array. Confirm `provideEasyPayments` is registered in `app.config.ts`. |
| No methods shown | Configure matching `providers` / backend URLs and list them in `[methods]`. |
| Wrong UI language | Set `locale` explicitly, or verify browser language detection for `auto`. |
| Amount looks 100× too small/large | Use **major units** (`99` = $99.00), not Stripe cents. |

---

## Explore examples

| What | Where |
|------|-------|
| Full Angular demo | [`projects/demo`](../projects/demo) |
| Library source | [`projects/easy-payments`](../projects/easy-payments) |
| NestJS reference backend | [`server`](../server) |
| Localization | [`localization.md`](./localization.md) |
| API reference | [`api.md`](./api.md) |
| Configuration recipes | [`configuration.md`](./configuration.md) |
| Backend contract | [`backend.md`](./backend.md) |
| Security | [`security.md`](./security.md) |

---

## Run the demo locally

```bash
npm install
npm run build:lib

# Optional: local TEST credentials (gitignored)
cp projects/demo/src/environments/environment.local.example.ts ^
   projects/demo/src/environments/environment.local.ts
# edit environment.local.ts — YOUR_* → pk_test_... / PayPal Client ID

npm start
```

Demo: http://localhost:4200  

Backend (Real / Test Providers):

```bash
cd server
npm install
cp .env.example .env   # fill YOUR_* with TEST secrets (gitignored)
npm run start:dev
```

Server: http://localhost:3000  

Details: [demo.md](./demo.md)
