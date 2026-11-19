// Disposable PostgreSQL 17 integration tests for POS 2.2. NEVER point at production.
'use strict';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {randomUUID}=require('node:crypto');
const {Client}=require('pg');
const root=process.env.POS_TEST_DATABASE_URL;
if(!root)throw Error('POS_TEST_DATABASE_URL is required; do not run against Supabase');
const url=new URL(root);
if(!['127.0.0.1','localhost'].includes(url.hostname)||url.pathname!=='/pos_variant_qa')
  throw Error('Refusing anything other than localhost /pos_variant_qa disposable fixture');
const qaUrl=new URL(root);qaUrl.pathname='/pos22_qa';
const adminUrl=new URL(root);adminUrl.pathname='/postgres';
const admin=new Client({connectionString:adminUrl.toString()});
let db;
const user='20000000-0000-4000-8000-000000000001';
const cashierUser='20000000-0000-4000-8000-000000000002';
const token='qa-pos22-token';
let adminEmployee,cashierEmployee,terminal,shift,category;
const money=n=>Number(n);
const sql=async(q,values=[])=>db.query(q,values);
const one=async(q,values=[])=> (await sql(q,values)).rows[0];
const auth=async(id=user)=>sql("select set_config('request.jwt.claim.sub',$1,false)",[id]);
async function migrate(name){
  const source=fs.readFileSync('supabase/migrations/'+name+'.sql','utf8');
  try { await sql(source); } catch(err){ throw Error('Migration '+name+' failed: '+err.message,{cause:err}); }
}
async function fixtureProduct({price=100,stock=10,isService=false}={}){
 const id=randomUUID(),sku='QA22-'+id.slice(0,12);
 await sql('insert into products(id,category_id,name,slug,sku,price,stock,status,pos_visible,online_visible,is_service,currency) values($1,$2,$3,$4,$5,$6,$7,$8,true,false,$9,$10)',[id,category,'POS 2.2 QA',sku,sku,price,stock,'active',isService,'MXN']);
 return id;
}
const items=(id,extra={})=>[{product_id:id,quantity:1,...extra}];
async function sell(list,total,{mode='none',value=0,discount=0,payments=null,approval=null}={}){
 const content=structuredClone(list);
 if(mode!=='none'){content[0].global_promotion_mode=mode;content[0].global_promotion_value=value;}
 const tender=payments??[{method:'cash',amount:total,metadata:{pos_request_id:randomUUID()}}];
 return (await one('select public.pos_create_sale_v22($1,$2::jsonb,$3::jsonb,$4,NULL,$5) result',[token,JSON.stringify(content),JSON.stringify(tender),discount,approval])).result;
}
before(async()=>{
 await admin.connect();
 // This database is throwaway and is distinct from POS variant safety's database.
 await admin.query('DROP DATABASE IF EXISTS pos22_qa WITH (FORCE)');
 await admin.query('CREATE DATABASE pos22_qa');
 db=new Client({connectionString:qaUrl.toString()});await db.connect();
 let schema=fs.readFileSync('tests/pos/schema.sql','utf8');
 // POS variant tests have already created the cluster roles in this workflow.
 // Ensure they exist when this test is invoked on its own.
 for(const role of ['anon','authenticated','service_role']){
   try{await admin.query('CREATE ROLE '+role)}catch(error){if(error.code!=='42710')throw error}
 }
 schema=schema.replace('CREATE ROLE anon;','').replace('CREATE ROLE authenticated;','');
 try { await sql(schema); } catch(error){
   const pos=Number(error.position||0);
   throw Error('POS fixture schema failed near: '+schema.slice(Math.max(0,pos-110),pos+110)+'; '+error.message,{cause:error});
 }
 await migrate('20261104020000_pos_variant_sales');
 // Disposable checkout V2 tables only; no production copies, orders or live sessions.
 await sql(`create table public.checkout_v2_reservations(
   id uuid primary key default gen_random_uuid(),
   reservation_token uuid not null unique default gen_random_uuid(),
   status text not null default 'active',
   stripe_checkout_session_id text,
   seller_ref text,expires_at timestamptz not null,
   released_at timestamptz,consumed_at timestamptz,release_reason text,
   metadata jsonb not null default '{}'::jsonb,created_at timestamptz not null default now()
 );
 create table public.checkout_v2_items(
   id uuid primary key default gen_random_uuid(),
   reservation_id uuid not null references public.checkout_v2_reservations(id),
   product_id uuid not null references public.products(id),
   variant_id uuid references public.product_variants(id),
   sku text,product_name text not null,quantity integer not null,
   currency text not null,unit_price numeric(12,2) not null,
   stock_before integer not null,stock_after integer not null,image_url text
 )`);
 // The legacy V1 reservation and release path is also tested against the real
 // inventory movement constraint, not a permissive substitute.
 await sql(`create table public.checkout_inventory_reservations(
  id uuid primary key default gen_random_uuid(),
  reservation_token uuid not null unique default gen_random_uuid(),
  status text not null default 'active',
  stripe_checkout_session_id text,seller_ref text,expires_at timestamptz not null,
  consumed_at timestamptz,released_at timestamptz,release_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
 );
 create table public.checkout_inventory_reservation_items(
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.checkout_inventory_reservations(id),
  product_id uuid not null references public.products(id),
  sku text,product_name text not null,quantity integer not null,
  currency text not null default 'MXN',unit_price numeric(12,2) not null,
  stock_before integer not null,stock_after integer not null,
  created_at timestamptz not null default now()
 )`);
 // Minimal fixture-only support missing from the 2026-11-04 schema snapshot.
 await sql("alter table public.categories add column if not exists is_active boolean not null default true");
 await sql(`create or replace function public.is_admin() returns boolean language sql stable
  as $$select exists(select 1 from public.pos_employees where auth_user_id=auth.uid() and role='pos_admin' and status='active')$$`);
 await sql(`create or replace function public.qa22_product_identifiers() returns trigger language plpgsql as $$
 begin if new.sku is null then new.sku='QA-SVC-'||substr(replace(new.id::text,'-',''),1,12);end if;
 if new.barcode is null then new.barcode='2000000000008';end if;return new;end $$`);
 await sql('create trigger qa22_product_identifiers before insert on public.products for each row execute function public.qa22_product_identifiers()');
 for(const migration of [
  '20261109020000_pos21_promotions_mixed_approval',
  '20261109021000_pos21_receipts_promotion_metadata',
  '20261109021500_pos21_approval_ambiguous_item_fix',
  '20261109022000_pos21_extend_sale_event_types',
  '20261109030000_pos21_split_refunds_and_cash_closing',
  '20261112200000_pos22_services_scheduled_promotions',
  '20261112201000_pos22_sale_engine',
  '20261112202000_pos22_approval_and_service_reversals',
  '20261113093000_pos22_storefront_campaign_checkout'
 ])await migrate(migration);
 // The disposable fixture predates real auth.sessions; only local tests use this stub.
 await sql("create or replace function public.pos_is_session_active() returns boolean language sql stable security definer set search_path='' as 'select auth.uid() is not null'");
 await migrate('20261114215000_pos_service_receptions');
 await migrate('20261119214913_pos22_allow_service_with_synthetic_variants');
 adminEmployee=randomUUID();cashierEmployee=randomUUID();terminal=randomUUID();shift=randomUUID();category=randomUUID();
 await sql('insert into categories(id,name,is_active) values($1,$2,true)',[category,'QA categoría']);
 await sql('insert into pos_employees(id,auth_user_id,employee_number,full_name,role,status) values($1,$2,$3,$4,$5,$6),($7,$8,$9,$10,$11,$12)',
 [adminEmployee,user,'QA22A','QA Administrator','pos_admin','active',cashierEmployee,cashierUser,'QA22C','QA Cashier','cashier','active']);
 await sql("insert into pos_terminals(id,name,status,device_token_hash) values($1,'QA POS22','active',extensions.digest('qa-pos22-token','sha256'))",[terminal]);
 await sql("insert into pos_shifts(id,employee_id,terminal_id,status,opening_cash) values($1,$2,$3,'open',500)",[shift,adminEmployee,terminal]);
 await auth();
});
after(async()=>{if(db)await db.end();await admin.query('DROP DATABASE IF EXISTS pos22_qa WITH (FORCE)');await admin.end()});
test('migrations installed in strict order, functions and RLS are present',async()=>{
 assert.equal((await one("select count(*)::int n from pg_proc where pronamespace='public'::regnamespace and proname in ('pos_create_sale_v22','pos22_match_promotion','pos22_issue_promotion_approval','pos_refund_sale_v21')")).n,4);
 assert.equal((await one("select relrowsecurity enabled from pg_class where oid='public.pos22_promotions'::regclass")).enabled,true);
 assert.ok((await one("select count(*)::int n from pg_policies where tablename='pos22_promotions'")).n>=4);
});
test('anonymous shoppers can read active campaigns but cannot alter or reserve stock',async()=>{
 const result=await one(`select
   has_function_privilege('anon','public.pos22_public_active_promotions()','EXECUTE') as public_campaign,
   has_table_privilege('anon','public.pos22_promotions','SELECT') as direct_campaign_table,
   has_function_privilege('anon','public.reserve_checkout_inventory(jsonb,text,integer)','EXECUTE') as reserve_v1,
   has_function_privilege('anon','public.reserve_checkout_inventory_v2(jsonb,text,integer)','EXECUTE') as reserve_v2,
   has_function_privilege('anon','public.release_checkout_reservation(uuid,text)','EXECUTE') as release_v1,
   has_function_privilege('service_role','public.reserve_checkout_inventory(jsonb,text,integer)','EXECUTE') as service_v1,
   has_function_privilege('service_role','public.reserve_checkout_inventory_v2(jsonb,text,integer)','EXECUTE') as service_v2`);
 assert.equal(result.public_campaign,true);
 assert.equal(result.direct_campaign_table,false);
 for(const field of ['reserve_v1','reserve_v2','release_v1'])assert.equal(result[field],false,field+' should never be public');
 assert.equal(result.service_v1,true);
 assert.equal(result.service_v2,true);
});
test('public RPC exposes only active campaign targets in Cabo timezone',async()=>{
 const id=await fixtureProduct({price:1000});
 const sku=(await one('select sku from products where id=$1',[id])).sku;
 await sql("insert into pos22_promotions(title,target_type,target_value,discount_percent,starts_on,ends_on,enabled) values('QA VISIBLE','sku',$1,20,current_date-1,current_date+1,true),('QA PRIVATE','sku',$1,70,current_date-7,current_date-2,true),('QA DISABLED','sku',$1,75,current_date-1,current_date+1,false)",[sku]);
 const publicCampaigns=(await one('select public.pos22_public_active_promotions() result')).result;
 assert.ok(publicCampaigns.some(p=>p.title==='QA VISIBLE'));
 assert.ok(!publicCampaigns.some(p=>p.title==='QA PRIVATE'||p.title==='QA DISABLED'));
 await sql("delete from pos22_promotions where title like 'QA VISIBLE' or title like 'QA PRIVATE' or title like 'QA DISABLED'");
});
test('legacy checkout V1 reserves and releases at the campaign price without invalid movement types',async()=>{
 const id=await fixtureProduct({price:1000,stock:4});
 await sql('update products set online_visible=true,sale_price=900 where id=$1',[id]);
 await sql("insert into pos22_promotions(title,target_type,target_value,discount_percent,starts_on,ends_on,enabled) values('QA V1 CATEGORY','category',$1,20,current_date-1,current_date+1,true)",[category]);
 const reserve=(await one('select public.reserve_checkout_inventory($1::jsonb,null,30) result',[JSON.stringify([{id,quantity:1,price:1}])])).result;
 assert.equal(money(reserve.items[0].unit_price),720);
 assert.equal((await one('select stock from products where id=$1',[id])).stock,3);
 const reversed=(await one('select public.release_checkout_reservation($1,$2) result',[reserve.reservation_token,'QA cancelled session'])).result;
 assert.equal(reversed.released_units,1);
 assert.equal((await one('select stock from products where id=$1',[id])).stock,4);
 assert.equal((await one("select count(*)::int n from inventory_movements where product_id=$1 and movement_type='adjustment'",[id])).n,2);
 await sql('update products set sale_price=1200 where id=$1',[id]);
 const standard=(await one('select public.reserve_checkout_inventory($1::jsonb,null,30) result',[JSON.stringify([{id,quantity:1}])])).result;
 assert.equal(money(standard.items[0].unit_price),800);
 await one('select public.release_checkout_reservation($1,$2) result',[standard.reservation_token,'QA reversed invalid special']);
 assert.equal((await one('select stock from products where id=$1',[id])).stock,4);
 await sql("update pos22_promotions set enabled=false where title='QA V1 CATEGORY'");
});
test('checkout V2 reserves at special-price minus category campaign, never trusts browser price',async()=>{
 const id=await fixtureProduct({price:1000,stock:5});
 // Online checkout must not reserve a POS-only product.
 await sql('update products set sale_price=900,online_visible=true where id=$1',[id]);
 await sql("insert into pos22_promotions(title,target_type,target_value,discount_percent,starts_on,ends_on,enabled) values('QA ONLINE CATEGORY','category',$1,20,current_date-1,current_date+1,true)",[category]);
 const reserved=(await one('select public.reserve_checkout_inventory_v2($1::jsonb,null,30) result',[JSON.stringify([{id,quantity:1,price:1}])])).result;
 assert.equal(money(reserved.items[0].unit_price),720);
 assert.equal(money((await one('select unit_price from checkout_v2_items where reservation_id=$1',[reserved.reservation_id])).unit_price),720);
 assert.equal((await one('select stock from products where id=$1',[id])).stock,4);
 await sql("update pos22_promotions set enabled=false where title='QA ONLINE CATEGORY'");
});
test('checkout V2 applies a SKU campaign on the exact variant offer',async()=>{
 const id=await fixtureProduct({price:1000,stock:2});
 await sql('update products set online_visible=true where id=$1',[id]);
 const variantId=randomUUID(),variantSku='QA22-V-'+variantId.slice(0,10);
 await sql("insert into product_variants(id,product_id,sku,title,attributes,price,sale_price,stock,is_default) values($1,$2,$3,'Talla 27','{}'::jsonb,1000,900,2,true)",[variantId,id,variantSku]);
 await sql("insert into pos22_promotions(title,target_type,target_value,discount_percent,starts_on,ends_on,enabled) values('QA V2 VARIANT','sku',$1,20,current_date-1,current_date+1,true)",[variantSku]);
 const reserve=(await one('select public.reserve_checkout_inventory_v2($1::jsonb,null,30) result',[JSON.stringify([{id:'variant:'+variantId,quantity:1}])])).result;
 assert.equal(money(reserve.items[0].unit_price),720);
 assert.equal(reserve.items[0].variant_id,variantId);
 assert.equal((await one('select stock from product_variants where id=$1',[variantId])).stock,1);
 assert.equal((await one('select count(*)::int n from inventory_movements where variant_id=$1 and quantity_change=-1',[variantId])).n,1);
 await sql("update pos22_promotions set enabled=false where title='QA V2 VARIANT'");
});
test('automatic category campaign and manual item promotion stack without double stock deduction',async()=>{
 const id=await fixtureProduct({price:1000,stock:6});
 await sql("insert into pos22_promotions(title,target_type,target_value,discount_percent,starts_on,ends_on,enabled) values('QA CATEGORY','category',$1,10,current_date-1,current_date+1,true)",[category]);
 const result=await sell(items(id,{promotion_mode:'amount',promotion_value:50}),850);
 assert.equal(money(result.subtotal),1000);assert.equal(money(result.discount_amount),150);assert.equal(money(result.total),850);
 assert.equal(money((await one('select stock from products where id=$1',[id])).stock),5);
 assert.equal((await one("select count(*)::int n from inventory_movements where pos_sale_id=$1 and movement_type='sale'",[result.sale_id])).n,1);
 await sql("update pos22_promotions set enabled=false where title='QA CATEGORY'");
});
test('global percentage plus per-item discount use original subtotal and exact tender',async()=>{
 const id=await fixtureProduct({price:5000});
 const result=await sell(items(id,{promotion_mode:'amount',promotion_value:200}),3800,{mode:'percent',value:20,discount:1000});
 assert.equal(money(result.total),3800);
 assert.equal(money((await one('select discount_amount from pos_sales where id=$1',[result.sale_id])).discount_amount),1200);
 await assert.rejects(sell(items(id),500,{mode:'percent',value:20,discount:5}),/GLOBAL_DISCOUNT_MISMATCH/);
});
test('final-price override is exact after line discounts, not deducted twice',async()=>{
 const id=await fixtureProduct({price:5000});
 const lines=items(id,{promotion_mode:'amount',promotion_value:200});
 const authorizedLines=structuredClone(lines);
 authorizedLines[0].global_promotion_mode='final';authorizedLines[0].global_promotion_value=3500;
 const approval=(await one('select public.pos22_issue_promotion_approval($1,$2::jsonb,$3) token',
  [adminEmployee,JSON.stringify(authorizedLines),'QA authorize final-price discount'])).token;
 const result=await sell(lines,3500,{mode:'final',value:3500,discount:1300,approval});
 assert.equal(money(result.total),3500);
 assert.equal((await one('select consumed_sale_id from pos21_promotion_approvals where token=$1',[approval])).consumed_sale_id,result.sale_id);
 await assert.rejects(sell(items(id,{promotion_mode:'amount',promotion_value:200}),4000,{mode:'final',value:5000,discount:0}),/INVALID_GLOBAL_DISCOUNT/);
});
test('free-price service sale, void and refund do not mutate physical inventory',async()=>{
 const service=(await one("select public.pos22_admin_create_service('QA Servicio puntual',$1) result",[category])).result;
 const id=service.id;
 const first=await sell(items(id,{service_unit_price:380}),380);
 assert.equal(money(first.total),380);
 assert.equal((await one('select stock from products where id=$1',[id])).stock,0);
 assert.equal((await one('select count(*)::int n from inventory_movements where pos_sale_id=$1',[first.sale_id])).n,0);
 await one("select pos_void_sale($1,$2,'QA void service')",[token,first.sale_id]);
 assert.equal((await one('select stock from products where id=$1',[id])).stock,0);
 const second=await sell(items(id,{service_unit_price:275}),275);
 await one("select pos_refund_sale($1,$2,'cash','QA refund service')",[token,second.sale_id]);
 assert.equal((await one('select count(*)::int n from inventory_movements where pos_sale_id=$1',[second.sale_id])).n,0);
 assert.equal((await one('select stock from products where id=$1',[id])).stock,0);
});
test('synthetic service variants never block a service sale or weaken physical variant protection',async()=>{
 const service=(await one("select public.pos22_admin_create_service('QA Servicio con Única',$1) result",[category])).result;
 await sql("insert into product_variants(id,product_id,sku,title,attributes,price,stock,is_default) values($1,$2,$3,'Única','{}'::jsonb,0,0,true)",
  [randomUUID(),service.id,'QA22-SVC-'+randomUUID().slice(0,8)]);
 const sold=await sell(items(service.id,{service_unit_price:385}),385);
 assert.equal(money(sold.total),385);
 assert.equal((await one('select count(*)::int n from inventory_movements where pos_sale_id=$1',[sold.sale_id])).n,0);
 const physical=await fixtureProduct({price:120,stock:1});
 await sql("insert into product_variants(id,product_id,sku,title,attributes,price,stock,is_default) values($1,$2,$3,'Única','{}'::jsonb,120,1,true)",
  [randomUUID(),physical,'QA22-PHY-'+randomUUID().slice(0,8)]);
 await assert.rejects(sell(items(physical),120),/VARIANT_REQUIRED/);
 await assert.rejects(sell(items(service.id,{variant_id:randomUUID(),service_unit_price:385}),385),/VARIANT_NOT_AVAILABLE|SERVICE_VARIANT_NOT_ALLOWED/);
});
test('invalid price override, underpayment and lack of stock are atomic',async()=>{
 const id=await fixtureProduct({price:100,stock:1});
 await assert.rejects(sell(items(id,{service_unit_price:1}),1),/PRICE_OVERRIDE_NOT_ALLOWED/);
 await assert.rejects(sell(items(id),99),/PAYMENT_TOTAL_MISMATCH/);
 await assert.rejects(sell([{product_id:id,quantity:2}],200),/INSUFFICIENT_STOCK/);
 assert.equal((await one('select stock from products where id=$1',[id])).stock,1);
});
test('mixed payments refund exactly original allocations, restoring stock once',async()=>{
 const id=await fixtureProduct({price:250,stock:3});
 const tender=[
  {method:'cash',amount:100,metadata:{pos_request_id:randomUUID()}},
  {method:'card_terminal',amount:150,reference:'QA22-TERMINAL'}
 ];
 const s=await sell(items(id),250,{payments:tender});
 assert.equal(money(s.total),250);
 assert.equal((await one('select count(*)::int n from pos_payments where sale_id=$1',[s.sale_id])).n,2);
 assert.equal((await one('select stock from products where id=$1',[id])).stock,2);
 const allocations=[{method:'cash',amount:100},{method:'card_terminal',amount:150,reference:'QA22-REFUND'}];
 await assert.rejects(one('select public.pos_refund_sale_v21($1,$2,$3::jsonb,$4) result',
   [token,s.sale_id,JSON.stringify([{method:'cash',amount:150},{method:'card_terminal',amount:100}]),'QA invalid split']),/REFUND_ORIGINAL_PAYMENT_MISMATCH/);
 assert.equal((await one('select stock from products where id=$1',[id])).stock,2);
 const refunded=(await one('select public.pos_refund_sale_v21($1,$2,$3::jsonb,$4) result',
   [token,s.sale_id,JSON.stringify(allocations),'QA controlled mixed refund'])).result;
 assert.equal(money(refunded.amount),250);
 assert.equal((await one('select stock from products where id=$1',[id])).stock,3);
 assert.equal((await one('select count(*)::int n from pos21_refund_allocations where refund_id=$1',[refunded.refund_id])).n,2);
 await assert.rejects(one('select public.pos_refund_sale_v21($1,$2,$3::jsonb,$4) result',
   [token,s.sale_id,JSON.stringify(allocations),'QA repeated refund']),/SALE_NOT_REFUNDABLE/);
 assert.equal((await one('select stock from products where id=$1',[id])).stock,3);
});
test('higher SKU campaign takes precedence over category campaign and respects date window',async()=>{
 const id=await fixtureProduct({price:1000,stock:4});
 const sku=(await one('select sku from products where id=$1',[id])).sku;
 await sql("insert into pos22_promotions(title,target_type,target_value,discount_percent,starts_on,ends_on,enabled) values('QA CATEGORY PRIORITY','category',$1,10,current_date-1,current_date+1,true),('QA SKU PRIORITY','sku',$2,15,current_date-1,current_date+1,true),('QA EXPIRED','sku',$2,75,current_date-20,current_date-10,true)",[category,sku]);
 const s=await sell(items(id),850);
 assert.equal(money(s.total),850);
 const line=await one('select discount_amount,product_snapshot from pos_sale_items where sale_id=$1',[s.sale_id]);
 assert.equal(money(line.discount_amount),150);
 assert.equal(money(line.product_snapshot.automatic_discount),150);
 assert.equal(line.product_snapshot.automatic_promotion_title,'QA SKU PRIORITY');
 await sql("update pos22_promotions set enabled=false where title like 'QA % PRIORITY' or title='QA EXPIRED'");
});
test('cashier manual discount needs valid administrative approval',async()=>{
 const id=await fixtureProduct({price:100});
 await sql("update pos_shifts set employee_id=$1 where id=$2",[cashierEmployee,shift]);await auth(cashierUser);
 const data=items(id,{promotion_mode:'percent',promotion_value:20});
 await assert.rejects(sell(data,80),/PROMOTION_ADMIN_APPROVAL_REQUIRED/);
 await auth(user);
 const approval=(await one('select public.pos22_issue_promotion_approval($1,$2::jsonb,$3) token',[cashierEmployee,JSON.stringify(data),'QA approved exception'])).token;
 await auth(cashierUser);
 const result=await sell(data,80,{approval});
 assert.equal(money(result.total),80);
 assert.equal((await one('select consumed_sale_id from pos21_promotion_approvals where token=$1',[approval])).consumed_sale_id,result.sale_id);
 await auth(user);await sql("update pos_shifts set employee_id=$1 where id=$2",[adminEmployee,shift]);
});

test('POS Taller: cashier can receive without a shift, repeat safely, and never move stock or sales',async()=>{
 const service=(await one("select public.pos22_admin_create_service('QA Taller grip',$1) result",[category])).result;
 await sql("update pos_shifts set status='closed',closed_at=now() where id=$1",[shift]);
 await auth(cashierUser);
 const request=randomUUID();
 const params=[token,request,'Cliente QA','6241234567','Driver TaylorMade QA',service.id,
   'Cambiar grip y revisar ajuste','Grips con desgaste, sin roturas','Funda original'];
 const before=await one("select (select count(*)::int from pos_sales) sales,(select count(*)::int from inventory_movements) moves");
 const saved=(await one('select public.pos_reception_create($1,$2,$3,$4,$5,$6,$7,$8,$9) result',params)).result;
 assert.ok(saved.receipt_number>=1);assert.equal(saved.service_name,'QA Taller grip');
 assert.equal(saved.employee_id,cashierEmployee);
 const same=(await one('select public.pos_reception_create($1,$2,$3,$4,$5,$6,$7,$8,$9) result',params)).result;
 assert.equal(same.id,saved.id);
 assert.equal((await one('select count(*)::int n from public.pos_service_receptions')).n,1);
 await assert.rejects(one('select public.pos_reception_create($1,$2,$3,$4,$5,$6,$7,$8,$9) result',
  [...params.slice(0,6),'Trabajo distinto',...params.slice(7)]),/RECEPTION_REQUEST_CONFLICT/);
 const list=(await one("select public.pos_reception_recent($1,$2) result",[token,'SR-'+String(saved.receipt_number).padStart(6,'0')])).result;
 assert.equal(list.length,1);assert.equal(list[0].id,saved.id);
 assert.equal(list[0].condition_notes,'Grips con desgaste, sin roturas');
 const after=await one("select (select count(*)::int from pos_sales) sales,(select count(*)::int from inventory_movements) moves");
 assert.deepEqual(after,before);
 assert.equal((await one("select count(*)::int n from pos_shifts where status='open'")).n,0);
 await auth(user);
 await sql("update pos_shifts set status='open',closed_at=null where id=$1",[shift]);
});

test('POS Taller: ready -> priced checkout -> delivered is atomic and can be charged only once',async()=>{
 const service=(await one("select public.pos22_admin_create_service('QA Taller entrega',$1) result",[category])).result;
 await sql("insert into product_variants(id,product_id,sku,title,attributes,price,stock,is_default) values($1,$2,$3,'Única','{}'::jsonb,0,0,true)",
  [randomUUID(),service.id,'QA22-REC-'+randomUUID().slice(0,8)]);
 const receive=async()=> (await one(
  'select public.pos_reception_create($1,$2,$3,$4,$5,$6,$7,$8,$9) result',
  [token,randomUUID(),'Cliente Taller QA','6241234567','Putter en servicio QA',service.id,
   'Cambio de grip de prueba','Desgaste superficial observado','Funda original']
 )).result;
 const r=await receive();
 assert.equal(r.status,'received');
 const saleCount=(await one('select count(*)::int n from pos_sales')).n;
 const movements=(await one('select count(*)::int n from inventory_movements')).n;
 const sellLinked=async(price,payment,requestId=randomUUID())=>one(
  'select public.pos_reception_checkout($1,$2,$3::jsonb,$4::jsonb) result',
  [token,r.id,JSON.stringify(items(service.id,{service_unit_price:price})),
   JSON.stringify([{method:'cash',amount:payment,metadata:{pos_request_id:requestId}}])]
 );
 await assert.rejects(sellLinked(450,450),/RECEPTION_NOT_READY/);
 assert.equal((await one('select count(*)::int n from pos_sales')).n,saleCount);
 const ready=(await one('select public.pos_reception_set_ready($1,$2) result',[token,r.id])).result;
 assert.equal(ready.status,'ready');
 const again=(await one('select public.pos_reception_set_ready($1,$2) result',[token,r.id])).result;
 assert.equal(again.ready_at,ready.ready_at);
 await assert.rejects(sellLinked(0,0),/RECEPTION_SERVICE_PRICE_OR_QUANTITY_INVALID/);
 await assert.rejects(sellLinked(450,100),/PAYMENT_TOTAL_MISMATCH/);
 assert.equal((await one('select status from pos_service_receptions where id=$1',[r.id])).status,'ready');
 assert.equal((await one('select count(*)::int n from pos_sales')).n,saleCount);
 const paymentRequest=randomUUID();
 const result=(await sellLinked(450,450,paymentRequest)).result;
 assert.equal(result.service_reception_status,'delivered');
 const replay=(await sellLinked(450,450,paymentRequest)).result;
 assert.equal(replay.sale_id,result.sale_id);
 assert.equal(replay.replayed,true);
 assert.ok(result.sale_id);
 const linked=await one('select status,checkout_sale_id,delivered_at from pos_service_receptions where id=$1',[r.id]);
 assert.equal(linked.status,'delivered');
 assert.equal(linked.checkout_sale_id,result.sale_id);
 assert.ok(linked.delivered_at);
 assert.equal((await one('select count(*)::int n from pos_sales')).n,saleCount+1);
 await assert.rejects(sellLinked(450,450),/RECEPTION_ALREADY_DELIVERED/);
 await assert.rejects(one('select public.pos_reception_set_ready($1,$2) result',[token,r.id]),/RECEPTION_ALREADY_DELIVERED/);
 assert.equal((await one('select count(*)::int n from pos_sales')).n,saleCount+1);
 assert.equal((await one('select count(*)::int n from inventory_movements')).n,movements);
 assert.equal((await one('select stock from products where id=$1',[service.id])).stock,0);
});

test('POS Taller: no anonymous access, unapproved terminal or inactive service',async()=>{
 const flags=await one(`select
  has_function_privilege('anon','public.pos_reception_create(text,uuid,text,text,text,uuid,text,text,text)','EXECUTE') anon_create,
  has_function_privilege('anon','public.pos_reception_recent(text,text)','EXECUTE') anon_list,
  has_function_privilege('anon','public.pos_reception_set_ready(text,uuid)','EXECUTE') anon_ready,
  has_function_privilege('anon','public.pos_reception_checkout(text,uuid,jsonb,jsonb,numeric,text,uuid)','EXECUTE') anon_checkout,
  has_table_privilege('authenticated','public.pos_service_receptions','SELECT') auth_table_select,
  (select relrowsecurity from pg_class where oid='public.pos_service_receptions'::regclass) rls`);
 assert.equal(flags.anon_create,false);assert.equal(flags.anon_list,false);
 assert.equal(flags.anon_ready,false);assert.equal(flags.anon_checkout,false);
 assert.equal(flags.auth_table_select,false);assert.equal(flags.rls,true);
 await assert.rejects(one("select public.pos_reception_recent('unknown-device','') result"),/TERMINAL_NOT_AUTHORIZED/);
 await auth(cashierUser);
 await assert.rejects(one("select public.pos_reception_create($1,$2,$3,$4,$5,$6,$7,$8,$9) result",
   [token,randomUUID(),'Cliente QA','6241234567','Putter QA',randomUUID(),
    'Reparar grip de prueba','Rayas leves','Ninguno']),/SERVICE_NOT_AVAILABLE/);
 await auth(user);
});

test('POS Taller: each thermal copy includes its cut in the same RAW job, without opening the drawer',()=>{
 const bridge=fs.readFileSync('tools/pos-print-bridge/UpNDownPrintBridge.ps1','utf8');
 const start=bridge.indexOf("if($c.Request.Url.AbsolutePath -eq '/print-reception')");
 const end=bridge.indexOf('};$sale=$p.sale;',start);
 assert.ok(start>=0&&end>start);
 const route=bridge.slice(start,end);
 assert.match(route,/SendRaw \(BuildReceptionTicket \$reception 'CLIENTE'\)/);
 assert.match(route,/SendRaw \(BuildReceptionTicket \$reception 'TALLER'\)/);
 assert.equal((route.match(/SendRaw \(BuildReceptionTicket/g)||[]).length,2);
 assert.doesNotMatch(route,/SendRaw \$CUT/);
 assert.doesNotMatch(route,/\$DRAWER/);
 assert.match(route,/"drawer":0/);
 const ticket=bridge.slice(bridge.indexOf('function BuildReceptionTicket('),bridge.indexOf('function SendRaw('));
 assert.match(ticket,/AddBytes \$b \(BuildReceptionBody \$r \$copy\)/);
 assert.match(ticket,/AddBytes \$b \$CUT/);
 assert.match(ticket,/return \$b\.ToArray\(\)/);
 assert.match(bridge,/AddReceptionBarcode \$b \$folio/);
});
