# Easy Payments API Reference (v1.0.0)

Complete public API for the Angular `<easy-payments>` component and related exports.

Package: `@easypaymentsjs/angular`  
Peers: `@angular/core` / `@angular/common` `>=20.3.0 <23.0.0`, `@stripe/stripe-js` `^8.0.0`

---

## Component: `<easy-payments>`

Standalone component. Selector: `easy-payments`.

### Inputs

| Property | Type | Default | Required | Allowed values | Description |
|----------|------|---------|----------|----------------|-------------|
| `product` | `PaymentProduct` | — | **Yes** | see [PaymentProduct](#paymentproduct) | Product/checkout line shown to the customer and sent to your backend. |
| `methods` | `PaymentMethod[]` | `['apple-pay','google-pay','paypal','card']` | No | `apple-pay`, `google-pay`, `paypal`, `klarna`, `affirm`, `card` | Allowed methods **and** preferred visual order. Unavailable methods are omitted; relative order of available methods is preserved. No separate `order` input. |
| `checkout` | `CheckoutOptions` | `undefined` | No | see below | Optional checkout hints (`successUrl`, `cancelUrl`, `successBehavior`, customer, shipping). |
| `theme` | `PaymentTheme` | `'system'` | No | `light`, `dark`, `system` | Color theme. `system` follows `prefers-color-scheme` and updates when the preference changes. |
| `appearance` | `EasyPaymentsAppearance` | `'default'` | No | `default`, `transparent` | Outer shell. Independent of `theme`. `transparent` removes built-in card chrome. |
| `maxWidth` | `number \| string \| null \| undefined` | `640` | No | clamped to **320–1200** px | Max checkout width. Component stays `width: 100%` up to this cap. Invalid values fall back to `640`. |
| `successBehavior` | `CheckoutSuccessBehavior` | `'confirmation'` | No | `confirmation`, `event-only` | Built-in success UI vs emit-only. Overridden by `checkout.successBehavior` when set. |

#### Examples

```html
<easy-payments
  [product]="product"
  [methods]="methods"
  theme="system"
  appearance="default"
  [maxWidth]="640"
  successBehavior="confirmation"
  (success)="onSuccess($event)"
  (cancel)="onCancel($event)"
  (error)="onError($event)"
  (successContinue)="onContinue($event)"
/>
```

```html
<easy-payments
  [product]="product"
  [methods]="['paypal', 'card', 'google-pay']"
  theme="dark"
  appearance="transparent"
  [maxWidth]="520"
  successBehavior="event-only"
/>
```

### Outputs

| Event | Payload | When it fires | Typical use |
|-------|---------|---------------|-------------|
| `success` | `PaymentResult` | Payment completed successfully | Persist order, navigate, analytics |
| `cancel` | `PaymentResult` | Customer cancelled (or equivalent cancel path) | Restore cart UX, messaging |
| `error` | `PaymentError` | Payment or configuration failure | Show merchant error UI |
| `successContinue` | `PaymentResult` | Customer clicks **Continue** on the built-in success screen | Only when `successBehavior` is `confirmation` |

> There is **no** public `busyChange` output on `<easy-payments>` in v1.0.0. Processing locks the checkout UI internally; use the visible processing screen and the events above. See [payment-flow.md](./payment-flow.md).

---

## PaymentProduct

```ts
interface PaymentProduct {
  id: string;
  name: string;
  description?: string;
  amount: number;
  currency: string;
  quantity?: number;
  imageUrl?: string;
  metadata?: Record<string, string>;
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | Yes | Merchant product id (trusted pricing key on the backend). |
| `name` | `string` | Yes | Display name. |
| `description` | `string` | No | Short description. |
| `amount` | `number` | Yes | Unit amount in major currency units (e.g. `99` = $99.00). **Do not trust as production authority** — backend must validate. |
| `currency` | `string` | Yes | ISO currency code (e.g. `USD`). |
| `quantity` | `number` | No | Quantity (defaults treated as 1 when omitted/invalid in demo flows). |
| `imageUrl` | `string` | No | Optional product image URL. |
| `metadata` | `Record<string, string>` | No | Optional non-sensitive metadata. |

### Minimal

```ts
const product: PaymentProduct = {
  id: 'premium-plan',
  name: 'Premium Plan',
  amount: 99,
  currency: 'USD',
};
```

### Complete

```ts
const product: PaymentProduct = {
  id: 'premium-plan',
  name: 'Premium Plan',
  description: 'One year subscription',
  amount: 99,
  currency: 'USD',
  quantity: 1,
  imageUrl: 'https://example.com/premium.png',
  metadata: { sku: 'PREM-1' },
};
```

---

## CheckoutOptions

```ts
type CheckoutSuccessBehavior = 'confirmation' | 'event-only';

interface CheckoutOptions {
  successUrl?: string;
  cancelUrl?: string;
  successBehavior?: CheckoutSuccessBehavior;
  customer?: { email?: string; name?: string };
  shipping?: { required?: boolean };
}
```

Notes:

- `successUrl` / `cancelUrl` are **merchant hints**. Easy Payments does **not** auto-redirect on them.
- `successBehavior` on `checkout` overrides the `successBehavior` input when present.

| Value | Meaning |
|-------|---------|
| `confirmation` | Show built-in success screen; emit `success`, then `successContinue` when Continue is clicked. |
| `event-only` | Emit `success` only; merchant owns post-payment UX. |

---

## PaymentMethod

```ts
type PaymentMethod =
  | 'apple-pay'
  | 'google-pay'
  | 'paypal'
  | 'klarna'
  | 'affirm'
  | 'card';
```

`PAYMENT_METHOD_LABELS` maps each method to a display label.

---

## Themes & appearance

```ts
type PaymentTheme = 'light' | 'dark' | 'system';
type ResolvedPaymentTheme = 'light' | 'dark';
type EasyPaymentsAppearance = 'default' | 'transparent';
```

- `theme` and `appearance` are **independent**.
- Layout reflows from the **component container width** (not only the viewport), via `[maxWidth]` (320–1200, default 640).

Public layout constants:

| Constant | Value |
|----------|-------|
| `MIN_CHECKOUT_WIDTH` | `320` |
| `DEFAULT_CHECKOUT_MAX_WIDTH` | `640` |
| `MAX_CHECKOUT_WIDTH` | `1200` |

---

## PaymentResult

```ts
type PaymentStatus = 'success' | 'cancelled' | 'failed';

interface PaymentResult {
  status: PaymentStatus;
  method: PaymentMethod;
  provider: PaymentProviderName;
  transactionId?: string;
  sessionId?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}
```

`normalizePaymentResult(result)` returns a shallow-normalized copy.

---

## PaymentError

```ts
type PaymentErrorCode =
  | 'CONFIG_MISSING'
  | 'CONFIG_INVALID'
  | 'PRODUCT_INVALID'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'PAYMENT_CANCELLED'
  | 'PAYMENT_FAILED'
  | 'CARD_DECLINED'
  | 'AUTHENTICATION_REQUIRED'
  | 'AUTHENTICATION_FAILED'
  | 'NETWORK_ERROR'
  | 'SDK_LOAD_FAILED'
  | 'BACKEND_ERROR'
  | 'PROVIDER_NOT_IMPLEMENTED'
  | 'UNKNOWN';

class PaymentError extends Error {
  readonly code: PaymentErrorCode;
  readonly method?: PaymentMethod;
  readonly provider?: PaymentProviderName;
  readonly originalError?: unknown;
}
```

`normalizeError(error, fallback?)` converts unknown errors into `PaymentError`.

---

## Configuration: `provideEasyPayments`

```ts
provideEasyPayments(config: EasyPaymentsConfig)
```

```ts
interface EasyPaymentsConfig {
  providers: EasyPaymentsProviderConfig;
  backend?: EasyPaymentsBackendConfig;
  enableMockMode?: boolean; // never use in production
}
```

### Provider configs (frontend-safe)

| Provider key | Fields | Notes |
|--------------|--------|-------|
| `stripe` | `publishableKey` | `pk_test_...` / `pk_live_...` only |
| `paypal` | `clientId`, optional `currency`, `intent` | Client ID only |
| `applePay` | optional `merchantName`, `countryCode` | Uses Stripe; needs Stripe + `createPaymentUrl` |
| `googlePay` | optional `merchantId`, `merchantName`, `environment`, `countryCode` | Stripe gateway; `TEST` default; `merchantId` required for `PRODUCTION` |
| `klarna` | optional `purchaseCountry`, `locale` | Stripe-backed; needs `klarnaCreatePaymentUrl` |
| `affirm` | optional `purchaseCountry`, `locale` | Stripe-backed; needs `affirmCreatePaymentUrl`; library hides Affirm below ~$35 total |

### Backend URLs

| Field | Purpose |
|-------|---------|
| `createPaymentUrl` | Stripe PaymentIntent create → `{ provider:'stripe', clientSecret, ... }` |
| `paypalCreateOrderUrl` | PayPal create order → `{ provider:'paypal', orderId }` |
| `paypalCaptureOrderUrl` | PayPal capture → `{ provider:'paypal', orderId, captureId, status? }` |
| `klarnaCreatePaymentUrl` | Klarna PI create → `{ provider:'klarna', clientSecret, ... }` |
| `affirmCreatePaymentUrl` | Affirm PI create → `{ provider:'affirm', clientSecret, ... }` |
| `confirmPaymentUrl` | Optional / reserved |

---

## Notable public exports

From `@easypaymentsjs/angular` (see `public-api.ts`):

- `EasyPaymentsComponent`
- `provideEasyPayments`, `EasyPaymentsConfigService`
- Models / types above
- `PaymentError`, `normalizeError`
- `validatePaymentProduct`, `EasyPaymentsConfigValidator`
- `MockPaymentController` (demo/testing)
- Klarna/Stripe return helpers (`isKlarnaReturnAttempt`, `detectStripeReturnMethod`, …)
- Layout helpers: `resolveCheckoutMaxWidth`, width constants

---

## Related docs

- [Configuration recipes](./configuration.md)
- [Backend contract](./backend.md)
- [Security](./security.md)
- [Providers](./providers/)
