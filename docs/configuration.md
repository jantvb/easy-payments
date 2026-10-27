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

## Visual style (font & text colors)

Optional `[visualStyle]` overrides Easy Payments–**owned** typography and text colors.
Independent of `theme` and `appearance`. Omitted or invalid fields leave the built-in light/dark tokens unchanged.

```html
<easy-payments
  [product]="product"
  [methods]="methods"
  theme="system"
  [visualStyle]="{
    fontFamily: 'inherit',
    textColor: '#0f172a',
    textSecondaryColor: '#64748b'
  }"
/>
```

```ts
// Host app must load Inter (or any custom face) before checkout renders.
visualStyle = { fontFamily: "'Inter', system-ui, sans-serif" };
```

```html
<easy-payments [product]="product" [methods]="methods" [visualStyle]="visualStyle" />
```

| Field | Maps to | Notes |
|-------|---------|--------|
| `fontFamily` | `--ep-font-family` | CSS font stack, `'inherit'` (host app font), or `var(--your-token)`. **Load custom fonts in the host app** before use — Easy Payments does not fetch fonts. |
| `textColor` | `--ep-text` | Primary EP-owned copy. |
| `textSecondaryColor` | `--ep-text-secondary` | Muted EP-owned copy (subtitles, hints). |

**Limits**

- Does **not** restyle official provider UI (Stripe Payment Element / iframes, PayPal Buttons, Apple Pay / Google Pay sheets, or provider logos/marks).
- Success / error colors stay on `--ep-success` / `--ep-danger` (not overridden by these fields).
- Invalid values are ignored; checkout is not blocked.

Other `visualStyle` keys (`backgroundColor`, `surfaceColor`, `accentColor`, `borderRadius`, `spacing`) exist on the type for later customization steps; prefer documenting them when those features are finalized.

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
