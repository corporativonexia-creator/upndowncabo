"use strict";

// Lote 2C · shared Premium White release guard and presentation contracts.
// Offline tests only: no network, no Supabase writes, no POS, no deployments.
// Run from repository checkout: node --test tests/integration-lot2c-shared-skin.cjs
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(ROOT, file), "utf8");
const publicHome = read("src/app/page.tsx");
const previewHome = read("src/app/vista-previa/page.tsx");
const runtime = read("public/updown-parity-runtime.js");
const shell = read("src/components/store/storefront-parity.tsx");
const stage7 = read("public/updown-preview-services-stage7.js");
const mobile = read("src/components/store/responsive/mobile-header.tsx");
const sharedHeader = read("src/app/vista-previa/preview-header.css");
const sharedSkin = read("src/app/vista-previa/premium-white.css");
const focus = read("src/app/vista-previa/preview-desktop-search-focus.tsx");
const collapse = read("src/app/vista-previa/preview-filter-auto-collapse.tsx");
const cssBraces = css => [...css.replace(/\/\*[\s\S]*?\*\//g, "")].reduce(
  (n, c) => n + Number(c === "{") - Number(c === "}"), 0
);

test("public page imports same presentation layers as the authorized preview", () => {
  for (const target of ["preview-header.css", "premium-white.css"]) {
    assert.ok(publicHome.includes(target), target + " missing from public");
    assert.ok(previewHome.includes(target), target + " missing from preview");
  }
  assert.ok(publicHome.includes("<StorefrontParity />"));
  assert.ok(!publicHome.includes("<StorefrontParity previewMode"));
  assert.ok(previewHome.includes("<StorefrontParity previewMode />"));
  assert.ok(previewHome.includes('requireRole("admin"'));
});

test("CSS is shared via an explicit visual class and selectors remain balanced", () => {
  for (const css of [sharedHeader, sharedSkin]) {
    assert.equal(cssBraces(css), 0);
    assert.ok(css.includes("#updown-store:is(.uds-preview,.uds-premium-white)"));
    assert.ok(css.includes(".uds-native-mobile-header:is(.uds-preview-mobile-header,.uds-premium-white-mobile-header)"));
    assert.ok(!css.includes("#updown-store.uds-preview "));
  }
});

test("public storefront never enables private catalog mode or authorization bypass", () => {
  assert.ok(shell.includes('uds-ux-v3 uds-premium-white'));
  assert.ok(shell.includes('previewMode ? " uds-preview" : ""'));
  assert.ok(shell.includes('previewMode ? PREVIEW_CATEGORY_GROUPS : undefined'));
  assert.ok(shell.includes('previewMode ? "/updown-parity-runtime.js'));
  assert.ok(!publicHome.includes("requireRole"));
});

test("shared service cards read Supabase-owned rows without rewriting six records", () => {
  assert.ok(stage7.includes('root?.classList.contains("uds-premium-white")'));
  assert.ok(stage7.includes("window.__UPDOWN_SERVICES__"));
  assert.ok(!stage7.includes("const copies="));
  assert.ok(!stage7.includes('db.from("storefront_services").update'));
  assert.ok(runtime.includes("db.from('storefront_services').select('*').eq('is_active',true).order('sort_order').order('key')"));
  assert.ok(shell.includes("services-premium-shared-v5-20261117"));
  assert.ok(shell.includes("if (previewMode) {\n        previewLocationScript"));
});

test("mobile/desktop header and filters get the shared visual treatment", () => {
  assert.ok(mobile.includes("uds-premium-white-mobile-header"));
  assert.ok(publicHome.includes("<PremiumFilterAutoCollapse />"));
  assert.ok(publicHome.includes("<PremiumDesktopSearchFocus />"));
  assert.ok(focus.includes('#updown-store.uds-premium-white'));
  assert.ok(collapse.includes('#updown-store.uds-premium-white'));
  assert.ok(sharedSkin.includes("PW-UX-08 · More brand presence"));
});

test("price, stock, variants and cart enforcement remain in legacy runtime", () => {
  for (const token of [
    "function storefrontPricing(product)",
    "async function reconcilePreviewCart(options={})",
    'db.from("product_variants")',
    "ex.quantity=quantity+1",
    "quantity>=Number(product.stock)",
    "function stockCopy(stock)",
  ]) assert.ok(runtime.includes(token), "Missing commerce guard: " + token);
});

test("no release: launch gate and Git-auto-deploy guard still present", () => {
  assert.ok(read("src/proxy.ts").includes("const UNDER_CONSTRUCTION = true"));
  assert.equal(JSON.parse(read("vercel.json")).git.deploymentEnabled, false);
});
