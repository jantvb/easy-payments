# Backend Requirements & API Contract

Easy Payments is a **frontend** Angular library. Sensitive operations require **your** backend.

You do **not** need NestJS. Any stack works if it implements the HTTP contract below.

---

## Why a backend is required

| Responsibility | Where |
|----------------|-------|
| Stripe secret key / PayPal Client Secret | Backend only |
| Trusted product price / currency / quantity | Backend |
| Create PaymentIntent / PayPal order | Backend |
| Capture PayPal order | Backend |
| Klarna / Affirm PaymentIntent create | Backend |
| Webhooks & reconciliation (production) | Backend |

The Angular app may send `productId` + `quantity` (+ display amount for some Stripe flows). **Production backends must not trust browser amounts** as the final charge authority.

---

## Reference NestJS backend

Path: [`server/`](../server)

- Example integration used by the demo
- **Not** required for consumers
- **Not** automatically production-ready

Before production, review: trusted pricing, auth, rate limits, HTTPS, live credentials, webhooks, logging, and validation.

---

## Endpoints (reference demo)

Base URL in local demo: `http://localhost:3000`

### Stripe card / wallets (PaymentIntent)

`POST /api/payments/create` → **201**

Request (validated by Nest DTO):

```json
{
  "provider": "stripe",
  "productId": "premium-plan",
  "quantity": 1,
  "currency": "USD",
  "amount": 99,
  "description": "optional",
  "metadata": { "optional": "string map" }
}
```

Response shape expected by the library:

```json
{
  "provider": "stripe",
  "clientSecret": "pi_..._secret_...",
  "sessionId": "optional",
  "paymentIntentId": "optional"
}
```

Security: uses `STRIPE_SECRET_KEY`. Demo may honour `amount` within bounds for playground testing; production must price from catalog.

---

### PayPal create order

`POST /api/payments/paypal/create` → **201**

Request:

```json
{
  "provider": "paypal",
  "productId": "premium-plan",
  "quantity": 1,
  "currency": "USD"
}
```

> Client-supplied charge amounts are **not** accepted on this route.

Response:

```json
{
  "provider": "paypal",
  "orderId": "..."
}
```

### PayPal capture

`POST /api/payments/paypal/capture` → **200**

Request:

```json
{ "orderId": "..." }
```

Response:

```json
{
  "provider": "paypal",
  "orderId": "...",
  "captureId": "...",
  "status": "COMPLETED"
}
```

Uses PayPal Client ID + Client Secret server-side (`PAYPAL_MODE=sandbox|live`).

---

### Klarna (Stripe-backed)

`POST /api/payments/klarna/create` → **201**

Request:

```json
{
  "provider": "klarna",
  "productId": "premium-plan",
  "quantity": 1,
  "currency": "USD"
}
```

Amount is resolved **server-side** from the catalog (no trusted client amount).

Response:

```json
{
  "provider": "klarna",
  "clientSecret": "...",
  "paymentIntentId": "optional",
  "sessionId": "optional"
}
```

---

### Affirm (Stripe-backed)

`POST /api/payments/affirm/create` → **201**

Same shape as Klarna with `"provider": "affirm"`. Catalog-priced. Affirm eligibility / minimums may hide the method in the UI (library applies ~$35 minimum presentment).

---

### Catalog (demo helper)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/catalog/products` | List trusted demo products |
| `GET` | `/api/catalog/products/:productId` | One product |

Not required for production merchants that already have a catalog API.

---

## Frontend `backend` config mapping

| `EasyPaymentsBackendConfig` field | Demo path |
|-----------------------------------|-----------|
| `createPaymentUrl` | `/api/payments/create` |
| `paypalCreateOrderUrl` | `/api/payments/paypal/create` |
| `paypalCaptureOrderUrl` | `/api/payments/paypal/capture` |
| `klarnaCreatePaymentUrl` | `/api/payments/klarna/create` |
| `affirmCreatePaymentUrl` | `/api/payments/affirm/create` |

---

## Server env (demo)

See [`server/.env.example`](../server/.env.example):

```env
STRIPE_SECRET_KEY=YOUR_STRIPE_SECRET_KEY
PAYPAL_CLIENT_ID=YOUR_PAYPAL_CLIENT_ID
PAYPAL_CLIENT_SECRET=YOUR_PAYPAL_CLIENT_SECRET
PAYPAL_MODE=sandbox
PORT=3000
FRONTEND_ORIGIN=http://localhost:4200
```

Never commit real `.env` files.
