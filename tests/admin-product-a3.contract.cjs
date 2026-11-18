const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

test("A3 keeps the old product editor, its handlers, and the quick capture implementation", () => {
  const tabs = read("public/updown-product-tabs-v1.js");
  assert.match(tabs, /id="udUnifiedProductHost"|captureHost\.id="udUnifiedProductHost"/);
  assert.match(tabs, /data-view="capture"/);
  assert.match(tabs, /data-view="form"/);
  assert.match(tabs, /show\("form"\)/);
  const shell = read("src/components/admin/admin-parity.tsx");
  assert.match(shell, /createPortal\(<QuickProductEntry embedded \/>, productHost\)/);
  assert.match(shell, /captureVisited/);
  assert.match(shell, /dangerouslySetInnerHTML=\{ADMIN_MARKUP\}/);
  assert.match(read("src/app/admin/productos/alta-rapida/page.tsx"), /<QuickProductEntry \/>/);
});

test("A3 capture is lazy and reuses existing barcode, photo and variant paths", () => {
  const quick = read("src/components/admin/quick-product-entry.tsx");
  const shell = read("src/components/admin/admin-parity.tsx");
  for (const keyword of ["admin_quick_barcode_lookup", "admin_quick_product_create", "admin_quick_inventory_receive", "BarcodeCamera", "preparePhoto", "heic-to/next", "freshVariant", "setVariantPhoto"]) {
    assert.ok(quick.includes(keyword), `Missing existing capability: ${keyword}`);
  }
  assert.match(shell, /captureVisited && createPortal/);
  assert.doesNotMatch(shell, /\.from\(|\.rpc\(|\.insert\(|\.update\(|\.delete\(/);
  assert.match(read("public/updown-admin-legacy-runtime.js"), /addEventListener\("updown:admin-products-refresh",loadProducts\)/);
});

test("A3 preserves isolation and does not introduce data-layer or deployment edits", () => {
  assert.equal(JSON.parse(read("vercel.json")).git.deploymentEnabled, false);
  const tabs = read("public/updown-product-tabs-v1.js");
  assert.doesNotMatch(tabs, /supabase|\.rpc\(|\.from\(|fetch\(/);
  assert.match(read("public/updown-product-smart-entry-v1.js"), /data-product-capture-link=""/);
});

test("A3.2 prepares advanced fields without changing the quick-create RPC or automatic commercial writes", () => {
  const quick = read("src/components/admin/quick-product-entry.tsx");
  assert.match(quick, /type AdvancedDraft/);
  assert.match(quick, /advanced: \{ \.\.\.advanced \}/);
  assert.match(quick, /Los borradores ya están creados, pero estos campos siguen únicamente en esta sesión/);
  assert.match(quick, /updown:admin-product-details-saved/);
  assert.match(quick, /updown:admin-product-edit-request/);
  const rpc = quick.match(/db\.rpc\("admin_quick_product_create", \{([\s\S]*?)\}\);/);
  assert.ok(rpc, "Must continue calling the existing idempotent quick-create RPC");
  assert.doesNotMatch(rpc[1], /advanced|brand|model|salePrice|stock:/);
  assert.doesNotMatch(quick, /\.update\(\{[^}]*brand|\.insert\(\{[^}]*brand/);

  const legacy = read("public/updown-admin-legacy-runtime.js");
  assert.match(legacy, /applyAdvancedProductDraft/);
  assert.match(legacy, /window\.addEventListener\("updown:admin-product-edit-request"/);
  assert.match(legacy, /if\(product\.status==="draft"\)applyAdvancedProductDraft/);
  assert.match(read("public/updown-product-tabs-v1.js"), /updown:admin-product-editor-opened/);
});
