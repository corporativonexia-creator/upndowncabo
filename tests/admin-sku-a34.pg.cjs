// A3.4: real PostgreSQL semantics in isolated, in-memory PGlite only.
// No Supabase credentials, no hosted database, no stock or commercial writes.
const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const root = join(__dirname, '..');
const migration = readFileSync(join(root, 'supabase/migrations/20261118202020_admin_sku_collision_safe_allocator.sql'), 'utf8');
const previous = readFileSync(join(root, 'supabase/migrations/20261002073000_inventory_auto_sku_barcode_variant_rules.sql'), 'utf8');
const suffixDefinition = previous.match(/create or replace function public\.variant_auto_suffix[\s\S]*?end \$\$;/i)?.[0];
const WED = '00000000-0000-4000-8000-000000000001';
const DRI = '00000000-0000-4000-8000-000000000002';
const P = '00000000-0000-4000-8000-000000000003';
let db;

const sku = async category => (await db.query('select public.next_category_sku($1) sku', [category])).rows[0].sku;
const variant = async attrs => (await db.query('select public.next_variant_sku($1,$2::jsonb) sku', [P, JSON.stringify(attrs)])).rows[0].sku;

before(async () => {
  assert.ok(suffixDefinition, 'Existing variant suffix function must be present');
  db = new PGlite();
  await db.exec(`
    create table public.categories (id uuid primary key, sku_prefix text);
    create table public.category_sku_counters (
      category_id uuid primary key references public.categories(id),
      last_number integer not null default 0, updated_at timestamptz not null default now()
    );
    create table public.products (id uuid primary key, category_id uuid, sku text unique);
    create table public.product_variants (id uuid primary key, product_id uuid, sku text);
  `);
  await db.exec(suffixDefinition);
  await db.exec(migration);
});
beforeEach(async () => {
  await db.exec('truncate public.product_variants, public.products, public.category_sku_counters, public.categories cascade');
  await db.query('insert into public.categories(id,sku_prefix) values ($1,$2),($3,$4)', [WED, 'WED', DRI, 'DRI']);
});
after(async () => { if (db) await db.close(); });

test('retains exact category mask and independent monotonic counters', async () => {
  assert.equal(await sku(WED), 'WED-0001');
  assert.equal(await sku(WED), 'WED-0002');
  assert.equal(await sku(DRI), 'DRI-0001');
  assert.equal(await sku(WED), 'WED-0003');
});

test('skips old product and variant SKU collisions, even differing in case', async () => {
  await db.query('insert into public.products(id,sku,category_id) values ($1,$2,$3)', [P, 'WED-0001', WED]);
  await db.query('insert into public.product_variants(id,product_id,sku) values ($1,$2,$3)', ['00000000-0000-4000-8000-000000000004', P, 'wed-0002']);
  assert.equal(await sku(WED), 'WED-0003');
  assert.equal(await sku(WED), 'WED-0004');
  assert.equal((await db.query('select last_number from public.category_sku_counters where category_id=$1', [WED])).rows[0].last_number, 4);
  assert.deepEqual((await db.query('select sku from public.products')).rows.map(row => row.sku), ['WED-0001']);
});

test('parallel calls through the isolated driver return no duplicate category SKU', async () => {
  const codes = await Promise.all(Array.from({ length: 12 }, () => sku(WED)));
  assert.equal(new Set(codes).size, codes.length);
  assert.equal(codes[0], 'WED-0001');
  assert.equal(codes.at(-1), 'WED-0012');
});

test('variant suffix keeps historical pattern, skips occupied candidates in both tables', async () => {
  await db.query('insert into public.products(id,sku,category_id) values ($1,$2,$3)', [P, 'WED-0001', WED]);
  const attrs = { color: 'Rojo', talla: 'M' };
  assert.equal(await variant(attrs), 'WED-0001-ROM');
  await db.query('insert into public.product_variants(id,product_id,sku) values ($1,$2,$3)', ['00000000-0000-4000-8000-000000000004', P, 'WED-0001-ROM']);
  assert.equal(await variant(attrs), 'WED-0001-ROM02');
  await db.query('insert into public.products(id,sku,category_id) values ($1,$2,$3)', ['00000000-0000-4000-8000-000000000005', 'wed-0001-rom02', WED]);
  assert.equal(await variant(attrs), 'WED-0001-ROM03');
});

test('unattributed variant increments V suffix without reusing numbers', async () => {
  await db.query('insert into public.products(id,sku,category_id) values ($1,$2,$3)', [P, 'WED-0001', WED]);
  assert.equal(await variant({}), 'WED-0001-V01');
  await db.query('insert into public.product_variants(id,product_id,sku) values ($1,$2,$3)', ['00000000-0000-4000-8000-000000000004', P, 'WED-0001-V05']);
  assert.equal(await variant({}), 'WED-0001-V06');
});

test('rejects invalid category prefixes without consuming counters', async () => {
  await db.query('update public.categories set sku_prefix=$1 where id=$2', ['X', WED]);
  await assert.rejects(sku(WED), /CATEGORY_SKU_PREFIX_REQUIRED/);
  assert.equal((await db.query('select count(*)::integer n from public.category_sku_counters')).rows[0].n, 0);
});

test('keeps the established security mode, signatures and sole SQL target', () => {
  assert.match(migration, /create or replace function public\.next_category_sku\(p_category_id uuid\)/i);
  assert.match(migration, /create or replace function public\.next_variant_sku\(p_product_id uuid, p_attributes jsonb\)/i);
  assert.equal((migration.match(/security definer set search_path\s*=\s*''/gi) || []).length, 2);
  assert.doesNotMatch(migration, /\b(?:alter|drop|truncate|delete|update|grant|revoke)\s+(?:table|policy|index|on\s+function)\b/i);
  assert.match(migration, /pg_advisory_xact_lock/);
});
