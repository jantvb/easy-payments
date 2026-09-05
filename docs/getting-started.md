# Getting Started

Easy Payments v1.0.0 is an **Angular** library that renders a unified checkout for:

Card · PayPal · Apple Pay · Google Pay · Klarna · Affirm

**Simple outside. Powerful inside.**

You mainly:

1. Install the package  
2. Configure providers + backend URLs  
3. Pass a product and allowed methods  
4. Choose theme / appearance / width  
5. Handle `success` / `cancel` / `error`

---

## Angular compatibility

| Easy Payments | Angular peers |
|---------------|---------------|
| **1.0.0** | `>=20.3.0 <23.0.0` |

- Workspace build: **Angular 22.1.5**
- Validated consumers: **Angular 20**, **21**, and **22**
- Not supported in v1.0.0: Angular 19, Angular 23+, React, Vue, Svelte

---

## Installation

```bash
npm install easy-payments @stripe/stripe-js
```

> The npm package name is `easy-payments`. Until you publish v1.0.0, install from a packed build (`npm pack` of `dist/easy-payments`) or a local path.

Peer dependencies:

- `@angular/core` / `@angular/common` `>=20.3.0 <23.0.0`
- `@stripe/stripe-js` `^8.0.0`

---

## Quick Start

### 1. Provide configuration

```ts
import { ApplicationConfig } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideEasyPayments } from 'easy-payments';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
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
        createPaymentUrl: 'https://your-backend-domain.example/api/payments/create',
        paypalCreateOrderUrl: 'https://your-backend-domain.example/api/payments/paypal/create',
        paypalCaptureOrderUrl: 'https://your-backend-domain.example/api/payments/paypal/capture',
        klarnaCreatePaymentUrl: 'https://your-backend-domain.example/api/payments/klarna/create',
        affirmCreatePaymentUrl: 'https://your-backend-domain.example/api/payments/affirm/create',
      },
    }),
  ],
};
```

Never put Stripe secret keys or PayPal Client Secrets in Angular.

### 2. Render checkout

```ts
import { Component } from '@angular/core';
import {
  EasyPaymentsComponent,
  PaymentError,
  PaymentMethod,
  PaymentProduct,
  PaymentResult,
} from 'easy-payments';

@Component({
  selector: 'app-checkout',
  imports: [EasyPaymentsComponent],
  template: `
    <easy-payments
      [product]="product"
      [methods]="methods"
      theme="system"
      appearance="default"
      [maxWidth]="640"
      (success)="onSuccess($event)"
      (cancel)="onCancel($event)"
      (error)="onError($event)"
      (successContinue)="onContinue($event)"
    />
  `,
})
export class CheckoutPage {
  readonly product: PaymentProduct = {
    id: 'premium-plan',
    name: 'Premium Plan',
    description: 'One year subscription',
    amount: 99,
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

The `methods` array controls **which** methods are allowed and their **visual order**. No separate `order` property.

---

## Explore examples

| What | Where |
|------|-------|
| Full Angular demo | [`projects/demo`](../projects/demo) |
| Library source | [`projects/easy-payments`](../projects/easy-payments) |
| NestJS reference backend | [`server`](../server) |
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
