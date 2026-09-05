# PayPal

PayPal uses the **PayPal JS SDK** in the browser and Orders create/capture on your backend.

## Frontend

```ts
providers: {
  paypal: {
    clientId: 'YOUR_PAYPAL_CLIENT_ID',
    currency: 'USD',      // optional
    intent: 'capture',    // optional: 'capture' | 'authorize'
  },
}
```

Client ID is browser-safe. **Client Secret must stay on the server.**

## Backend

```env
PAYPAL_CLIENT_ID=YOUR_PAYPAL_CLIENT_ID
PAYPAL_CLIENT_SECRET=YOUR_PAYPAL_CLIENT_SECRET
PAYPAL_MODE=sandbox   # or live
```

| Step | Demo route | Config field |
|------|------------|--------------|
| Create order | `POST /api/payments/paypal/create` | `paypalCreateOrderUrl` |
| Capture | `POST /api/payments/paypal/capture` | `paypalCaptureOrderUrl` |

Create body: `{ provider: 'paypal', productId, quantity, currency? }` — **no client amount**.  
Capture body: `{ orderId }`.

## Sandbox vs Live

- Local / integration: Sandbox Client ID + `PAYPAL_MODE=sandbox`
- Production: Live credentials + `live`

## Methods array

```ts
methods = ['paypal', 'card'];
```
