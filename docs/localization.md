# Localization

Easy Payments **v1.1.0** ships built-in UI localization for checkout chrome owned by the library.

Supported `[locale]` values:

| Value | Meaning |
|-------|---------|
| `auto` | Default. Detect from the browser when available. |
| `en` | English |
| `es` | Spanish |
| `pt` | Portuguese |

```html
<easy-payments
  [product]="product"
  locale="es"
  (success)="onSuccess($event)"
  (cancel)="onCancel($event)"
  (error)="onError($event)"
/>
```

---

## Auto detection

With `locale="auto"` (or when the input is omitted):

1. Read `navigator.languages` (then `navigator.language`) when available  
2. Normalize the first usable tag:
   - `es`, `es-MX`, `es-ES`, … → **`es`**
   - `pt`, `pt-BR`, `pt-PT`, … → **`pt`**
   - `en`, `en-US`, … → **`en`**
   - anything else → **`en`**
3. On SSR / environments without `navigator`, fall back to **`en`**

You can also force a locale at runtime:

```html
<easy-payments [product]="product" [locale]="selectedLocale" ... />
```

```ts
selectedLocale: 'auto' | 'en' | 'es' | 'pt' = 'auto';
```

---

## What Easy Payments localizes

Easy Payments-owned UI strings, including:

- Payment method labels and selection chrome  
- Order summary / totals copy  
- Processing, success, error, and cancelled screens  
- Pay / continue / try-again style actions  
- Method panel helper text owned by the library  

English is the canonical dictionary. Spanish and Portuguese implement the same key set.

---

## Provider limitations

Easy Payments maps the effective locale into provider SDK options where supported:

| Surface | Mapping (approximate) |
|---------|------------------------|
| Stripe Elements | `en` → `en`, `es` → `es`, `pt` → `pt-BR` |
| PayPal JS SDK | `en` → `en_US`, `es` → `es_ES`, `pt` → `pt_BR` |
| Klarna / Affirm (Stripe BNPL hints) | `en-US` / `es-ES` / `pt-BR` |

**Not fully controlled by Easy Payments:**

- Apple Pay / Google Pay system wallet sheets (OS / wallet language)  
- Bank or issuer UIs during 3-D Secure  
- Provider-hosted redirect pages that ignore or override locale hints  
- Optional `providers.klarna.locale` / `providers.affirm.locale` config values when set explicitly for purchase context  

Treat provider-owned UI as best-effort. Library chrome follows `[locale]`; wallet and bank sheets may still appear in another language.

---

## Custom translation overrides

Use `[translations]` with a **partial** object. Resolution order per key:

1. Your override  
2. Dictionary for the effective locale (`en` / `es` / `pt`)  
3. English fallback  

```ts
import type { EasyPaymentsTranslationOverrides } from '@easy-payments/angular';

readonly translations: EasyPaymentsTranslationOverrides = {
  successTitle: '¡Listo!',
  successContinue: 'Volver a la tienda',
  payWithCard: 'Pagar con tarjeta',
};
```

```html
<easy-payments
  [product]="product"
  locale="es"
  [translations]="translations"
  (success)="onSuccess($event)"
  (cancel)="onCancel($event)"
  (error)="onError($event)"
/>
```

Some strings support `{{token}}` placeholders (for example method names or amounts). Prefer overriding whole phrases; keep tokens intact when the base string uses them.

Public types: `EasyPaymentsLocale`, `EasyPaymentsTranslations`, `EasyPaymentsTranslationOverrides` from `@easy-payments/angular`.

---

## Currency formatting (no conversion)

Checkout amounts are formatted with `Intl.NumberFormat` using the active locale for **display only**.

- `product.amount` is **not** changed  
- `product.currency` is **not** converted  
- Example: `amount: 99`, `currency: 'USD'` remains a **USD** charge; Spanish locale may show `$99.00` / `US$99.00` style formatting depending on the runtime, but it is still USD  

There is **no** FX / currency conversion in Easy Payments. Your backend remains the source of truth for the charged amount and currency.

Reminder: `amount` uses **major currency units** (`99` = $99.00 USD), not cents.

---

## Related

- [Getting Started](./getting-started.md)  
- [API Reference](./api.md)  
- [Configuration](./configuration.md)  
- [CHANGELOG](../CHANGELOG.md) (`1.1.0`)
