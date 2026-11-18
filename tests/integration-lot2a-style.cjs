"use strict";
// Lote 2A — static, read-only contracts. No imports of application code,
// Supabase, network, POS, or environment variables.
// Run in integration candidate only: node --test tests/integration-lot2a-style.cjs
// REMOVE this lot-specific release guard test before merging to main.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const fromRoot = file => fs.readFileSync(path.resolve(__dirname, "..", file), "utf8");
const cssBraces = css => [...css.replace(/\/\*[\s\S]*?\*\//g, "")].reduce((n, c) => n + (c === "{") - (c === "}"), 0);

test("Premium White preview skin is imported without relaxing authorization", () => {
  const page = fromRoot("src/app/vista-previa/page.tsx");
  assert.match(page, /import "\.\/preview-header\.css"/);
  assert.match(page, /import "\.\/premium-white\.css"/);
  assert.match(page, /await requireRole\("admin", "\/vista-previa"\)/);
  assert.match(page, /<StorefrontParity previewMode\s*\/>/);
});
test("visual skin stays scope-gated and includes larger canonical header branding", () => {
  const css = fromRoot("src/app/vista-previa/premium-white.css");
  assert.equal(cssBraces(css), 0);
  assert.ok(css.includes("#updown-store:is(.uds-preview,.uds-premium-white)"));
  assert.match(css, /PW-UX-08 · More brand presence/);
  assert.match(css, /\.uds-original-vector-logo/);
  assert.match(css, /\.uds-preview-mobile-header/);
  assert.match(css, /PW-UX-07 · Approved green-velvet artwork/);
});
test("the approved no-photo artwork remains the exact canonical user image", () => {
  const svg = fromRoot("public/assets/updown-product-placeholder.svg");
  assert.match(svg, /viewBox="0 0 600 400"/);
  const b64 = svg.match(/base64,([A-Za-z0-9+/=]+)/)?.[1];
  assert.ok(b64);
  assert.equal(b64.length, 5840);
  let fp = 2166136261;
  for (const ch of b64) fp = Math.imul(fp ^ ch.charCodeAt(0), 16777619) >>> 0;
  assert.equal(fp, 3030130964);
});
test("shared Premium White product style only changes presentation", () => {
  const css = fromRoot("src/components/store/premium-product-detail.css");
  assert.equal(cssBraces(css), 0);
  assert.match(css, /\.ud-premium-product-skin/);
  for (const entry of [
    ["src/app/producto/[productKey]/page.tsx", false],
    ["src/app/vista-previa/producto/[productKey]/page.tsx", true],
  ]) {
    const [file, isPrivate] = entry;
    const page = fromRoot(file);
    assert.match(page, /import "@\/components\/store\/premium-product-detail\.css"/);
    assert.match(page, /className="ud-premium-product-skin"/);
    assert.match(page, /<ProductDetail product=\{product\}/);
    assert.match(page, /<RelatedProductsServer product=\{product\}/);
    if (isPrivate) assert.match(page, /await ensurePreviewAdmin\(\)/);
    else assert.match(page, /application\/ld\+json/);
  }
});
test("real photos are not affected by the green placeholder skin", () => {
  const css = fromRoot("src/app/globals.css");
  assert.match(css, /\.uds-card-media\.is-product-placeholder/);
  assert.match(css, /object-fit: contain !important/);
});
test("temporary candidate branch prohibits auto-deploy and launch remains closed", () => {
  const config = JSON.parse(fromRoot("vercel.json"));
  assert.equal(config.git?.deploymentEnabled, false);
  const proxy = fromRoot("src/proxy.ts");
  assert.match(proxy, /const UNDER_CONSTRUCTION = true/);
});
