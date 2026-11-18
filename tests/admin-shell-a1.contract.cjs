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
  assert.equal(sources.length, 10);
  for (const id of ["udProductsTab", "udOrdersTab", "udv2ContentTab", "udv2PosTab", "udProductWorkspaceTabs", "udInventoryMainNav"]) {
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
