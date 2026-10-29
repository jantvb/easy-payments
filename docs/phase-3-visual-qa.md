# Phase 3 — Manual Visual QA

Temporary / demo-scoped checklist for **Visual Customization** (`[visualStyle]`, theme, appearance, contrast diagnostics, multi-instance themes).

This is **not** the Phase 6 interactive marketing demo. Controls live in the existing playground under **Visual style (Phase 3 QA)**.

## Run the demo

```bash
npm install
npm run build:lib
npm start
```

Open http://localhost:4200

Use **Demo Mode** for safe mock payments (no real charges). Keep DevTools → **Console** open for contrast diagnostics (`ng serve` = Angular development mode).

Full demo notes: [demo.md](./demo.md).

## Checklist

### 1. Default styling

1. Select preset **Default checkout** (or click **Reset to Defaults**).
2. Confirm `visualStyle` shows `null (theme defaults)`.
3. Confirm light/dark/system themes still look like pre–v1.2.0 defaults (no surprise chrome).

### 2. Each `visualStyle` property

Edit fields one at a time and confirm live host CSS variables / UI update:

| Field | What to look for |
|-------|------------------|
| `fontFamily` | EP-owned labels/copy change; provider marks (PayPal/GPay/etc.) stay branded |
| `textColor` / `textSecondaryColor` | Primary / muted EP copy |
| `backgroundColor` | Host backdrop (`--ep-background`); try `transparent` |
| `surfaceColor` | Shell (default appearance) + tiles/panels |
| `accentColor` | Selected tile / focus accent (not provider logos) |
| `borderRadius` | Outer radius; inner controls scale via `--ep-radius-md` |
| `spacing` | Vertical stack gap / derived padding |

### 3. Dynamic updates and reset

1. Apply **Custom light** or **Custom dark**.
2. Tweak a field → Active style becomes custom JSON.
3. **Reset to Defaults** → `null`, theme `system`, appearance `default`.

### 4. Transparent appearance

1. Preset **Transparent checkout** (or Appearance → Transparent).
2. Confirm outer shell is clear; parent preview gradient shows through.
3. Toggle Light / Dark preview backdrop (demo-only).
4. Confirm tiles still use a solid `surfaceColor` when set.

### 5. Theme switching

With a custom `visualStyle`, switch Theme light → dark → system. Overrides should remain; theme defaults fill any unset tokens.

### 6. Low-contrast console warnings

1. Preset **Low-contrast (diagnostics)**.
2. In DevTools Console, look for `[Easy Payments] Low contrast…` (developer warning only).
3. Confirm the **buyer checkout** does **not** show contrast text, banners, or blocked payments.
4. Production / optimized builds should not emit these warnings.

### 7. Two checkout instances

1. Stay in **Demo Mode**.
2. Enable **Show dual-instance theme QA**.
3. Confirm Instance A stays light and Instance B stays dark (independent themes / accents).
4. Prefer not to run Real / Test Provider payments while dual instances are mounted (shared orchestrator).

### 8. Provider branding

With a loud custom `fontFamily` / `accentColor`, confirm Stripe / PayPal / Apple Pay / Google Pay / Klarna / Affirm **SDK chrome and marks** are not restyled by Easy Payments tokens.

### 9. Mock payment flow

In Demo Mode, complete a mock success / cancel / fail. Styling changes must not break the mock flow or force a full page reload.

## After QA

- Keep this harness in the PR if reviewers still need manual verification.
- Remove or gate it before a public demo polish pass (Phase 6), if product wants a cleaner playground.
