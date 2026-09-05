# Security

## Frontend-safe

Safe in Angular / browser config when intended by the provider:

- Stripe **publishable** key (`pk_test_...` / `pk_live_...`)
- PayPal **Client ID**
- Public merchant display names / Google Pay TEST merchant defaults
- Backend **HTTPS URLs** you own

Card number, CVC, and expiry stay inside **Stripe Elements** (provider-hosted fields). Easy Payments does **not** claim automatic PCI compliance — you must follow Stripe’s and your own compliance obligations.

## Never put in Angular

- Stripe **secret** key (`sk_test_...` / `sk_live_...`)
- PayPal **Client Secret**
- Private keys / certificates
- Access tokens / passwords
- Any backend-only credential

## Pricing security

Frontend `product.amount` is for display / request hints.

Your backend must validate or derive:

- product identity
- unit amount
- currency
- quantity
- discounts (if any)

before creating or capturing a charge.

PayPal, Klarna, and Affirm create routes in the reference backend **reject client amounts** and price from the server catalog. Demo Stripe create may accept a bounded playground `amount` — **remove that pattern in production**.

## Mock mode

`enableMockMode: true` never processes real money. Do not enable in production.
