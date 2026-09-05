# Demo & Example Application

The repository includes a full Angular playground that embeds `<easy-payments>`.

**No public hosted demo URL** is published with v1.0.0 — run it locally.

Source: [`projects/demo`](../projects/demo)

---

## What the demo shows

- Card, PayPal, Apple Pay, Google Pay, Klarna, Affirm (availability depends on mode/config)
- Product fields (demo default **$99** USD `premium-plan`)
- Method enable/disable and **reorder**
- Theme: light / dark / system
- Appearance: default / transparent (+ preview backdrops)
- `maxWidth` presets and slider (320–1200)
- Success / cancel / error event log
- **Demo Mode** (mocks) vs **Real / Test Providers**

---

## Run locally

From the repo root:

```bash
npm install
npm run build:lib
npm start
```

Open http://localhost:4200

### Backend (Real / Test Providers)

```bash
cd server
npm install
# copy .env.example → .env and fill TEST secrets
npm run start:dev
```

Server: http://localhost:3000

Root scripts also include:

- `npm run server:install`
- `npm run server:start`
- `npm run server:test`

---

## Frontend env (browser-safe only)

Copy [`projects/demo/src/environments/environment.example.ts`](../projects/demo/src/environments/environment.example.ts) into `environment.ts` and set:

- `stripePublishableKey` — `YOUR_STRIPE_PUBLISHABLE_KEY` (replace with `pk_test_...`)
- `paypalClientId` — `YOUR_PAYPAL_CLIENT_ID`
- Backend URLs — usually `http://localhost:3000/api/...`

Never put `sk_...` or PayPal Client Secret here.

---

## Educational entry points

| Concern | File |
|---------|------|
| Provider wiring | `projects/demo/src/app/app.config.ts` + Real-mode config in `app.ts` |
| Template bindings | `projects/demo/src/app/app.html` |
| Product / methods / theme / appearance / maxWidth | `projects/demo/src/app/app.ts` |
| Placeholders | `projects/demo/src/environments/environment.example.ts` |

Screenshots in docs were captured from this demo using browser viewport emulation (not physical device claims).
