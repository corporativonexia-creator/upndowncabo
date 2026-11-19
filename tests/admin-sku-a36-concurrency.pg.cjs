// A3.6: transaction-level PostgreSQL concurrency in a disposable GitHub Actions
// service container. Never connect to a hosted or operator-supplied database.
const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { Client } = require('pg');

const expected = {
  host: '127.0.0.1', port: 5432, user: 'postgres',
  password: 'a36_fixture_password', database: 'upndown_a36_fixture',
};
if (process.env.A36_PG_ISOLATED !== 'true' ||
    process.env.PGHOST !== expected.host ||
    process.env.PGPORT !== String(expected.port) ||
    process.env.PGUSER !== expected.user ||
    process.env.PGPASSWORD !== expected.password ||
    process.env.PGDATABASE !== expected.database ||
    process.env.DATABASE_URL || process.env.SUPABASE_DB_URL) {
  throw new Error('A3.6 requires the exact disposable local PostgreSQL fixture; refusing any other connection.');
}

const connect = async () => {
  const client = new Client({ ...expected, connectionTimeoutMillis: 5000,
    statement_timeout: 10000, application_name: 'upndown-a36-fixture' });
  await client.connect();
  return client;
};
const migration = readFileSync(join(__dirname, '../supabase/migrations/20261118202020_admin_sku_collision_safe_allocator.sql'), 'utf8');
const history = readFileSync(join(__dirname, '../supabase/migrations/20261002073000_inventory_auto_sku_barcode_variant_rules.sql'), 'utf8');
const suffix = history.match(/create or replace function public\.variant_auto_suffix[\s\S]*?end \$\$;/i)?.[0];
const WED = '00000000-0000-4000-8000-000000000001';
const P = '00000000-0000-4000-8000-000000000003';
const V1 = '00000000-0000-4000-8000-000000000004';
const V2 = '00000000-0000-4000-8000-000000000005';
let setup;

async function waitForLock(observer, clientPid) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const { rows } = await observer.query('select wait_event_type from pg_stat_activity where pid=$1', [clientPid]);
    if (rows[0]?.wait_event_type === 'Lock') return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.fail('The second independent PostgreSQL session did not wait for a transaction lock');
}

before(async () => {
  assert.ok(suffix, 'Historical suffix generator must be found');
  setup = await connect();
  await setup.query('select current_database()');
  await setup.query(`
    create table public.categories (id uuid primary key, sku_prefix text);
    create table public.category_sku_counters (
      category_id uuid primary key references public.categories(id),
      last_number integer not null default 0, updated_at timestamptz not null default now()
    );
    create table public.products (id uuid primary key, category_id uuid, sku text unique);
    create table public.product_variants (id uuid primary key, product_id uuid, sku text);
  `);
  await setup.query(suffix);
  await setup.query(migration);
});
beforeEach(async () => {
  await setup.query('truncate public.product_variants,public.products,public.category_sku_counters,public.categories cascade');
  await setup.query('insert into public.categories (id,sku_prefix) values ($1,$2)', [WED, 'WED']);
});
after(async () => { if (setup) await setup.end(); });

test('two independent transactions serialize category allocation and skip committed historical collisions', async () => {
  await setup.query('insert into public.products (id,category_id,sku) values ($1,$2,$3)', [P, WED, 'WED-0003']);
  await setup.query('insert into public.product_variants (id,product_id,sku) values ($1,$2,$3)', [V1, P, 'wed-0002']);
  const a = await connect(), b = await connect();
  try {
    await a.query('begin');
    const first = (await a.query('select public.next_category_sku($1) sku', [WED])).rows[0].sku;
    assert.equal(first, 'WED-0001');
    await b.query('begin');
    const pid = (await b.query('select pg_backend_pid() pid')).rows[0].pid;
    const waiting = b.query('select public.next_category_sku($1) sku', [WED]);
    await waitForLock(setup, pid);
    await a.query('insert into public.products (id,category_id,sku) values ($1,$2,$3)', [V2, WED, first]);
    await a.query('commit');
    const second = (await waiting).rows[0].sku;
    assert.equal(second, 'WED-0004');
    await b.query('commit');
    const counter = (await setup.query('select last_number from public.category_sku_counters where category_id=$1', [WED])).rows[0].last_number;
    assert.equal(counter, 4);
  } finally {
    await Promise.allSettled([a.query('rollback'), b.query('rollback')]);
    await Promise.allSettled([a.end(), b.end()]);
  }
});

test('two independent transactions serialize variants until first inserted SKU commits', async () => {
  await setup.query('insert into public.products (id,category_id,sku) values ($1,$2,$3)', [P, WED, 'WED-0001']);
  const a = await connect(), b = await connect();
  const attrs = JSON.stringify({ color: 'Rojo', talla: 'M' });
  try {
    await a.query('begin');
    const first = (await a.query('select public.next_variant_sku($1,$2::jsonb) sku', [P, attrs])).rows[0].sku;
    assert.equal(first, 'WED-0001-ROM');
    await b.query('begin');
    const pid = (await b.query('select pg_backend_pid() pid')).rows[0].pid;
    const waiting = b.query('select public.next_variant_sku($1,$2::jsonb) sku', [P, attrs]);
    await waitForLock(setup, pid);
    await a.query('insert into public.product_variants (id,product_id,sku) values ($1,$2,$3)', [V1, P, first]);
    await a.query('commit');
    const second = (await waiting).rows[0].sku;
    assert.equal(second, 'WED-0001-ROM02');
    await b.query('insert into public.product_variants (id,product_id,sku) values ($1,$2,$3)', [V2, P, second]);
    await b.query('commit');
    const codes = (await setup.query('select sku from public.product_variants order by sku')).rows.map(row => row.sku);
    assert.deepEqual(codes, ['WED-0001-ROM', 'WED-0001-ROM02']);
  } finally {
    await Promise.allSettled([a.query('rollback'), b.query('rollback')]);
    await Promise.allSettled([a.end(), b.end()]);
  }
});
