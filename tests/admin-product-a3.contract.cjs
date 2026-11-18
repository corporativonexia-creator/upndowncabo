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

test("A3.8 metadata-only edits cannot silently rewrite existing galleries", () => {
  const legacy = read("public/updown-admin-legacy-runtime.js");
  assert.match(legacy, /function gallerySignature\(\)/);
  assert.match(legacy, /productGalleryInitialSignature=gallerySignature\(\)/);
  assert.match(legacy, /const galleryChanged=gallerySignature\(\)!==productGalleryInitialSignature/);
  assert.match(legacy, /if\(galleryChanged&&galleryForSave\.length\)/);
  // The new proposal remains dormant until installation and RLS QA are approved.
  const quick = read("src/components/admin/quick-product-entry.tsx");
  assert.doesNotMatch(quick, /admin_append_upc_photos_atomic/);
  const proposal = read("tests/sql/admin-gallery-upc-append-proposal.sql");
  assert.match(proposal, /security invoker/);
  assert.match(proposal, /pg_advisory_xact_lock/);
  assert.match(proposal, /revoke all on function public\.admin_append_upc_photos_atomic/);
});

test("A4 catalog photo lookup is read-only and reuses UPC photo attachment", () => {
  const quick = read("src/components/admin/quick-product-entry.tsx");
  const lookup = quick.split("function searchPhotoProducts(")[1]?.split("function selectPhotoProduct(")[0];
  assert.ok(lookup, "Missing shared product search");
  assert.match(lookup, /db\.from\("products"\)\.select\("id,name,sku,barcode,status"\)/);
  assert.match(lookup, /name\.ilike/);
  assert.match(lookup, /barcode\.ilike/);
  assert.doesNotMatch(lookup, /sku\.ilike/);
  assert.match(lookup, /\.limit\(10\)/);
  assert.doesNotMatch(lookup, /\.insert\(|\.update\(|\.delete\(|db\.rpc\(/);
  assert.match(quick, /const photoTarget = match \?/);
  assert.match(quick, /const photoUploadSection = embedded && photoTarget/);
  assert.match(quick, /productId: photoTarget\.productId/);
  assert.match(quick, /Guardar ficha completa/);
  assert.equal((quick.match(/async function attachExistingPhotos\(\)/g)||[]).length,1);
});

test("A5.1 product retirement review cannot execute a client-side product DELETE", () => {
  const legacy = read("public/updown-admin-legacy-runtime.js");
  assert.match(legacy, /inspectProductRetirement\(product,item\)/);
  assert.match(legacy, /Ninguna baja se ejecutó/);
  assert.match(legacy, /No verificable \(acceso o consulta restringidos\)/);
  assert.match(legacy, /Sin referencias visibles \(no concluyente\)/);
  assert.doesNotMatch(legacy, /db\.from\("products"\)\.delete\(\)/);
  assert.match(read("src\/app\/admin\/admin-premium-white.css"), /\.ud-a5-inspector/);
});
