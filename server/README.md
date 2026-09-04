# easy-payments Stripe demo server

Minimal NestJS backend for **Stripe TEST MODE** end-to-end testing with the Angular `easy-payments` library.

## Setup

```bash
cd server
cp .env.example .env
# Edit .env and set STRIPE_SECRET_KEY=sk_test_...
npm install
npm run start:dev
```

Endpoint:

`POST http://localhost:3000/api/payments/create`

Never put `sk_test_...` or `sk_live_...` in the Angular app.
