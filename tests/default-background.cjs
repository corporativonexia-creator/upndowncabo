const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function route(file, modules) {
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, require: name => modules[name],
    Response, Request, File, FormData, Buffer, process: { env: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test',
    } }, });
  return exports;
}
const readRoute = download => route('src/app/api/storefront/default-background/route.ts', {
  '@supabase/supabase-js': { createClient: () => ({ storage: { from: () => ({ download }) } }) },
});
function writeRoute(admin, operations) {
  return route('src/app/api/admin/default-background/route.ts', {
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    '@/lib/supabase/server': { createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: { id: 'user' } } }) },
      from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { role: admin ? 'admin' : 'employee', is_active: true } }) }) }) }),
    }) },
    '@/lib/supabase/admin': { createAdminClient: () => ({ storage: { from: () => operations } }) },
  });
}
function upload(bytes, type) {
  const form = new FormData(); form.set('image', new File([bytes], 'background', { type }));
  return new Request('https://example.test/api/admin/default-background', { method: 'POST', body: form });
}
test('no seasonal override or storage outage restores the local official artwork', async () => {
  for (const download of [async () => ({ data: null }), async () => { throw new Error('offline'); }]) {
    const response = await readRoute(download).GET();
    assert.equal(response.status, 307);
    assert.equal(response.headers.get('location'), '/assets/updown-product-placeholder.svg');
  }
});
test('a seasonal image is returned intact and can refresh without stale browser caching', async () => {
  const bytes = new Uint8Array([1,2,3,4]);
  const response = await readRoute(async () => ({ data: new Blob([bytes], { type: 'image/png' }) })).GET();
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('non-admin users cannot change or reset the shared background', async () => {
  const routes = writeRoute(false, { upload: () => assert.fail('unauthorized storage write'), remove: () => assert.fail('unauthorized delete') });
  assert.equal((await routes.POST(upload('text', 'image/png'))).status, 403);
  assert.equal((await routes.DELETE()).status, 403);
});
test('admin upload validates image signatures before writing storage', async () => {
  let written = false;
  const routes = writeRoute(true, { upload: async (path, bytes, options) => {
    written = true; assert.equal(path, 'storefront/default-background');
    assert.equal(options.upsert, true); assert.equal(options.contentType, 'image/png');
    return { error: null };
  } });
  assert.equal((await routes.POST(upload('not an image', 'image/png'))).status, 400);
  assert.equal(written, false);
  assert.equal((await routes.POST(upload(Buffer.from([137,80,78,71,13,10,26,10,0]), 'image/png'))).status, 200);
  assert.equal(written, true);
});
test('reset removes only the display override, never a category or product', async () => {
  let removed;
  const response = await writeRoute(true, { remove: async paths => { removed = paths; return { error: null }; } }).DELETE();
  assert.equal(response.status, 200);
  assert.equal(JSON.stringify(removed), '["storefront/default-background"]');
});
