const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

test("A0 keeps candidate deployment disabled and public launch gate active", () => {
  assert.equal(JSON.parse(read("vercel.json")).git.deploymentEnabled, false);
  assert.match(read("src/proxy.ts"), /const UNDER_CONSTRUCTION = true/);
});

test("A1 waits for legacy admin and all mounted tabs before revealing it", () => {
  const file = read("src/components/admin/admin-parity.tsx");
  const sources = file.match(/"\/updown-[^"]+\.js\?[^"]+"/g) || [];
  assert.equal(sources.length, 9);
  for (const id of ["udProductsTab", "udOrdersTab", "udv2ContentTab", "udv2PosTab", "udv2SellersTab", "udProductWorkspaceTabs", "udInventoryMainNav"]) {
    assert.ok(file.includes('"' + id + '"'), "Missing readiness check: " + id);
  }
  assert.match(file, /data-admin-ready=\{bootState === "ready" \? "true" : "false"\}/);
  assert.match(file, /installAdminSidebar\(\)/);
  assert.match(file, /const ADMIN_MARKUP = \{ __html: adminLegacyMarkup \}/);
  assert.match(file, /dangerouslySetInnerHTML=\{ADMIN_MARKUP\}/);
});

test("A1 does not display legacy DOM during initialization", () => {
  const css = read("src/app/admin/admin-premium-white.css");
  assert.match(read("src/app/admin/page.tsx"), /import "\.\/admin-premium-white\.css"/);
  assert.match(css, /\.ud-admin-legacy\[data-admin-ready="false"\]/);
  assert.match(css, /visibility:\s*hidden/);
});

test("A2 reuses live buttons in collapsible native groups without data mutations", () => {
  const file = read("src/components/admin/install-admin-sidebar.ts");
  for (const label of ["Productos e inventario", "Ventas y POS", "Comercial", "Sitio y contenidos"]) {
    assert.ok(file.includes(label), "Missing area: " + label);
  }
  for (const route of ["/pos", "/pos/recepciones", "/admin/pos/promociones"]) assert.ok(file.includes(route));
  assert.match(file, /nav\.replaceChildren\(\.\.\.sections\)/);
  assert.match(file, /createElement\("details"\)/);
  assert.doesNotMatch(file, /\b(?:db|supabase|client)\.(?:rpc|from|insert|update|delete)\(|\bfetch\(/);
  assert.doesNotMatch(file, /admin\/productos\/alta-rapida/);
});

test("A2 has authentic Premium White colors and responsive nav", () => {
  const css = read("src/app/admin/admin-premium-white.css").toLowerCase();
  for (const token of ["#123d32", "#2f7058", "#b7de45", "#f6f8f6"]) assert.ok(css.includes(token));
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /max-width: 1020px/);
});

test("A10.1 replaces polling inventory navigation with the existing Premium White sidebar", () => {
  const parity = read("src/components/admin/admin-parity.tsx");
  const sidebar = read("src/components/admin/install-admin-sidebar.ts");
  assert.doesNotMatch(parity,/await load\("\/updown-inventory-nav\.js/);
  assert.match(sidebar,/takeId\("udInventoryMainNav"\) \|\| quickLink\("Inventario", "\/admin\/inventario"\)/);
  assert.match(sidebar,/inventoryLink\.id = "udInventoryMainNav"/);
  assert.match(sidebar,/oldNew\.style\.display = "none"/);
  assert.match(sidebar,/if \(hasSellerTab\) takeId\("udAffiliatesLink"\)/);
  assert.match(sidebar,/hasSellerTab \? undefined : takeId\("udAffiliatesLink"\)/);
  assert.match(parity,/!document\.getElementById\("udInventoryMainNav"\)/);
  for (const required of ["updown-admin-legacy-runtime.js", "updown-product-heic-inventory-hotfix.js",
    "updown-product-smart-entry-v1.js", "updown-product-condition-v1.js", "updown-admin-v2.js",
    "updown-pos-pin-v2.js", "updown-h63-order-comms.js", "updown-inventory-v2.js",
    "updown-product-tabs-v1.js"])assert.ok(parity.includes(required));
});

test("A10.3 keeps HEIC conversions and prevents automatic inventory writes", () => {
  const heic = read("public/updown-product-heic-inventory-hotfix.js");
  const reconciliation=read("src/components/admin/inventory-reconciliation.tsx");
  assert.match(heic,/function installHeicInput\(\)/);
  assert.match(heic,/normalizeFiles\(files\)/);
  assert.match(heic,/new MutationObserver\(installHeicInput\)/);
  assert.doesNotMatch(heic,/syncMissingInventoryVariants|installProductSync|\.rpc\(|\.from\(|inventoryHotfix|admin_inventory_adjust|admin_inventory_save_variant/);
  assert.match(read("src/components/admin/admin-parity.tsx"),/heic-only-a10-3-20261118/);
  assert.match(reconciliation,/Productos sin variantes · revisión manual/);
  assert.match(reconciliation,/report\.missingVariantParents/);
  assert.doesNotMatch(reconciliation,/\.rpc\("admin_inventory_save_variant"|\.rpc\("admin_inventory_adjust"|\.update\(|\.insert\(/);
});
