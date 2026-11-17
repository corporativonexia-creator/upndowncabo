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
  has(files.css, "#updown-store.uds-preview", ".uds-search-focus #udsServices");
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
    "function movePreviewCatalogPage", "PREVIEW_CATALOG.view");
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
  has(files.services, 'root?.classList.contains("uds-preview")');
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
    "/updown-preview-services-stage7.js?v=services-admin-unified-v4-20261116");
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
  has(files.search, 'product.image || "/assets/updown-product-placeholder.svg"');
  has(files.product, 'product.images[active] || "/assets/updown-product-placeholder.svg"');
  has(files.related, 'item.image || "/assets/updown-product-placeholder.svg"');
});

// Still pending: requires an actual browser session and fixture backend.
test.todo("Browser E2E: login, variants, cart, links, ES/EN, mobile/desktop at 320/390/1280");
