# Configuration

Recipes for the public `<easy-payments>` inputs. Full types: [api.md](./api.md).

---

## Theme

Allowed: `light` | `dark` | `system` (default `system`).

```html
<easy-payments theme="light" [product]="product" [methods]="methods" />
<easy-payments theme="dark" [product]="product" [methods]="methods" />
<easy-payments theme="system" [product]="product" [methods]="methods" />
```

- `light` / `dark` force Easy Payments colors.
- `system` uses `prefers-color-scheme` and **updates live** when the OS/browser preference changes.

Do not use the value `white` — the API uses `light`.

---

## Appearance (transparent shell)

Allowed: `default` | `transparent` (default `default`).

```html
<easy-payments appearance="default" theme="system" [product]="product" [methods]="methods" />
<easy-payments appearance="transparent" theme="dark" [product]="product" [methods]="methods" />
```

| Value | Effect |
|-------|--------|
| `default` | Built-in outer shell (surface, border, radius, padding, shadow). |
| `transparent` | Removes outer chrome so your card/modal/drawer/branded background shows through. |

`theme` and `appearance` are **independent**.

Use `transparent` to embed checkout inside a merchant modal or branded section.

---

## Visual style

Optional `[visualStyle]` overrides Easy Payments–**owned** look (font, text, backgrounds, accent, radius, spacing).
Independent of `theme` and `appearance`. Omitted or invalid fields leave the built-in light/dark tokens unchanged.

```ts
visualStyle = {
  fontFamily: 'inherit', // or "'Inter', system-ui, sans-serif" (host must load Inter)
  textColor: '#0f172a',
  textSecondaryColor: '#64748b',
  backgroundColor: 'transparent',
  surfaceColor: '#ffffff',
  accentColor: '#0b6e4f',
  borderRadius: '12px',
  spacing: '16px',
};
```

```html
<easy-payments
  [product]="product"
  [methods]="methods"
  theme="system"
  appearance="default"
  [visualStyle]="visualStyle"
/>
```

### Fields → CSS variables

| Field | Maps to | Notes |
|-------|---------|--------|
| `fontFamily` | `--ep-font-family` | Stack, `'inherit'`, or `var(--token)`. **Load custom fonts in the host app.** |
| `textColor` | `--ep-text` | Primary EP-owned copy. |
| `textSecondaryColor` | `--ep-text-secondary` | Muted EP-owned copy. |
| `backgroundColor` | `--ep-background` | Host backdrop (`:host`). `'transparent'` is supported. |
| `surfaceColor` | `--ep-surface` | Default shell card + tiles / solid EP panels. |
| `accentColor` | `--ep-accent`, `--ep-focus`, derived `--ep-accent-soft` | Selection / focus. Not logos or provider SDKs. |
| `borderRadius` | `--ep-radius` | Outer radius. `--ep-radius-md` stays `calc(var(--ep-radius) * 0.625)`. |
| `spacing` | `--ep-spacing` | Stack gap. Shell padding uses `--ep-padding` (`calc(var(--ep-spacing) * 1.25)`). |

### Precedence (actual cascade)

1. **Theme** (`light` / `dark` / `system`) sets default `--ep-*` values in the component stylesheet (`:host` / `:host(.ep-theme-dark)`).
2. **Consumer stylesheet** rules targeting `easy-payments { --ep-*: … }` can override those stylesheet defaults (same element; source order / specificity apply).
3. **`[visualStyle]`** writes matching tokens as **inline** custom properties on the host. Inline values override stylesheet rules for the same token.
4. **`appearance="transparent"`** does not clear tokens; it forces the **`.ep-checkout` shell** to `background: transparent` (and removes chrome). Tiles/panels still use `--ep-surface`. Host fill still uses `--ep-background`.

If the same token is set by both `[visualStyle]` and an inline `style` / `[style.--ep-*]` on the host, prefer a single mechanism — competing inline declarations are order-dependent.

Transparent shell + custom surface example (parent shows through; tiles stay readable):

```html
<easy-payments
  appearance="transparent"
  [visualStyle]="{ surfaceColor: '#f8fafc', accentColor: '#2563eb' }"
  [product]="product"
  [methods]="methods"
/>
```

Each `<easy-payments>` instance resolves its own `theme` (component-scoped theme service). `[visualStyle]` overrides are always instance-local.

### Public CSS token contract (EP-owned)

**Supported customization points** (via `[visualStyle]` and/or CSS on `<easy-payments>`):

| Token | Purpose |
|-------|---------|
| `--ep-font-family` | EP-owned typography |
| `--ep-text` / `--ep-text-secondary` | Primary / muted text |
| `--ep-background` | Host backdrop |
| `--ep-surface` | Solid surfaces (shell when `appearance=default`, tiles, panels) |
| `--ep-accent` / `--ep-focus` / `--ep-accent-soft` | Interactive accent |
| `--ep-radius` | Outer radius (`--ep-radius-md` derived) |
| `--ep-spacing` | Vertical stack gap (`--ep-padding` / `--ep-spacing-sm` derived) |
| `--ep-checkout-max-width` | From `[maxWidth]` |

**Internal / theme-managed** (override with care; not first-class `visualStyle` fields): `--ep-surface-muted`, `--ep-surface-hover`, `--ep-border*`, `--ep-shadow*`, `--ep-cta-*`, `--ep-success`, `--ep-danger`, `--ep-demo-*`, legacy aliases (`--ep-bg`, `--ep-focus-color`, …).

**Limits**

- Does **not** restyle Stripe Payment Element / iframes, PayPal Buttons, Apple Pay / Google Pay sheets, or provider logos/marks.
- Success / error colors stay on `--ep-success` / `--ep-danger`.
- Invalid values are ignored; checkout is not blocked.

### Developer-only contrast warnings

In **Angular development mode**, Easy Payments evaluates a small set of Easy Payments–owned text/surface/accent/focus pairs and may `console.warn` when contrast is below WCAG AA reference thresholds:

| Pair type | Threshold |
|-----------|-----------|
| Normal text (titles, body, secondary copy, accent-as-text) | **4.5:1** |
| Non-text UI (focus ring vs surface/host backdrop) | **3:1** |

Warnings include the property pair, colors, calculated ratio, and recommended minimum. They:

- Appear in the **developer console only** (never in buyer checkout UI)
- **Never** auto-correct or mutate merchant colors
- **Never** block initialization, provider readiness, or payments
- Are **not** a full WCAG audit or compliance certificate
- Do **not** inspect provider SDK chrome

**Transparent / unknown backgrounds:** Easy Payments does **not** guess the underlying page color.

- `appearance="transparent"` + transparent/unknown host `backgroundColor` → **skip** chrome text-vs-host checks (`console.info`).
- Opaque `surfaceColor` is still evaluated for **tile/panel** text (the shell is not treated as painted).
- `surfaceColor: 'transparent'` under `appearance="default"` → skip shell text-vs-surface (underlay unknown).

Deliberately low-contrast example (expect a console warning in dev):

```html
<easy-payments
  [product]="product"
  [methods]="methods"
  appearance="default"
  [visualStyle]="{ textColor: '#cccccc', surfaceColor: '#ffffff' }"
/>
```

---


## Max width

```html
<easy-payments [maxWidth]="640" [product]="product" [methods]="methods" />
<easy-payments [maxWidth]="900" [product]="product" [methods]="methods" />
```

- Type: `number | string | null | undefined`
- Default: **640**
- Clamped to **320–1200** pixels
- Component is fluid (`width: 100%`) up to the cap
- Internal method grid reflows from **container width**, not only the viewport

There is no separate public `height` input in v1.0.0.

---

## Payment methods & order

```ts
methods = ['paypal', 'card', 'google-pay', 'apple-pay', 'klarna', 'affirm'];
```

The array does two jobs:

1. Merchant allow-list  
2. Preferred visual order  

No separate `order` property.

If a method is configured but unavailable at runtime (e.g. Apple Pay not offered by Stripe ECE), it is skipped and remaining methods keep relative order.

### Card only

```ts
methods = ['card'];
```

### Card + PayPal

```ts
methods = ['card', 'paypal'];
```

### Wallet-first

```ts
methods = ['apple-pay', 'google-pay', 'card'];
```

### All supported

```ts
methods = ['card', 'paypal', 'apple-pay', 'google-pay', 'klarna', 'affirm'];
```

---

## Product

```ts
product = {
  id: 'premium-plan',
  name: 'Premium Plan',
  description: 'One year subscription',
  amount: 99,
  currency: 'USD',
  quantity: 1,
};
```

Backend must treat `id` / catalog as pricing authority. See [security.md](./security.md).

---

## Success behavior

```html
<easy-payments successBehavior="confirmation" ... />
<easy-payments successBehavior="event-only" ... />
```

Or via `checkout`:

```html
<easy-payments [checkout]="{ successBehavior: 'event-only' }" ... />
```

| Value | Behavior |
|-------|----------|
| `confirmation` (default) | Built-in success screen; listen to `(successContinue)` for Continue |
| `event-only` | Emit `(success)` only; you own navigation/UX |

`checkout.successBehavior` overrides the input when set.

---

## Events

```html
<easy-payments
  (success)="onSuccess($event)"
  (cancel)="onCancel($event)"
  (error)="onError($event)"
  (successContinue)="onContinue($event)"
/>
```

There is no public `busyChange` output in v1.0.0.

---

## Combinations

### System + default

```html
<easy-payments theme="system" appearance="default" [product]="product" [methods]="methods" />
```

### Dark + transparent + custom width

```html
<easy-payments
  theme="dark"
  appearance="transparent"
  [maxWidth]="520"
  [product]="product"
  [methods]="methods"
/>
```

### Wide desktop

```html
<easy-payments theme="light" appearance="default" [maxWidth]="900" [product]="product" [methods]="methods" />
```

### Modal-friendly

Wrap a transparent checkout in your modal surface:

```html
<div class="my-modal-card">
  <easy-payments
    appearance="transparent"
    theme="system"
    [maxWidth]="480"
    [product]="product"
    [methods]="['card', 'paypal']"
  />
</div>
```

---

## Complete example

See [getting-started.md](./getting-started.md) and the live demo source: [`projects/demo`](../projects/demo).
