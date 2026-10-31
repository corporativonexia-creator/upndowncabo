# Admin catalog incident — 2026-10-30

## Proven cause

Commit `9ecb108395b3f45f17f9df3fee1af78903d8eabf` introduced two incorrect escapes in `public/updown-admin-legacy-runtime.js`:

- A literal `\\n` outside a string, between the EAN-13 guard and `submit.disabled`. The browser rejects the entire script at parse time, so neither the Supabase client nor `initialize()`/`loadProducts()` runs. The loading text comes from static markup. Adding query timeouts cannot help code that never executes.
- `/^\\d{13}$/` matches a literal backslash followed by letters instead of thirteen digits. Corrected to `/^\d{13}$/`.

Before editing, the production asset and the main-branch file had identical SHA-256 hashes. Chromium reproduced the syntax exception, zero client initialization calls, and the unchanged loading placeholder. The defective commit remains a reproducible baseline; do not reintroduce the broken source into a deployed asset.

Next.js copied this public JavaScript without parsing it. `prebuild` now parses every admin script referenced by AdminParity and fails on syntax errors. Script `onload` alone does not prove execution; AdminParity now also checks a runtime initialization marker and displays a retry action on boot failure.

## Dependencies and limited scope

`/admin` still uses `requireRole('admin')`. Login remains the existing server route that returns session cookies; the bridge still uses the singleton `createBrowserClient` from `@supabase/ssr`. No auth policy or schema change is included.

The legacy runtime owns product queries, cards, forms and variant writes. Admin V2 adds its other views without replacing the product list. Product tabs group and filter cards. Previously, a separate variant-search script fetched variants again and inferred parent identity from visible names/SKUs. It is no longer injected: the existing summary query now supplies counts and search metadata, matched by exact `product_id`. The old file remains available for historical consumers; this Next.js admin does not run it.

Changes:

- `public/updown-admin-legacy-runtime.js`: escape corrections, query lifecycle, explicit product identity/search fields, visible errors/retry, optional variant metadata updates without replacing active editors, and preservation of existing variant barcodes when an input is empty.
- `public/updown-product-tabs-v1.js`: group only actual product cards; do not classify loading/error notices as products.
- `src/components/admin/admin-parity.tsx`: startup acknowledgement, visible boot failure, updated asset versions, remove duplicate variant-search integration.
- `tools/check-admin-scripts.cjs`, package scripts: syntax gate before every build.
- `tests/`, `playwright.config.ts`, `.github/workflows/admin-catalog.yml`: isolated browser regression suite and CI.
- Package manifest/lock and `.gitignore`: pinned Playwright test dependency and generated-output exclusions.

No price, POS, Stripe, stock movement, database policy, password, or migration changes.

## Verification performed

- Chromium reproduced the original parse failure before the correction.
- All 10 currently injected admin scripts pass syntax validation.
- `npm run build` and `npx tsc --noEmit`: pass.
- Targeted ESLint for changed runtime, component, tests and tooling: pass.
- Full repository `npm run lint`: 19 existing errors and 8 warnings in unrelated files. These files were not changed by this fix; global lint is not represented as passing.
- Ten Playwright tests pass against the built Next.js app and an isolated HTTP Supabase fixture service:
  1. Login → SSR authorization → browser queries → reload, with one login and no second login screen.
  2. Invalid credentials visible.
  3. Name, SKU, parent/variant barcode, brand, model, category and combined filtering.
  4. Delayed variant summary preserves unsaved editor input.
  5. Product update preserves barcode, price, stock, channel flags and existing slug.
  6. Existing variant update and automatic EAN-13 creation with zero initial stock.
  7. Product query error and retry.
  8. Optional variant summary error, working parent search and retry.
  9. Script syntax failure is visible rather than a permanent loading state.
  10. Mobile catalog and editor.

The fixture service has no production credentials. Save operations are simulated, and stock-adjustment calls are forbidden by the fixture. Chromium 133 ran locally using an explicit executable override because the standard browser download failed in this environment. CI installs Playwright's bundled Chromium.

Production Supabase was inspected read-only: record counts, relation integrity, policies, logs and advisors. A read-only transaction with `SET LOCAL ROLE authenticated` and claims for an existing active admin confirmed that RLS permits reads of products, variants, categories and images; the transaction was rolled back. This is a database RLS test, not a production browser login test.

## Reproduce locally

Use fixture variables only for this isolated test build, never for deployment:

```sh
npm ci
npx playwright install --with-deps chromium
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:4319 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=fixture-publishable-key npm run build
npx tsc --noEmit
npm run test:admin
```

Playwright starts and stops the local fixture service and the production-mode Next.js server. If using an existing Chromium binary, set `CHROMIUM_EXECUTABLE_PATH` to its path.

For opt-in diagnostic stages, set `window.__UPDOWN_CATALOG_DEBUG__ = true` before initialization in DevTools/Playwright. The list's `data-catalog-state` records loading, rendering, ready, or error without logging session/customer data.

## Required before production

The patch must remain unmerged until its exact preview deployment and an authenticated administrative session have been checked. No administrative test credentials/session were available in the execution environment. Fixture tests do not establish that the real preview session works.

1. Confirm the preview corresponds to this PR's latest commit and its Vercel build is successful.
2. Log in once to the preview with an authorized account. Reload `/admin`; confirm it remains authenticated.
3. Confirm all authorized products appear and there is no runtime syntax error. Check product/category/image responses and optional variant metadata response in Network.
4. Search existing name, SKU, barcode, brand, model, and variant barcode; apply and clear category filters.
5. Open an existing product editor and verify barcode/channel/price fields. Open an existing variant and verify barcode, size and stock display. Cancel without saving production data. Do not click “Agregar variante” merely for read-only QA: the existing generator reserves a barcode when opening a new-variant form.
6. Validate real write operations only in a separate authorized test dataset; no stock or live records should be modified for verification.

Vercel's connected account returned 403 for deployment listing. GitHub status/check links can be inspected independently. Do not treat a successful build alone as functional approval.
