# npm README screenshots

## GitHub (current)

README uses **repository-relative** image paths:

```html
<img src="docs/assets/easy-payments-desktop.png" width="640" alt="..." />
```

These resolve correctly on GitHub for whatever branch/tag the viewer opens (`release/1.0.0`, later `v1.0.0`, etc.).

## npm (before publish)

npm does **not** reliably resolve relative GitHub paths for images in the published README.

**Before `npm publish`**, update README screenshot `src` values to stable absolute URLs on the **`v1.0.0` tag** (create the tag first):

```text
https://raw.githubusercontent.com/jantvb/easy-payments/v1.0.0/docs/assets/easy-payments-desktop.png
```

Repeat for every screenshot file under `docs/assets/`.

Do **not** use `/master/` for npm packaging once the release tag exists.

Do **not** invent owner/repo names — use `jantvb/easy-payments`.

## Checklist before npm publish

1. Tag `v1.0.0` exists and includes `docs/assets/*`
2. README absolute image URLs point at `.../v1.0.0/docs/assets/...`
3. Spot-check the tarball README / npm preview
4. Then publish
