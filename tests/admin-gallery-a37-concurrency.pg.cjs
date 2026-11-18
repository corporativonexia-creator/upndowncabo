// A3.7: proposed UPC-photo RPC, verified only in disposable PostgreSQL 16.
// The function is NOT installed on hosted Supabase and the app does NOT call it.
const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { Client } = require('pg');

const fixture = {
  host: '127.0.0.1', port: 5432, user: 'postgres',
  password: 'a36_fixture_password', database: 'upndown_a36_fixture',
};
const galleryDatabase = 'upndown_a37_fixture';
if (process.env.A36_PG_ISOLATED !== 'true' ||
    process.env.PGHOST !== fixture.host ||
    process.env.PGPORT !== String(fixture.port) ||
    process.env.PGUSER !== fixture.user ||
    process.env.PGPASSWORD !== fixture.password ||
    process.env.PGDATABASE !== fixture.database ||
    process.env.DATABASE_URL || process.env.SUPABASE_DB_URL) {
  throw new Error('A3.7 refuses any connection except the exact disposable local PostgreSQL fixture.');
}

const PRODUCT = '00000000-0000-4000-8000-000000000063';
const ADMIN = '00000000-0000-4000-8000-000000000064';
const REQUEST_A = '00000000-0000-4000-8000-000000000065';
const REQUEST_B = '00000000-0000-4000-8000-000000000066';
const PHOTO_A = '00000000-0000-4000-8000-000000000067';
const PHOTO_B = '00000000-0000-4000-8000-000000000068';
const url = (request, photo, product = PRODUCT) =>
  `https://fixture.test/storage/v1/object/public/product-media/products/upc/${product}/${request}/${photo}.jpg`;
const proposedSQL = readFileSync(join(__dirname, 'sql/admin-gallery-upc-append-proposal.sql'), 'utf8');
let setup;

async function connect(database = galleryDatabase) {
  const client = new Client({ ...fixture, database, connectionTimeoutMillis: 5000,
    statement_timeout: 10000, application_name: 'upndown-a37-disposable-only' });
  await client.connect();
  return client;
}
async function login(client, admin = true) {
  await client.query('begin');
  await client.query('set local role authenticated');
  await client.query("select set_config('app.qa_user_id',$1,true)", [ADMIN]);
  await client.query("select set_config('app.qa_is_admin',$1,true)", [String(admin)]);
}
async function append(client, ...images) {
  const { rows } = await client.query(
    'select public.admin_append_upc_photos_atomic($1,$2::text[]) as result', [PRODUCT, images]);
  return rows[0].result;
}
async function originalNine() {
  await setup.query(`insert into public.product_images
    (product_id,image_url,alt_text,sort_order,is_primary)
    select $1, 'https://fixture.test/historical-' || n || '.jpg', 'Histórica ' || n, n, n=1
    from generate_series(1,9) n`, [PRODUCT]);
}
async function waitForLock(pid) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const { rows } = await setup.query('select wait_event_type from pg_stat_activity where pid=$1', [pid]);
    if (rows[0]?.wait_event_type === 'Lock') return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.fail('Second authenticated PostgreSQL transaction must wait for gallery lock');
}

before(async () => {
  // Each test suite gets an isolated database; the A3.6 suite uses different
  // public tables and must remain untouched even inside this service container.
  const initializer = await connect(fixture.database);
  try { await initializer.query('create database upndown_a37_fixture'); }
  finally { await initializer.end(); }
  setup = await connect();
  await setup.query(`
    create role authenticated nologin;
    create role anon nologin;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('app.qa_user_id', true), '')::uuid
    $$;
    create function public.is_admin() returns boolean language sql stable as $$
      select current_setting('app.qa_is_admin', true) = 'true'
    $$;
    create table public.products (
      id uuid primary key, name text not null, sku text, barcode text,
      price numeric not null, stock integer not null
    );
    create table public.product_images (
      id uuid primary key default gen_random_uuid(),
      product_id uuid not null references public.products(id),
      image_url text not null, alt_text text, sort_order integer not null,
      is_primary boolean not null default false
    );
    alter table public.products enable row level security;
    alter table public.product_images enable row level security;
    create policy qa_admin_products_read on public.products for select to authenticated
      using (public.is_admin());
    create policy qa_admin_gallery_read on public.product_images for select to authenticated
      using (public.is_admin());
    create policy qa_admin_gallery_insert on public.product_images for insert to authenticated
      with check (public.is_admin());
    grant usage on schema public, auth to authenticated;
    grant execute on function auth.uid() to authenticated;
    grant execute on function public.is_admin() to authenticated;
    grant select on public.products, public.product_images to authenticated;
    grant insert on public.product_images to authenticated;
  `);
  await setup.query(proposedSQL);
});
beforeEach(async () => {
  await setup.query('truncate public.product_images, public.products cascade');
  await setup.query(`insert into public.products
    (id,name,sku,barcode,price,stock) values ($1,$2,$3,$4,$5,$6)`,
  [PRODUCT, 'Polo de prueba', 'ROP-0001', '2000000000015', 350, 7]);
});
after(async () => { if (setup) await setup.end(); });

test('two authenticated operators cannot exceed ten photos or duplicate sort order', async () => {
  await originalNine();
  const a = await connect(), b = await connect();
  try {
    await login(a);
    const first = await append(a, url(REQUEST_A, PHOTO_A));
    assert.deepEqual(first, { ok: true, inserted: 1, replayed: 0, total: 10 });
    await login(b);
    const pid = (await b.query('select pg_backend_pid() pid')).rows[0].pid;
    const waiting = append(b, url(REQUEST_B, PHOTO_B));
    await waitForLock(pid);
    await a.query('commit');
    await assert.rejects(waiting, /GALLERY_LIMIT_EXCEEDED/);
    await b.query('rollback');
    const images = (await setup.query('select image_url,sort_order,is_primary from public.product_images order by sort_order')).rows;
    assert.equal(images.length, 10);
    assert.deepEqual(images.map(image => image.sort_order), [1,2,3,4,5,6,7,8,9,10]);
    assert.equal(images[0].is_primary, true);
    assert.equal(images[9].image_url, url(REQUEST_A, PHOTO_A));
    const original = (await setup.query('select sku,barcode,price,stock from public.products where id=$1', [PRODUCT])).rows[0];
    assert.deepEqual(original, { sku:'ROP-0001',barcode:'2000000000015',price:'350',stock:7 });
  } finally {
    await Promise.allSettled([a.query('rollback'), b.query('rollback')]);
    await Promise.allSettled([a.end(), b.end()]);
  }
});

test('retry after a lost HTTP response does not insert the same uploaded photo twice', async () => {
  await originalNine();
  const a = await connect();
  try {
    await login(a);
    assert.equal((await append(a, url(REQUEST_A, PHOTO_A))).inserted, 1);
    await a.query('commit');
    await login(a);
    assert.deepEqual(await append(a, url(REQUEST_A, PHOTO_A)),
      { ok: true, inserted: 0, replayed: 1, total: 10 });
    await a.query('commit');
    assert.equal((await setup.query('select count(*)::integer n from public.product_images where product_id=$1', [PRODUCT])).rows[0].n, 10);
  } finally {
    await Promise.allSettled([a.query('rollback'), a.end()]);
  }
});

test('two-photo batch that exceeds capacity rolls back completely, preserving all nine originals', async () => {
  await originalNine();
  const a = await connect();
  try {
    await login(a);
    await assert.rejects(append(a, url(REQUEST_A, PHOTO_A), url(REQUEST_A, PHOTO_B)),
      /GALLERY_LIMIT_EXCEEDED/);
    await a.query('rollback');
    assert.equal((await setup.query('select count(*)::integer n from public.product_images')).rows[0].n, 9);
    assert.equal((await setup.query('select count(*)::integer n from public.product_images where image_url like $1', ['%/products/upc/%'])).rows[0].n, 0);
  } finally {
    await Promise.allSettled([a.query('rollback'), a.end()]);
  }
});

test('a signed-in non-admin cannot append; anonymous callers have no RPC EXECUTE grant', async () => {
  const nonAdmin = await connect(), anon = await connect();
  try {
    await login(nonAdmin, false);
    await assert.rejects(append(nonAdmin, url(REQUEST_A, PHOTO_A)), /ADMIN_REQUIRED/);
    await nonAdmin.query('rollback');
    await anon.query('begin');
    await anon.query('set local role anon');
    await assert.rejects(append(anon, url(REQUEST_A, PHOTO_A)), /permission denied/);
    await anon.query('rollback');
    assert.equal((await setup.query('select count(*)::integer n from public.product_images')).rows[0].n, 0);
  } finally {
    await Promise.allSettled([nonAdmin.query('rollback'), anon.query('rollback')]);
    await Promise.allSettled([nonAdmin.end(), anon.end()]);
  }
});

test('rejects a photo URL tied to a different product without altering the gallery', async () => {
  const a = await connect();
  try {
    await login(a);
    const foreign = '00000000-0000-4000-8000-000000000069';
    await assert.rejects(append(a, url(REQUEST_A, PHOTO_A, foreign)), /INVALID_UPC_PHOTO_URL/);
    await a.query('rollback');
    assert.equal((await setup.query('select count(*)::integer n from public.product_images')).rows[0].n, 0);
  } finally {
    await Promise.allSettled([a.query('rollback'), a.end()]);
  }
});
