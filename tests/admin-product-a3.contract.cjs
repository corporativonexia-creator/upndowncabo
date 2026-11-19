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

test("A5.2 retirement preview is read-only and changes no commercial value", () => {
  const legacy=read("public/updown-admin-legacy-runtime.js");
  const inspector=legacy.split("async function inspectProductRetirement(product,item){")[1]?.split('el("udProductsTab").onclick')[0];
  assert.ok(inspector,"A5.2 inspector must exist");
  assert.match(inspector,/Vista previa de retiro · sin guardar/);
  assert.match(inspector,/\["Estado",escapeHtml\(product.status/);
  assert.match(inspector,/\["Tienda online",visibility\(product.online_visible\),"Oculto"\]/);
  assert.match(inspector,/\["POS",visibility\(product.pos_visible\),"Oculto"\]/);
  assert.match(inspector,/Intactos:<\/strong> SKU, UPC, precios, descuentos, costos, existencias, variantes/);
  assert.doesNotMatch(inspector,/\.update\(|\.delete\(|\.insert\(|\.upsert\(|\.rpc\(/);
  assert.match(read("src\/app\/admin\/admin-premium-white.css"),/\.ud-a52-preview/);
});

test("A5.3 retirement SQL is an isolated test contract, never an installed mutation", () => {
  const sql=read("tests/sql/admin-retirement-a53-fixture.sql");
  const testRunner=read("tests/admin-retirement-a53.pg.cjs");
  const workflow=read(".github/workflows/admin-ux-a0a2.yml");
  const runtime=read("public/updown-admin-legacy-runtime.js");
  assert.match(sql,/LABORATORY ONLY/);
  assert.match(sql,/security definer set search_path = ''/);
  assert.match(sql,/for update/);
  assert.match(sql,/revoke all on function private\.qa_retire_product_contract/);
  assert.match(testRunner,/A53_PG_ISOLATED !== 'true'/);
  assert.match(testRunner,/process\.env\.DATABASE_URL \|\| process\.env\.SUPABASE_DB_URL/);
  assert.match(workflow,/A5\.3 retirement contract against disposable PostgreSQL only/);
  assert.doesNotMatch(runtime,/qa_retire_product_contract/);
});

test("A6.1 moves inventory log reads behind its tab and keeps realtime stock in React state", () => {
  const inventory=read("src/components/admin/inventory-admin.tsx");
  const enhancer=read("src/components/admin/inventory-live-enhancer.tsx");
  const labels=read("src/components/admin/inventory-label-print.ts");
  const initial=inventory.split("const load=useCallback(async()=>{")[1]?.split("const loadMovements=async()=>{")[0];
  assert.ok(initial,"Catalog loader must remain independent from movements");
  assert.match(initial,/admin_inventory_catalog/);
  assert.doesNotMatch(initial,/admin_inventory_movement_log/);
  assert.match(inventory,/if\(k==="log"\)void loadMovements\(\)/);
  assert.match(inventory,/p_limit:300/);
  assert.match(inventory,/updown-inventory-stock-changed/);
  assert.match(enhancer,/dispatchEvent\(new Event\("updown-inventory-stock-changed"\)\)/);
  assert.doesNotMatch(enhancer,/syncDisplayedStock|\.select\("sku,barcode,stock"\)|cells\[4\]\.textContent/);
  assert.match(enhancer,/installMovementSearch/);
  assert.match(labels,/class="price"|class=\\"price\\"|<div class="price">/);
  assert.match(inventory,/SUBTOTAL /);
  assert.match(inventory,/admin_inventory_adjust/);
  assert.doesNotMatch(enhancer,/\.insert\(|\.update\(|\.delete\(/);
});

test("A6.2 prints thermal labels from one entry point without touching commercial records", () => {
  const route=read("src/app/admin/inventario/page.tsx");
  const inventory=read("src/components/admin/inventory-admin.tsx");
  const labels=read("src/components/admin/inventory-label-print.ts");
  assert.equal(fs.existsSync(path.join(root,"src/components/admin/inventory-label-enhancer.tsx")),false);
  assert.doesNotMatch(route,/InventoryLabelEnhancer/);
  assert.match(inventory,/printInventoryLabels\(r\)/);
  assert.doesNotMatch(inventory,/function printLabels\(/);
  assert.match(labels,/@page\{size:50mm 30mm;margin:0\}/);
  assert.match(labels,/const rawPrice = variant\.sale_price \?\? variant\.price \?\? product\.sale_price \?\? product\.price/);
  assert.match(labels,/db\.from\("product_variants"\).*\.eq\("id", row\.variant_id\)/);
  assert.match(labels,/db\.from\("products"\).*\.eq\("id", row\.product_id\)/);
  assert.match(labels,/Promise\.all/);
  assert.match(labels,/price < 0/);
  assert.match(labels,/esc\(lowerLine\)/);
  assert.doesNotMatch(labels,/\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.rpc\(/);
  assert.match(inventory,/SUBTOTAL /);
});
