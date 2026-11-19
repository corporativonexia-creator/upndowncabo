const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(readFileSync(path.join(root, "docs/ADMIN-A11-RELEASE-MANIFEST.json"), "utf8"));
const diff = execFileSync("git", ["diff", "--name-status", `${manifest.base_main_sha}..HEAD`], {
  cwd: root, encoding: "utf8",
}).trim().split("\n").filter(Boolean).map(line => {
  const [status, file] = line.split("\t");
  assert.match(status, /^[AMD]$/, `Review renamed or unusual file: ${line}`);
  return { status, file };
});

const runtime = file => /^(?:public\/updown-|src\/app\/admin\/|src\/app\/pos\/recepciones\/|src\/components\/admin\/|src\/lib\/admin\/)/.test(file);
const nonRuntime = file => /^(?:docs\/|tests\/|\.github\/workflows\/)/.test(file) || file === "vercel.json" || file.startsWith("supabase/migrations/");

test("A11 identifies every runtime change against the pinned main baseline", () => {
  const changed = diff.filter(entry => runtime(entry.file)).map(entry => entry.file).sort();
  assert.deepEqual([...manifest.runtime_paths].sort(), changed);
  assert.equal(changed.length, 23);
  assert.ok(diff.every(entry => runtime(entry.file) || nonRuntime(entry.file)), "Unclassified file in candidate diff");
  assert.ok(diff.some(entry => entry.status === "D" && entry.file === "src/components/admin/inventory-label-enhancer.tsx"));
});

test("A11 never includes the Vercel deployment blocker or proposed Supabase SQL in a release", () => {
  assert.equal(manifest.release_status, "NO_GO_PENDING_EXPLICIT_APPROVAL_AND_STAGING_QA");
  assert.deepEqual([...manifest.forbidden_in_release].sort(), [
    "supabase/migrations/20261118202020_admin_sku_collision_safe_allocator.sql", "vercel.json",
  ]);
  for (const file of manifest.runtime_paths) {
    assert.ok(!/^supabase\/|^vercel\.json$|^\.github\//.test(file), `Forbidden release file: ${file}`);
  }
  assert.deepEqual(JSON.parse(readFileSync(path.join(root, "vercel.json"), "utf8")), {
    git: { deploymentEnabled: false },
  });
  assert.ok(diff.some(entry => entry.file === manifest.forbidden_in_release[0]));
  assert.ok(diff.some(entry => entry.file === manifest.forbidden_in_release[1]));
});

test("A11 keeps staged verification files outside production runtime selection", () => {
  assert.ok(diff.some(entry => entry.file === "tests/sql/admin-gallery-upc-append-proposal.sql"));
  assert.ok(diff.some(entry => entry.file === "tests/sql/admin-retirement-a53-fixture.sql"));
  assert.ok(diff.some(entry => entry.file === ".github/workflows/admin-ux-a0a2.yml"));
  assert.ok(manifest.runtime_paths.every(file => !file.startsWith("tests/") && !file.startsWith("docs/")));
  assert.equal(manifest.audited_runtime_sha, "d2a8976d594b10280f1cd7aa55ee81efc5cfb7e6");
});
