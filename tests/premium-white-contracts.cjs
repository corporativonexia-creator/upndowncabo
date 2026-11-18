"use strict";

// Premium White regression contracts: static, offline, read-only.
// Run: node --test tests/premium-white-contracts.cjs
// Not a replacement for live browser E2E or backend/checkout tests.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(ROOT, file), "utf8");
const files = {
  home: read("src/app/vista-previa/page.tsx"),
  detail: read("src/app/vista-previa/producto/[productKey]/page.tsx"),
  bridge: read("src/app/vista-previa/preview-local-product-navigation.tsx"),
  focus: read("src/app/vista-previa/preview-desktop-search-focus.tsx"),
  collapse: read("src/app/vista-previa/preview-filter-auto-collapse.tsx"),
  css: read("src/app/vista-previa/premium-white.css"),
  sharedCss: read("src/app/globals.css"),
  productCss: read("src/components/store/premium-product-detail.css"),
  publicPage: read("src/app/producto/[productKey]/page.tsx"),
  share: read("src/lib/storefront/product-share.ts"),
  metadata: read("src/lib/storefront/product-metadata.ts"),
  runtime: read("public/updown-parity-runtime.js"),
  product: read("src/components/store/product-detail.tsx"),
  search: read("src/components/store/responsive/store-search.tsx"),
  proxy: read("src/proxy.ts"),
  services: read("public/updown-preview-services-stage7.js"),
  productFallback: read("public/assets/updown-product-placeholder.svg"),
  related: read("src/components/store/related-products-rail.tsx"),
  parity: read("src/components/store/storefront-parity.tsx"),
  adminServices: read("src/components/admin/services-admin.tsx"),
};
function has(file, ...parts) { for (const x of parts) assert.ok(file.includes(x), "Missing contract: " + x); }
function braces(css) {
  return [...css.replace(/\/\*[\s\S]*?\*\//g, "")].reduce(
    (count, c) => count + Number(c === "{") - Number(c === "}"), 0
  );
}

test("admin-only home and independent product routes", () => {
  has(files.home, 'requireRole("admin"', "PreviewLocalProductNavigation");
  has(files.detail, "ensurePreviewAdmin()", "<ProductDetail product={product} preview />");
});
test("the public launch gate remains independent of preview", () => {
  has(files.proxy, "const UNDER_CONSTRUCTION = true", '"/vista-previa"');
});
test("premium styling stays scoped and syntactically balanced", () => {
  assert.equal(braces(files.css), 0);
  assert.equal(braces(files.productCss), 0);
  has(files.css, "#updown-store:is(.uds-preview,.uds-premium-white)", ".uds-search-focus #udsServices");
  has(files.productCss, ".ud-premium-product-skin");
  has(files.detail, "ud-premium-product-skin", 'import "@/components/store/premium-product-detail.css"');
  has(files.publicPage, "ud-premium-product-skin", 'import "@/components/store/premium-product-detail.css"');
});
test("live search and independent navigation remain connected", () => {
  has(files.search, "window.__UPDOWN_SEARCH_PRODUCTS__?.(query)",
    "__UPDOWN_OPEN_SEARCH_PRODUCT__?.(product.id)");
  has(files.runtime, "window.__UPDOWN_SEARCH_PRODUCTS__=(query)=>",
    "window.__UPDOWN_OPEN_SEARCH_PRODUCT__=id=>",
    'new CustomEvent("updown:product-navigate"');
});
test("existing catalog filters still own apply/clear operations", () => {
  has(files.runtime, '"udsCatalogApply").onclick=()=>applyCatalogFilters(false)',
    '"udsCatalogClear").onclick=clearCommerceFilters;');
  has(files.collapse, "document.addEventListener", 'panel.classList.remove("is-open")',
    'toggle.setAttribute("aria-expanded", "false")');
  has(files.css, "PW-UX-03B / MOBILE FILTER ACCESS");
});
test("desktop focus keeps services out of the filtered product list", () => {
  has(files.css, ".uds-search-focus #udsServices", "position: sticky !important");
  has(files.focus, "--pw-preview-header-height", "--pw-preview-search-height");
});
test("gallery/list and paging controls are retained", () => {
  has(files.runtime, 'grid.classList.toggle("uds-preview-list"',
    "function movePreviewCatalogPage", "catalogPresentation.view");
});
test("independent products and related links stay on current preview host", () => {
  has(files.bridge, 'event.preventDefault()', "router.push(path)",
    'detailRoot.addEventListener("click", onDetailProductClick, true)',
    "event.stopPropagation()", "event.ctrlKey", "event.metaKey",
    'detailRoot?.removeEventListener("click", onDetailProductClick, true)');
  has(files.detail, "RelatedProductsServer", "premium-product-detail.css");
});
test("quantity +1 and stock cap persist across catalog and product page", () => {
  has(files.runtime, "ex.quantity=quantity+1",
    "quantity>=Number(product.stock)",
    "row.querySelector(\".uds-minus\").onclick",
    "row.querySelector(\".uds-remove\").onclick");
  has(files.product, "const next = Number(match?.quantity || 0) + 1",
    "if (next > product.stock)", "updown:cart-update",
    "product.hasVariants && !product.variantId");
});
test("preview cart reconciliation validates variant stock and price", () => {
  has(files.runtime, "async function reconcilePreviewCart",
    'db.from("product_variants")',
    "quantity!==Number(item.quantity)||price!==Number(item.price)");
});
test("checkout is blocked by default in preview", () => {
  has(files.runtime, 'if(PREVIEW_CATALOG&&window.__UPDOWN_CHECKOUT_ENABLED__!==true)',
    "previewCartWhatsAppUrl()");
});
test("services and languages remain connected", () => {
  has(files.services, 'root?.classList.contains("uds-premium-white")');
  has(files.search, 'label("Cerrar búsqueda", "Close search")');
  has(files.runtime, 'currentLanguage=lang==="en"?"en":"es"');
});

test("preview navigation remains private but share URLs are public", () => {
  has(files.runtime, "function previewShareUrl(product,forPublicShare=false)",
    'forPublicShare?"/producto/":"/vista-previa/producto/"',
    "const url=previewShareUrl(product,true);",
    "const destination=previewShareUrl(product);",
    "direct.href=previewShareUrl(product);");
  has(files.product, "const link = productPageUrl(product.key, false, affiliate?.code || null);",
    "preview, affiliate?.code");
  has(files.share, '(preview ? "/vista-previa" : "") + "/producto/"');
  has(files.metadata, "alternates: { canonical: productPageUrl(product.key, false) }",
    "openGraph:", "twitter:");
  has(files.publicPage, "<ProductDetail product={product} preview={false} />",
    "RelatedProductsServer product={product} preview={false}");
});
test("runtime preview and public share paths retain the same UUID and seller code", () => {
  const matched = files.runtime.match(/  function previewShareUrl\(product,forPublicShare=false\)\{[\s\S]*?\n  \}/);
  assert.ok(matched, "previewShareUrl function not found");
  const getUrl = new Function(
    "PREVIEW_CATEGORY_GROUPS", "getStoredAffiliate", "URL",
    matched[0] + "\nreturn previewShareUrl;"
  )([{slug:"wedges"}], () => ({code:"TEST01"}), URL);
  const product = {
    id:"123e4567-e89b-42d3-a456-426614174000",
    name:"Wedge Tour 56°", variant_id:null
  };
  const preview = new URL(getUrl(product));
  const publicUrl = new URL(getUrl(product, true));
  assert.equal(preview.pathname.replace("/vista-previa", ""), publicUrl.pathname);
  assert.ok(publicUrl.pathname.startsWith("/producto/"));
  assert.equal(preview.searchParams.get("ref"), "TEST01");
  assert.equal(publicUrl.searchParams.get("ref"), "TEST01");
  assert.equal(publicUrl.origin, "https://upndowncabo.com");
  assert.ok(!publicUrl.pathname.includes("/vista-previa"));
  // A variant must keep its own stable ID in BOTH routes.
  const variant = { ...product, variant_id:"223e4567-e89b-42d3-a456-426614174001" };
  const previewVariant = new URL(getUrl(variant));
  const publicVariant = new URL(getUrl(variant, true));
  assert.ok(previewVariant.pathname.endsWith("--v-" + variant.variant_id));
  assert.equal(previewVariant.pathname.replace("/vista-previa", ""), publicVariant.pathname);
  assert.equal(publicVariant.searchParams.get("ref"), "TEST01");
});

test("preview service copy is exclusively admin managed and not overwritten", () => {
  has(files.runtime,
    "db.from('storefront_services').select('*').eq('is_active',true).order('sort_order').order('key')",
    "function renderManagedServices()", "window.dispatchEvent(new Event('updown:services-ready'))");
  has(files.services,
    "window.__UPDOWN_SERVICES__", "isComingSoon(card)",
    'card.classList.toggle("uds-preview-service-coming", isComingSoon(card))');
  has(files.runtime,
    "const managedServiceLinks=Array.isArray(window.__UPDOWN_SERVICES__)",
    "window.__UPDOWN_OPEN_SERVICE__?.(row.key)",
    'serviceActions.length?serviceActions');
  assert.ok(!files.services.includes("refreshMobileServiceMenu"), "Preview must not duplicate the DB-led mobile menu");
  assert.ok(!files.services.includes("const copies="), "Preview must not override DB service content");
  assert.ok(!files.services.includes("putter-restoration"), "Preview must not alias obsolete restoration");
  assert.ok(!files.services.includes('byKind("maintenance")'), "Preview must not hide merged DB records");
  assert.ok(!files.services.includes("body.replaceChildren()"), "Preview must not remove admin content");
});
test("admin continues to edit source records and protected classes content", () => {
  has(files.adminServices,
    'from("storefront_services").select("*")',
    'from("storefront_services").update(fields)',
    'from("storefront_services").insert(fields)',
    'service.key === "classes"');
  has(files.parity,
    "/updown-preview-services-stage7.js?v=services-premium-shared-v5-20261117");
});

test("no-photo cards use approved velvet image without touching real product photos", () => {
  const match=files.productFallback.match(/base64,([A-Za-z0-9+/=]+)/);
  assert.ok(match, "Product fallback must embed the approved green velvet artwork");
  const b64=match[1];
  assert.equal(b64.length, 5840);
  let fingerprint=2166136261;
  for(const ch of b64) fingerprint=Math.imul(fingerprint^ch.charCodeAt(0),16777619)>>>0;
  assert.equal(fingerprint, 3030130964); // user-supplied canonical 1536×1024 image, resized to 600×400 WebP
  has(files.productFallback, 'width="600" height="400"');

  has(files.runtime,
    'const cover=productGallery(product)[0]||"";',
    'const imageSrc=cover&&(/^https?:\\/\\//i.test(cover)||cover.startsWith("/"))?cover:fallback;',
    'class="uds-card-media${placeholder?" is-product-placeholder":""}"',
    'img.src=fallback',
    'host.classList.add("is-product-placeholder")');
  has(files.runtime, 'image:productGallery(product)[0]||""');
  has(files.runtime, 'const imageSrc=validImage?item.image:fallback;');
  has(files.css, 'PW-UX-07 · Approved green-velvet artwork', 'object-fit: contain !important');
  has(files.sharedCss, "Canonical user-supplied no-photo product art", "object-fit: contain !important");
  has(files.search, 'product.image || "/assets/updown-product-placeholder.svg"');
  has(files.product, 'product.images[active] || "/assets/updown-product-placeholder.svg"');
  has(files.related, 'item.image || "/assets/updown-product-placeholder.svg"');
});

test("premium logo prominence preserves both native and desktop header heights", () => {
  const at=files.css.indexOf("PW-UX-08 · More brand presence");
  assert.ok(at>0, "Missing PW-UX-08 brand scope");
  const block=files.css.slice(at);
  has(block,
    "grid-template-columns: minmax(280px, 298px)",
    "width: 92px !important",
    "font-size: 22px !important",
    "@media (min-width: 390px) and (max-width: 1023px)",
    "font-size: clamp(12px, 3.18vw, 16px)",
    "@media (max-width: 389px)",
    "font-size: 17px !important");
  assert.ok(!block.includes("--uds-mobile-header-height:"),
    "Native header height must remain unchanged");
  assert.ok(!block.includes("--pw-preview-header-height:"),
    "Sticky search header offsets must remain unchanged");
  assert.ok(!block.includes("#udsMenuButton")&&!block.includes("#udsCartButton"),
    "Menu and cart controls must not change");
});

// Post-3B · Clases has a protected registration contract, not a generic CTA.
test("Clases editor exposes photo/order/visibility, never unlocks its CTA or texts", () => {
  const admin=files.adminServices;
  has(admin,
    'const protectedLesson = service.key === "classes"',
    'fields.sort_order = order',
    'fields.is_active = form.get("is_active") === "on"',
    'if (!protectedLesson) {',
    'fields.use_referral = form.get("use_referral") === "on"',
    'El título, los textos, el botón de registro, el formulario y los instructores siguen protegidos');
  assert.ok(admin.indexOf("fields.sort_order = order") < admin.indexOf("if (!protectedLesson) {"),
    "Order and visibility must work for Clases without entering the generic editor");
  assert.ok(!admin.includes('else if (!file) { setFailed(true); setMessage("Selecciona una foto para Clases de golf.")'),
    "Admin must be able to update order/visibility without uploading a new image");
});

test("Clases active flag is honored without rebuilding its lead form", () => {
  has(files.runtime,
    "if(row.key!=='classes'){",
    "serviceCards.forEach((card,key)=>{if(!visible.has(key))card.remove()});",
    "if(visible.has('classes'))lessonsNav.style.removeProperty('display');",
    "else lessonsNav.style.setProperty('display','none','important');",
    "db.from('storefront_services').select('*').eq('is_active',true)");
  const html=read("src/components/store/legacy-home-markup.ts");
  has(html,'udsGolfClasses','udsClassLeadForm','udsClassLeadSubmit','udsTeachers');
  assert.ok(!files.runtime.includes("if(!visible.has(key)&&key!=='classes')card.remove()"),
    "Do not leave a disabled Clases card visible");
});

test("Protected lesson registration retains consent and instructor tracking", () => {
  has(files.runtime,
    'db.rpc("record_golf_instructor_interest"',
    'function renderManagedServices()',
    "window.__UPDOWN_OPEN_SERVICE__=key=>");
  const html=read("src/components/store/legacy-home-markup.ts");
  has(html,'udsClassConsent','udsClassPhone','udsClassGoal');
  assert.ok(!files.services.includes("replaceChildren()"),
    "Stage7 must not rebuild the lesson DOM or delete registered forms");
});

test("first instructor click and second learner use current registration without stale tokens", () => {
  const start = files.runtime.indexOf('  el("udsTeachers")?.addEventListener("click",event=>{');
  const end = files.runtime.indexOf("  // H80: service content", start);
  assert.ok(start > 0 && end > start, "Expected a delegated listener on the original teachers node");
  const listenerSource = files.runtime.slice(start, end);
  let clickHandler = null;
  const calls = [];
  const teachers = { addEventListener(type, callback) {
    assert.equal(type, "click");
    assert.equal(clickHandler, null, "Exactly one listener must be attached");
    clickHandler = callback;
  }};
  const db = { rpc(name, args) {
    calls.push({ name, args });
    return Promise.resolve({ error: null });
  }};
  const setLead = new Function("el", "db", `
    let udsGolfLessonLeadId = null;
    let udsGolfLessonLeadToken = null;
    ${listenerSource}
    return (id, token) => {
      udsGolfLessonLeadId = id;
      udsGolfLessonLeadToken = token;
    };
  `)(id => id === "udsTeachers" ? teachers : null, db);
  assert.equal(typeof clickHandler, "function");
  const click = (slug = "instructor-test") =>
    clickHandler({ target: { closest(selector) {
      assert.equal(selector, ".uds-teacher-whatsapp");
      return slug ? { getAttribute: attribute =>
        attribute === "data-instructor-slug" ? slug : null } : null;
    }}});
  click();
  assert.equal(calls.length, 0, "Unregistered visitors must not be attributed");
  setLead("lead-one", "token-one");
  click();
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], { name: "record_golf_instructor_interest",
    args: { p_lead_id: "lead-one", p_lead_token: "token-one",
      p_instructor_slug: "instructor-test" } });
  setLead("lead-two", "token-two");
  click("instructor-next");
  assert.equal(calls.length, 2, "Second registration must produce one new interest");
  assert.deepEqual(calls[1].args, { p_lead_id: "lead-two",
    p_lead_token: "token-two", p_instructor_slug: "instructor-next" });
  click("");
  assert.equal(calls.length, 2, "No instructor slug means no interest");
});

test("managed instructor renderer never captures a lead token or adds duplicate click handlers", () => {
  const from = files.runtime.indexOf("  function mcUpdateInstructorLinks(){");
  const to = files.runtime.indexOf("  function mcCourseCard(", from);
  assert.ok(from > 0 && to > from);
  const implementation = files.runtime.slice(from, to);
  assert.ok(implementation.includes('link.href='));
  assert.ok(!implementation.includes("const access=mcLessonAccess()"));
  assert.ok(!implementation.includes("link.onclick"));
  assert.ok(!implementation.includes('record_golf_instructor_interest'));
});

test("admin service status summary renders evaluated visibility/order without literal template delimiters", () => {
  has(files.adminServices, '<span>{`${row.is_active', '${row.sort_order}', 'Registro protegido');
  assert.ok(!files.adminServices.includes('<span>`${row.is_active'),
    "Service summary must render an evaluated JSX template, not literal delimiters");
});

test("responsive runtime lifetimes invalidate stale catalog callbacks", () => {
  const start = files.runtime.indexOf('const parityRoot=el("updown-store");');
  const end = files.runtime.indexOf('window.__UPDOWN_SEARCH_STATUS__="loading";', start);
  assert.ok(start > 0 && end > start, "Runtime lifecycle snippet missing");
  const lifetimeSource = files.runtime.slice(start, end);
  const create = new Function("el", "window", lifetimeSource + "return {active:parityIsCurrent};");
  const root = { isConnected: true };
  const listeners = {};
  const window = {
    addEventListener: (event, listener) => {
      (listeners[event] ||= []).push(listener);
    }
  };
  const first = create(() => root, window);
  assert.equal(first.active(), true);
  const second = create(() => root, window);
  assert.equal(first.active(), false, "Old runtime must not act on newer controls");
  assert.equal(second.active(), true);
  root.isConnected = false;
  assert.equal(second.active(), false, "Detached root must never be rendered");
  root.isConnected = true;
  for (const listener of listeners["updown:storefront-dispose"] || []) listener();
  assert.equal(second.active(), false, "Disposed runtime must stay inactive");
});

test("catalog view controls and copy-ready callbacks are owned by the current runtime", () => {
  has(files.runtime,
    'if(!catalogPresentation||!parityIsCurrent())return;',
    'if(existing.__updownParityOwner===parityLifetime)return;',
    'tools.__updownParityOwner=parityLifetime;',
    'existing.remove();',
    'el("udsPreviewCatalogPager")?.remove();',
    'function renderProducts(){\n  if(!parityIsCurrent())return;',
    'window.removeEventListener("updown:copy-ready",onCopyReady);',
    'if(window.__UPDOWN_LANGUAGE_LISTENER__===onCopyReady)window.__UPDOWN_LANGUAGE_LISTENER__=null;',
    'previewViewport.removeEventListener("change",onViewportChange)'
  );
  assert.match(files.runtime, /const onCopyReady=\(\)=>\{if\(parityIsCurrent\(\)\)applyLanguage\(currentLanguage\)\}/);
});


test("late catalog and campaign responses cannot mutate a newer storefront", async () => {
  const campaignStart = files.runtime.indexOf("  async function refreshCampaignsForCheckout(){");
  const loadStart = files.runtime.indexOf("  async function loadStore(){");
  const nextStart = files.runtime.indexOf("  function syncCatalogFiltersToMaster(){", loadStart);
  assert.ok(campaignStart > 0 && campaignStart < loadStart && nextStart > loadStart);
  const create = new Function("deps", [
    "const {parityIsCurrent,db,restoreCatalogCache,el,currentLanguage,PREVIEW_CATALOG,timeoutSignal}=deps;",
    "let categories=[],products=[],storefrontPromotions=[];",
    "const state=deps.state;",
    "const renderCatalogState=()=>state.renders++;",
    "const saveCatalogCache=()=>state.caches++;",
    "const revealCatalog=()=>state.reveals++;",
    "const reconcileCart=()=>{state.carts++;return Promise.resolve()};",
    "const expandPublicVariants=p=>p;",
    "const applyStorefrontPromotions=p=>p;",
    files.runtime.slice(campaignStart, nextStart),
    "return {loadStore,refreshCampaignsForCheckout};"
  ].join("\n"));
  let active = true;
  let resolveCategories;
  const pendingCategories = new Promise(resolve => { resolveCategories = resolve; });
  const query = name => ({
    select() { return this; }, eq() { return this; },
    order() { return this; }, range() { return this; },
    abortSignal() {
      return name === "categories" ? pendingCategories : Promise.resolve({data:[],error:null});
    }
  });
  const state = { renders:0, caches:0, reveals:0, carts:0 };
  const deps = {
    parityIsCurrent: () => active,
    db: { from:query, rpc:() => ({abortSignal:() => Promise.resolve({data:[],error:null})}) },
    restoreCatalogCache: () => true, el: () => null,
    currentLanguage: "es", PREVIEW_CATALOG: false,
    timeoutSignal: () => undefined, state
  };
  const subject = create(deps);
  const oldCatalog = subject.loadStore();
  active = false;
  resolveCategories({data:[],error:null});
  await oldCatalog;
  assert.deepEqual(state, {renders:0,caches:0,reveals:0,carts:0},
    "A stale catalog request must not change a new catalog/cache/cart");

  let resolvePromotion;
  const pendingPromotion = new Promise(resolve => { resolvePromotion = resolve; });
  active = true;
  deps.db.rpc = () => ({abortSignal:() => pendingPromotion});
  const oldPromotion = subject.refreshCampaignsForCheckout();
  active = false;
  resolvePromotion({data:[],error:null});
  await oldPromotion;
  assert.equal(state.renders, 0, "A stale promotion request must not render");

  active = true;
  deps.db.rpc = () => ({abortSignal:() => Promise.resolve({data:[],error:null})});
  await subject.loadStore();
  assert.deepEqual(state, {renders:1,caches:1,reveals:1,carts:1},
    "The current runtime must still render, cache and reconcile normally");
  await subject.refreshCampaignsForCheckout();
  assert.equal(state.renders, 2, "A current promotion request must still refresh");
});

// Still pending: requires an actual browser session and fixture backend.
test.todo("Browser E2E: login, variants, cart, links, ES/EN, mobile/desktop at 320/390/1280");
