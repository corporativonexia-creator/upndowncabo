// A11 controlled release: exact runtime selection and SKU-only SQL change.
// This test is read-only and does not connect to a hosted database.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const manifest = JSON.parse(readFileSync(join(root, 'docs/ADMIN-A11-RELEASE-MANIFEST.json'), 'utf8'));
const changed = new Set(execFileSync('git', ['diff', '--name-only', manifest.base_main_sha, 'HEAD'], {
  cwd: root, encoding: 'utf8',
}).trim().split('\n').filter(Boolean));

test('release has all and only the audited runtime differences', () => {
  const runtime = [...manifest.runtime_paths].sort();
  const actual = [...changed].filter(p => p.startsWith('public/') || p.startsWith('src/')).sort();
  assert.deepEqual(actual, runtime);
});

test('release omits candidate deployment blocker and experimental SQL', () => {
  for (const path of manifest.forbidden_in_release) {
    assert.equal(changed.has(path), false, `${path} cannot ship in production`);
  }
  assert.equal(existsSync(join(root, 'vercel.json')), false);
});

test('the only database migration is the approved two-function SKU allocator', () => {
  const migrations = [...changed].filter(p => p.startsWith('supabase/migrations/')).sort();
  assert.deepEqual(migrations, [...manifest.approved_backend_migrations].sort());
  const sql = readFileSync(join(root, migrations[0]), 'utf8');
  const functions = [...sql.matchAll(/\bcreate\s+or\s+replace\s+function\s+public\.([a-z_]+)\s*\(/gi)].map(m => m[1]).sort();
  assert.deepEqual(functions, ['next_category_sku', 'next_variant_sku']);
  assert.doesNotMatch(sql, /\b(?:alter|drop|truncate|delete)\s+(?:table|policy|index)\b/i);
  assert.doesNotMatch(sql, /\bupdate\s+(?:public\.)?(?:products|product_variants)\b/i);
  assert.doesNotMatch(sql, /\binsert\s+into\s+(?:public\.)?(?:products|product_variants)\b/i);
});
