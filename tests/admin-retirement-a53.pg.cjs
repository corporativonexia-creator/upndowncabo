// A5.3: retirement transaction proposal in a disposable PostgreSQL 16 DB.
// Not a production RPC, not a hosted Supabase connection, no live product data.
const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { Client } = require('pg');

const fixture = {
  host: '127.0.0.1', port: 5432, user: 'postgres',
  password: 'a36_fixture_password', database: 'upndown_a36_fixture',
};
const database = 'upndown_a53_fixture';
if (process.env.A53_PG_ISOLATED !== 'true' ||
    process.env.PGHOST !== fixture.host ||
    process.env.PGPORT !== String(fixture.port) ||
    process.env.PGUSER !== fixture.user ||
    process.env.PGPASSWORD !== fixture.password ||
    process.env.PGDATABASE !== fixture.database ||
    process.env.DATABASE_URL || process.env.SUPABASE_DB_URL) {
  throw new Error('A5.3 refuses any database except the exact local disposable PostgreSQL fixture.');
}

const PRODUCT = '00000000-0000-4000-8000-000000000081';
const VARIANT = '00000000-0000-4000-8000-000000000082';
const ADMIN = '00000000-0000-4000-8000-000000000083';
const OTHER = '00000000-0000-4000-8000-000000000084';
const REFERENCE = '00000000-0000-4000-8000-000000000085';
const BASE_REVISION = '2026-11-18T00:00:00.000Z';
const REASON = 'Retiro simulado por decisión administrativa';
const proposedSQL = readFileSync(join(__dirname, 'sql/admin-retirement-a53-fixture.sql'), 'utf8');
let setup;

async function connect(db = database) {
  const client = new Client({ ...fixture, database: db,
    connectionTimeoutMillis: 5000, statement_timeout: 10000,
    application_name: 'upndown-a53-disposable-only' });
  await client.connect();
  return client;
}
async function login(client, actor = ADMIN) {
  await client.query('begin');
  await client.query('set local role authenticated');
  await client.query("select set_config('app.qa_user_id',$1,true)", [actor]);
}
async function retire(client, expected = BASE_REVISION, product = PRODUCT, reason = REASON) {
  const { rows } = await client.query(
    'select private.qa_retire_product_contract($1,$2,$3) result',
    [product, expected, reason]);
  return rows[0].result;
}
async function snapshot() {
  const [p,v,e,h] = await Promise.all([
    setup.query('select * from public.products where id=$1',[PRODUCT]),
    setup.query('select * from public.product_variants where product_id=$1',[PRODUCT]),
    setup.query('select * from private.qa_retirement_events where product_id=$1',[PRODUCT]),
    setup.query(`select
      (select count(*)::integer from public.pos_sale_items where product_id=$1) sales,
      (select count(*)::integer from public.inventory_movements where product_id=$1) movements,
      (select count(*)::integer from public.order_items where product_id=$1) orders,
      (select count(*)::integer from public.checkout_v2_items where product_id=$1) checkout,
      (select count(*)::integer from public.pos_service_receptions where service_product_id=$1) workshop,
      (select count(*)::integer from public.product_images where product_id=$1) images`,[PRODUCT])
  ]);
  return { product:p.rows[0], variants:v.rows, events:e.rows, references:h.rows[0] };
}
async function waitForLock(pid) {
  for (let attempt=0; attempt<80; attempt++) {
    const {rows}=await setup.query('select wait_event_type from pg_stat_activity where pid=$1',[pid]);
    if (rows[0]?.wait_event_type==='Lock')return;
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  assert.fail('Second PostgreSQL transaction must wait for product row lock');
}

before(async () => {
  const initializer=await connect(fixture.database);
  try { await initializer.query(`create database ${database}`); }
  finally { await initializer.end(); }
  setup=await connect();
  await setup.query(`
    create role authenticated nologin;
    create role anon nologin;
    create schema auth;
    create schema private;
    create table public.profiles (id uuid primary key, role text not null, is_active boolean not null);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('app.qa_user_id',true),'')::uuid
    $$;
    create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$
      select exists(select 1 from public.profiles p
        where p.id=auth.uid() and p.role='admin' and p.is_active=true)
    $$;
    revoke all on function public.is_admin() from public,anon,authenticated;
    create table public.products (
      id uuid primary key, sku text not null, barcode text not null,
      price numeric not null, sale_price numeric, cost numeric not null,
      stock integer not null, status text not null,
      online_visible boolean not null, pos_visible boolean not null,
      featured boolean not null, new_arrival_enabled boolean not null,
      updated_at timestamptz not null,
      constraint products_at_least_one_sales_channel
        check (status='archived' or online_visible or pos_visible)
    );
    create table public.product_variants (
      id uuid primary key, product_id uuid not null references public.products(id) on delete restrict,
      sku text not null, barcode text not null, stock integer not null,
      is_active boolean not null, price numeric
    );
    create table public.inventory_movements (
      id uuid primary key, product_id uuid not null references public.products(id) on delete restrict,
      quantity integer not null
    );
    create table public.pos_sale_items (
      id uuid primary key, product_id uuid not null references public.products(id) on delete restrict,
      total numeric not null
    );
    create table public.orders (id uuid primary key, status text not null);
    create table public.order_items (
      id uuid primary key, order_id uuid not null references public.orders(id),
      product_id uuid not null references public.products(id) on delete restrict
    );
    create table public.checkout_v2_reservations (
      id uuid primary key, status text not null, expires_at timestamptz not null
    );
    create table public.checkout_v2_items (
      id uuid primary key, reservation_id uuid not null references public.checkout_v2_reservations(id),
      product_id uuid not null references public.products(id) on delete restrict
    );
    create table public.pos_service_receptions (
      id uuid primary key, service_product_id uuid not null references public.products(id) on delete restrict,
      status text not null
    );
    create table public.product_images (
      id uuid primary key, product_id uuid not null references public.products(id) on delete restrict,
      image_url text not null
    );
    create table private.qa_retirement_events (
      id uuid primary key default gen_random_uuid(),
      product_id uuid not null unique references public.products(id) on delete restrict,
      actor_id uuid not null, reason text not null,
      previous_product jsonb not null, created_at timestamptz not null default now()
    );
    alter table public.products enable row level security;
    alter table public.product_variants enable row level security;
    alter table public.inventory_movements enable row level security;
    alter table public.pos_sale_items enable row level security;
    alter table public.orders enable row level security;
    alter table public.order_items enable row level security;
    alter table public.checkout_v2_reservations enable row level security;
    alter table public.checkout_v2_items enable row level security;
    alter table public.pos_service_receptions enable row level security;
    alter table public.product_images enable row level security;
    revoke all on all tables in schema public,private from public,anon,authenticated;
  `);
  await setup.query(proposedSQL);
});
beforeEach(async () => {
  await setup.query(`truncate
    private.qa_retirement_events,public.product_images,public.pos_service_receptions,
    public.checkout_v2_items,public.checkout_v2_reservations,
    public.order_items,public.orders,public.pos_sale_items,
    public.inventory_movements,public.product_variants,public.products,
    public.profiles cascade`);
  await setup.query('insert into public.profiles(id,role,is_active) values ($1,$2,true),($3,$4,true)',
    [ADMIN,'admin',OTHER,'sales']);
  await setup.query(`insert into public.products
    (id,sku,barcode,price,sale_price,cost,stock,status,online_visible,pos_visible,featured,new_arrival_enabled,updated_at)
    values ($1,'WED-0001','2000000000015',350,299,175,7,'active',true,true,true,true,$2)`,
  [PRODUCT,BASE_REVISION]);
  await setup.query(`insert into public.product_variants
    (id,product_id,sku,barcode,stock,is_active,price)
    values ($1,$2,'WED-0001-ROM','2000000000022',7,true,350)`,[VARIANT,PRODUCT]);
});
after(async () => { if(setup)await setup.end(); });

test('retirement preserves SKU, UPC, price, discount, cost, stock, variants and all historical links', async () => {
  await setup.query(`insert into public.inventory_movements values($1,$2,7)`,[REFERENCE,PRODUCT]);
  await setup.query(`insert into public.pos_sale_items values($1,$2,299)`,[REFERENCE,PRODUCT]);
  await setup.query(`insert into public.orders values($1,'completed')`,[REFERENCE]);
  await setup.query(`insert into public.order_items values($1,$2,$3)`,[REFERENCE,REFERENCE,PRODUCT]);
  await setup.query(`insert into public.checkout_v2_reservations values($1,'consumed',now()-interval '1 day')`,[REFERENCE]);
  await setup.query(`insert into public.checkout_v2_items values($1,$2,$3)`,[REFERENCE,REFERENCE,PRODUCT]);
  await setup.query(`insert into public.pos_service_receptions values($1,$2,'delivered')`,[REFERENCE,PRODUCT]);
  await setup.query(`insert into public.product_images values($1,$2,'https://fixture.test/photo.jpg')`,[REFERENCE,PRODUCT]);
  const previous=await snapshot();
  const admin=await connect();
  try {
    await login(admin);
    assert.deepEqual(await retire(admin),{status:'retired',product_id:PRODUCT});
    await admin.query('commit');
  } finally { await Promise.allSettled([admin.query('rollback'),admin.end()]); }
  const afterRetire=await snapshot();
  assert.equal(afterRetire.product.status,'archived');
  for(const key of ['online_visible','pos_visible','featured','new_arrival_enabled'])
    assert.equal(afterRetire.product[key],false);
  for(const key of ['sku','barcode','price','sale_price','cost','stock'])
    assert.deepEqual(afterRetire.product[key],previous.product[key]);
  assert.deepEqual(afterRetire.variants,previous.variants);
  assert.deepEqual(afterRetire.references,previous.references);
  assert.equal(afterRetire.events.length,1);
  assert.equal(afterRetire.events[0].actor_id,ADMIN);
  assert.equal(afterRetire.events[0].reason,REASON);
  assert.equal(afterRetire.events[0].previous_product.stock,7);
  assert.equal(afterRetire.events[0].previous_product.sku,'WED-0001');
  const visible=(await setup.query(`select count(*)::integer n from public.products
    where id=$1 and status='active' and (online_visible or pos_visible)`,[PRODUCT])).rows[0].n;
  assert.equal(visible,0);
});

test('retry is idempotent: no second update and no duplicate retirement event',async()=>{
  const admin=await connect();
  try{
    await login(admin);assert.equal((await retire(admin)).status,'retired');await admin.query('commit');
    const first=await snapshot();
    await login(admin);assert.equal((await retire(admin)).status,'already_archived');await admin.query('commit');
    const second=await snapshot();
    assert.deepEqual(second,first);
  }finally{await Promise.allSettled([admin.query('rollback'),admin.end()]);}
});

test('non-admin cannot retire and anonymous users cannot execute the private function',async()=>{
  const nonAdmin=await connect(),anon=await connect();
  try{
    await login(nonAdmin,OTHER);
    await assert.rejects(retire(nonAdmin),/ADMIN_REQUIRED/);
    await nonAdmin.query('rollback');
    await anon.query('begin');await anon.query('set local role anon');
    await assert.rejects(retire(anon),/permission denied/);
    await anon.query('rollback');
    const result=await snapshot();
    assert.equal(result.product.status,'active');assert.equal(result.events.length,0);
  }finally{
    await Promise.allSettled([nonAdmin.query('rollback'),anon.query('rollback')]);
    await Promise.allSettled([nonAdmin.end(),anon.end()]);
  }
});

test('stale snapshot and missing reason fail closed without changing product',async()=>{
  const admin=await connect();
  try{
    await login(admin);
    await assert.rejects(retire(admin,'2026-11-17T00:00:00.000Z'),/STALE_PRODUCT_SNAPSHOT/);
    await admin.query('rollback');
    await login(admin);
    await assert.rejects(retire(admin,BASE_REVISION,PRODUCT,'ok'),/RETIREMENT_REASON_REQUIRED/);
    await admin.query('rollback');
    const result=await snapshot();
    assert.equal(result.product.status,'active');assert.equal(result.events.length,0);
  }finally{await Promise.allSettled([admin.query('rollback'),admin.end()]);}
});

test('active checkout reservation blocks retirement while consumed reservation does not',async()=>{
  await setup.query(`insert into public.checkout_v2_reservations
    values($1,'active',now()+interval '1 hour')`,[REFERENCE]);
  await setup.query('insert into public.checkout_v2_items values($1,$2,$3)',[REFERENCE,REFERENCE,PRODUCT]);
  const admin=await connect();
  try{
    await login(admin);await assert.rejects(retire(admin),/ACTIVE_CHECKOUT_RESERVATION/);
    await admin.query('rollback');
    assert.equal((await snapshot()).product.status,'active');
    await setup.query(`update public.checkout_v2_reservations set status='consumed' where id=$1`,[REFERENCE]);
    await login(admin);assert.equal((await retire(admin)).status,'retired');await admin.query('commit');
    assert.equal((await snapshot()).references.checkout,1);
  }finally{await Promise.allSettled([admin.query('rollback'),admin.end()]);}
});

test('open workshop reception and processing web order block retirement',async()=>{
  await setup.query(`insert into public.pos_service_receptions values($1,$2,'received')`,[REFERENCE,PRODUCT]);
  const admin=await connect();
  try{
    await login(admin);await assert.rejects(retire(admin),/OPEN_SERVICE_RECEPTION/);
    await admin.query('rollback');
    await setup.query(`update public.pos_service_receptions set status='delivered' where id=$1`,[REFERENCE]);
    await setup.query(`insert into public.orders values($1,'processing')`,[REFERENCE]);
    await setup.query(`insert into public.order_items values($1,$2,$3)`,[REFERENCE,REFERENCE,PRODUCT]);
    await login(admin);await assert.rejects(retire(admin),/OPEN_ORDER/);
    await admin.query('rollback');
    const result=await snapshot();
    assert.equal(result.product.status,'active');assert.equal(result.events.length,0);
  }finally{await Promise.allSettled([admin.query('rollback'),admin.end()]);}
});

test('independent retirement requests serialize on product row lock',async()=>{
  const a=await connect(),b=await connect();
  try{
    await login(a);
    assert.equal((await retire(a)).status,'retired');
    await login(b);
    const pid=(await b.query('select pg_backend_pid() pid')).rows[0].pid;
    const waiting=retire(b);
    await waitForLock(pid);
    await a.query('commit');
    assert.equal((await waiting).status,'already_archived');
    await b.query('commit');
    const result=await snapshot();
    assert.equal(result.events.length,1);
    assert.equal(result.product.stock,7);
    assert.equal(result.variants[0].stock,7);
  }finally{
    await Promise.allSettled([a.query('rollback'),b.query('rollback')]);
    await Promise.allSettled([a.end(),b.end()]);
  }
});
