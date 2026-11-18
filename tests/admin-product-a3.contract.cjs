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
  assert.match(shell, /if \(!host\.hidden\) setCaptureVisited\(true\)/);
  assert.match(shell, /dangerouslySetInnerHTML=\{ADMIN_MARKUP\}/);
  const legacyRoute = read("src/app/admin/productos/alta-rapida/page.tsx");
  assert.match(legacyRoute, /redirect\("\/admin\?producto=nuevo"\)/);
  assert.doesNotMatch(legacyRoute, /<QuickProductEntry \/>/);
  assert.match(tabs, /URLSearchParams\(window\.location\.search\)/);
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

test("A3.3 saves the complete ficha in one user action without changing quick-create identifiers or inventory", () => {
  const quick = read("src/components/admin/quick-product-entry.tsx");
  assert.match(quick, /type AdvancedDraft/);
  assert.match(quick, /advanced: \{ \.\.\.advanced \}/);
  assert.match(quick, /Guardar ficha completa/);
  assert.match(quick, /productMetadata\(capture\.advanced/);
  assert.doesNotMatch(quick, /Revisar y completar ficha|pendingDetails|recentProduct/);
  assert.match(quick, /updown:admin-product-edit-request/);
  const rpc = quick.match(/db\.rpc\("admin_quick_product_create", \{([\s\S]*?)\}\);/);
  assert.ok(rpc, "Must continue calling the existing idempotent quick-create RPC");
  assert.doesNotMatch(rpc[1], /advanced|brand|model|salePrice|stock:/);
  assert.doesNotMatch(quick, /\.update\(\{[^}]*brand|\.insert\(\{[^}]*brand/);

  const legacy = read("public/updown-admin-legacy-runtime.js");
  assert.doesNotMatch(legacy, /applyAdvancedProductDraft/);
  assert.match(legacy, /window\.addEventListener\("updown:admin-product-edit-request"/);
  assert.match(legacy, /Para crear productos utiliza Nueva ficha/);
  assert.match(read("public/updown-product-tabs-v1.js"), /updown:admin-product-editor-opened/);
});

test("A3.3 UPC photo attachment updates gallery only, with explicit retries and no destructive operations", () => {
  const quick = read("src/components/admin/quick-product-entry.tsx");
  assert.match(quick, /attachExistingPhotos/);
  assert.match(quick, /db\.from\("product_images"\)\.insert\(inserts\)/);
  assert.match(quick, /photoRequestRef/);
  assert.match(quick, /products\/upc\/\$\{request\.productId\}/);
  assert.match(quick, /Galería|galería/);
  assert.doesNotMatch(quick, /db\.from\("product_images"\)\.delete\(/);
  assert.match(quick, /uploadOwnedPhoto/);
  assert.match(quick, /upsert: false/);
  assert.doesNotMatch(quick, /upsert: true/);
});
