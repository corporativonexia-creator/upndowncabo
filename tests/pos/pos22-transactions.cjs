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
 for(const role of ['anon','authenticated']){
   try{await admin.query('CREATE ROLE '+role)}catch(error){if(error.code!=='42710')throw error}
 }
 schema=schema.replace('CREATE ROLE anon;','').replace('CREATE ROLE authenticated;','');
 try { await sql(schema); } catch(error){
   const pos=Number(error.position||0);
   throw Error('POS fixture schema failed near: '+schema.slice(Math.max(0,pos-110),pos+110)+'; '+error.message,{cause:error});
 }
 await migrate('20261104020000_pos_variant_sales');
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
  '20261112202000_pos22_approval_and_service_reversals'
 ])await migrate(migration);
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
