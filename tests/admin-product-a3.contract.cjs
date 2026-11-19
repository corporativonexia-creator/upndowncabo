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

test("A6.3 permits valid factory UPC-A, rejects checksum errors and totals sheet categories by currency", () => {
  const labels=read("src/components/admin/inventory-label-print.ts");
  const inventory=read("src/components/admin/inventory-admin.tsx");
  assert.match(labels,/function printableBarcode\(/);
  assert.match(labels,/\^\\d\{12\}\$/);
  assert.match(labels,/validEan13\(`0\$\{value\}`\)/);
  assert.match(labels,/visible: value, upcA: true/);
  assert.match(labels,/visible\.slice\(1, 6\)/);
  assert.match(labels,/visible\.slice\(6, 11\)/);
  assert.match(labels,/const printable = printableBarcode\(barcode\)/);
  assert.doesNotMatch(labels,/\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.rpc\(/);
  assert.match(inventory,/SUBTOTALES POR CATEGORÍA/);
  assert.match(inventory,/const categoryTotals=new Map/);
  assert.match(inventory,/subtotal\.amounts\[currency\]\+=pieces\*Number\(r\.effective_price\)/);
  assert.match(inventory,/sum\.priced\.MXN/);
  assert.match(inventory,/sum\.priced\.USD/);
  assert.match(inventory,/allCategoriesSelected\|\|selectedCategories\.includes/);
});

test("A6.4 reconciles POS visibility and stock in read-only snapshots, not by equating counts", () => {
  const ts=require("typescript");
  const compile=name=>ts.transpileModule(read(name),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const catalogModule={exports:{}};
  new Function("exports","require",compile("src/lib/pos/catalog.ts"))(catalogModule.exports,require);
  const reportModule={exports:{}};
  new Function("exports","require",compile("src/lib/admin/inventory-reconciliation.ts"))(reportModule.exports,name=>name==="@/lib/pos/catalog"?catalogModule.exports:require(name));
  const reconcile=reportModule.exports.reconcileInventoryPos;
  const parents=[
    {id:"a",name:"Ropa",status:"active",pos_visible:true},
    {id:"h",name:"Oculto",status:"active",pos_visible:false},
    {id:"s",name:"Servicio",status:"active",pos_visible:true,is_service:true},
    {id:"n",name:"Sin visibilidad",status:"active",pos_visible:null},
  ];
  const variants=[
    {id:"v1",product_id:"a",sku:"A1",title:"Rojo",stock:5,is_active:true,attributes:{}},
    {id:"v2",product_id:"a",sku:"A2",title:"Azul",stock:2,is_active:false,attributes:{}},
    {id:"v3",product_id:"h",sku:"H1",title:"Principal",stock:1,is_active:true,attributes:{}},
  ];
  const inventory=[
    {variant_id:"v1",product_id:"a",product_name:"Ropa",variant_title:"Rojo",sku:"A1",stock:7},
    {variant_id:"v2",product_id:"a",product_name:"Ropa",variant_title:"Azul",sku:"A2",stock:2},
    {variant_id:"v3",product_id:"h",product_name:"Oculto",variant_title:"Principal",sku:"H1",stock:1},
  ];
  const result=reconcile(inventory,parents,variants);
  assert.equal(result.inventoryVariants,3);
  assert.equal(result.projectedPosItems,2);
  assert.equal(result.matchingVariants,1);
  assert.equal(result.onlyInventory.length,2);
  assert.match(result.onlyInventory.map(x=>x.reason).join(" "),/Variante inactiva para POS/);
  assert.match(result.onlyInventory.map(x=>x.reason).join(" "),/Producto oculto en POS/);
  assert.equal(result.onlyPos.length,1);
  assert.match(result.onlyPos[0].reason,/sin variantes/);
  assert.deepEqual(result.stockDifferences.map(x=>[x.inventoryStock,x.posStock]),[[7,5]]);
  const client=read("src/components/admin/inventory-reconciliation.tsx");
  assert.match(client,/readAllPages<PosProduct>/);
  assert.match(client,/readAllPages<PosVariant>/);
  assert.match(client,/admin_inventory_catalog/);
  assert.match(client,/Conciliar con POS/);
  assert.doesNotMatch(client,/\.update\(|\.delete\(|\.insert\(|\.upsert\(|admin_inventory_adjust/);
  assert.doesNotMatch(read("src/lib/admin/inventory-reconciliation.ts"),/\.update\(|\.delete\(|\.insert\(/);
});

test("A7.1 POS administrative reports load on navigation, not all seven at startup", () => {
  const runtime=read("public/updown-admin-v2.js");
  assert.match(runtime,/function loadPosActiveReport\(section\)/);
  for(const [section,loader] of Object.entries({dashboard:"loadPosDashboard",shifts:"loadPosShifts",summary:"loadPosSummary",inventory:"loadPosInventory",'employees-report':"loadEmployeeReport",'daily-close':"loadDailyClose",audit:"loadPosAudit"})){
    assert.ok(runtime.includes(`${section.includes('-')?'"':''}${section}${section.includes('-')?'"':''}:${loader}`),`Missing lazy loader for ${section}`);
  }
  assert.match(runtime,/if\(state\.posAdminReady\)void loadPosActiveReport\(next\)/);
  assert.match(runtime,/await loadPosActiveReport\(state\.posAdminSection\|\|"dashboard"\)/);
  assert.match(runtime,/if\(btn\.dataset\.posTabBound==="true"\)return/);
  assert.match(runtime,/if\(btn\.dataset\.posPrintBound==="true"\)return/);
  assert.doesNotMatch(runtime,/Promise\.all\(\[loadPosAudit\(\),loadPosSummary\(\),loadPosShifts\(\),loadPosInventory\(\),loadEmployeeReport\(\),loadDailyClose\(\),loadPosDashboard\(\)\]\)/);
});

test("A7.2 POS report request versions reject stale responses and audit filters requery the server", () => {
  const runtime=read("public/updown-admin-v2.js");
  assert.match(runtime,/function schedulePosReport\(section\)/);
  assert.match(runtime,/nextPosReportRequest\(section\);\s*cancelPosReportTimer\(section\)/);
  assert.match(runtime,/state\.posAdminReady&&state\.activeView==="pos"&&state\.posAdminSection===section/);
  assert.equal((runtime.match(/const version=nextPosReportRequest\(/g)||[]).length,7);
  assert.equal((runtime.match(/if\(!isCurrentPosReport\(/g)||[]).length,14);
  assert.match(runtime,/state\.posAuditType=String\(event\.target\.value\|\|"all"\);\s*schedulePosReport\("audit"\)/);
  assert.match(runtime,/state\.posAuditEmployee=String\(event\.target\.value\|\|"all"\);\s*schedulePosReport\("audit"\)/);
  assert.match(runtime,/state\.posAuditTerminal=String\(event\.target\.value\|\|"all"\);\s*schedulePosReport\("audit"\)/);
});

test("A8.1 reception history is debounced and stale-safe without changing service operations", () => {
  const page=read("src/app/pos/recepciones/page.tsx");
  const styles=read("src/app/pos/recepciones/receptions.module.css");
  assert.match(page,/historySequence = useRef\(0\)/);
  assert.match(page,/function changeHistorySearch\(value: string\)/);
  assert.match(page,/if \(sequence !== historySequence\.current\) return/);
  assert.match(page,/\}, 300\)/);
  assert.match(page,/onChange=\{\(e\) => changeHistorySearch\(e\.target\.value\)\}/);
  assert.match(page,/aria-busy=\{searching\}/);
  assert.match(page,/setHistoryError\("No se pudo consultar el historial: " \+ errorText\(e\)\)/);
  for(const originalOperation of ["pos_reception_create","pos_reception_set_ready","buildReceptionPdf","printThermal"]){
    assert.ok(page.includes(originalOperation),`Missing existing operation ${originalOperation}`);
  }
  assert.match(styles,/\.shell\{min-height:100vh;background:#f6f8f6/);
});

test("A8.2 workshop status filters and selected details reuse read-only authorized history", () => {
  const page=read("src/app/pos/recepciones/page.tsx");
  const styles=read("src/app/pos/recepciones/receptions.module.css");
  assert.match(page,/type ReceptionFilter = "all" \| ServiceReception\["status"\]/);
  assert.match(page,/receptions\.filter\(row => row\.status === statusFilter\)/);
  assert.match(page,/aria-label="Filtrar por estado en resultados"/);
  assert.match(page,/aria-label="Detalle de recepción"/);
  assert.match(page,/rows\.find\(row => row\.id === previous\?\.id\) \|\| previous/);
  assert.match(page,/selected\.work_description/);
  assert.match(page,/selected\.condition_notes/);
  assert.match(page,/selected\.accessories/);
  assert.match(styles,/\.filterGroup\{/);
  assert.equal((page.match(/db\.rpc\("pos_reception_recent"/g)||[]).length,2);
  assert.equal((page.match(/db\.rpc\("pos_reception_create"/g)||[]).length,1);
  assert.equal((page.match(/db\.rpc\("pos_reception_set_ready"/g)||[]).length,1);
});

test("A9.1 orders are lazy and seller-note observer cannot refresh itself", () => {
  const legacy=read("public/updown-admin-legacy-runtime.js");
  const comms=read("public/updown-h63-order-comms.js");
  assert.equal((legacy.match(/await Promise\.all\(\[loadCategories\(\),loadProducts\(\)\]\)/g)||[]).length,2);
  assert.match(legacy,/if\(request!==ordersRequest\)return/);
  assert.match(legacy,/if\(!showProducts\)\{\s*loadOrders\(\)/);
  assert.match(comms,/function ordersVisible\(\)/);
  assert.match(comms,/if \(!ordersVisible\(\)\) return Promise\.resolve\(\)/);
  assert.match(comms,/if \(currentLoad\) \{/);
  assert.match(comms,/observer\.observe\(root, \{ childList: true, subtree: false \}\)/);
  assert.match(comms,/document\.getElementById\("udOrdersTab"\)\?\.addEventListener\("click", activateOrders\)/);
  assert.match(comms,/if \(ordersVisible\(\)\) void loadOrders\(\)/);
  assert.match(comms,/void subscribeRealtime\(\)/);
  assert.doesNotMatch(comms,/observer\.observe\(root, \{ childList: true, subtree: true \}\)/);
  assert.match(comms,/client\.rpc\("acknowledge_order_note", \{/);
  assert.match(legacy,/\.update\(\{order_status:newStatus\}\)/);
});

test("A9.2 seller and commission reads reject stale responses without changing commercial writes", () => {
  const admin=read("public/updown-admin-v2.js");
  const fixture=read("tests/mock-supabase.cjs");
  assert.match(admin,/sellerLoadVersion: 0/);
  assert.match(admin,/if\(state\.activeView==="sellers"&&view!=="sellers"\)invalidateSellerReads\(\)/);
  assert.match(admin,/if\(view==="sellers"&&!wasSellers\) loadSellers\(\)/);
  assert.match(admin,/const version=\+\+state\.sellerLoadVersion/);
  assert.match(admin,/if\(!isCurrent\(\)\)return;\s*if\(s\.error\)/);
  assert.match(admin,/if\(isCurrent\(\)\)toast\(e\.message/);
  assert.match(admin,/\.removeAttribute\("aria-busy"\)/);
  assert.match(admin,/db\.from\("affiliate_sellers"\)\.select\("id,code,name,email,phone,commission_rate,is_active,created_at"\)/);
  assert.match(admin,/db\.from\("affiliate_commissions"\)\.select\("id,order_id,seller_id,seller_code,currency,order_total,commission_rate,commission_amount,status,created_at,affiliate_sellers\(name,code\),orders\(order_number,created_at\)"\)/);
  assert.match(admin,/\.update\(\{commission_rate:rate,is_active:active\}\)/);
  assert.match(admin,/\.update\(\{status\}\)/);
  assert.match(fixture,/if\(url\.pathname==='\/rest\/v1\/affiliate_commissions'&&options\.sellersRaceFixture\)/);
});

test("A9.3 site content reads only its active type and ignores obsolete results", () => {
  const admin=read("public/updown-admin-v2.js");
  const fixture=read("tests/mock-supabase.cjs");
  assert.match(admin,/contentLoaded: \{ courses: false, instructors: false, articles: false \}/);
  assert.match(admin,/if\(state\.activeView==="content"&&view!=="content"\)invalidateContentReads\(\)/);
  assert.match(admin,/if\(view==="content"&&!wasContent\) loadContent\(\)/);
  assert.match(admin,/const version=\+\+state\.contentLoadVersion/);
  assert.match(admin,/const table=\{courses:"golf_courses",instructors:"golf_instructors",articles:"journal_articles"\}\[type\]/);
  assert.match(admin,/const result=await db\.from\(table\)\.select\("\*"\)/);
  assert.match(admin,/if\(!isCurrent\(\)\)return;\s*const sortByOrder/);
  assert.match(admin,/if\(result\.error\)throw result\.error/);
  assert.match(admin,/if\(state\.contentLoaded\[type\]\)renderContentSection\(\)/);
  assert.match(admin,/\.insert\(payload\)/);
  assert.match(admin,/\.update\(payload\)\.eq\("id",editingId\)/);
  assert.match(fixture,/if\(options\.contentRaceFixture&&\[/);
});
