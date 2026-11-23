// Fast isolated PostgreSQL smoke test; real sale engine is covered by pos22-transactions.cjs in CI.
'use strict';
const { test, before, after }=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const { randomUUID }=require('node:crypto');
const { PGlite }=require('@electric-sql/pglite');
let db, employee, terminal, shift, category;
const token='consignment-qa-device';
const ownerUser='50000000-0000-4000-8000-000000000001';
const q=(query,params=[])=>db.query(query,params);
const one=async(query,params=[]) => (await q(query,params)).rows[0];

before(async()=>{
  db=new PGlite();
  const schema=fs.readFileSync('tests/pos/schema.sql','utf8').replace(
    'CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;',
    () => `CREATE FUNCTION extensions.digest(bytea,text) RETURNS bytea LANGUAGE sql IMMUTABLE
      AS $$ SELECT sha256($1) WHERE $2='sha256' $$;
     CREATE FUNCTION extensions.digest(text,text) RETURNS bytea LANGUAGE sql IMMUTABLE
      AS $$ SELECT extensions.digest(convert_to($1,'UTF8'),$2) $$;`
  );
  await db.exec(schema);
  await db.exec(`create or replace function public.pos_reception_access(p_device_token text)
    returns jsonb language plpgsql security definer set search_path='' as $$
    declare e public.pos_employees%rowtype;t public.pos_terminals%rowtype;
    begin
      select * into e from public.pos_employees where auth_user_id=auth.uid() and status='active';
      if not found then raise exception 'POS_EMPLOYEE_NOT_ACTIVE'; end if;
      select * into t from public.pos_terminals where device_token_hash=extensions.digest(p_device_token,'sha256');
      if not found then raise exception 'TERMINAL_NOT_AUTHORIZED'; end if;
      return jsonb_build_object('employee_id',e.id,'terminal_id',t.id);
    end $$;`);
  await db.exec(fs.readFileSync('supabase/migrations/20261123005458_pos_consignment_lifecycle.sql','utf8'));
  employee=randomUUID();terminal=randomUUID();shift=randomUUID();category=randomUUID();
  await q('insert into categories(id,name) values($1,$2)',[category,'Golf usado']);
  await q("insert into pos_employees(id,auth_user_id,employee_number,full_name,role,status) values($1,$2,'CQA','Admin QA','pos_admin','active')",[employee,ownerUser]);
  await q("insert into pos_terminals(id,name,status,device_token_hash) values($1,'QA Terminal','active',extensions.digest($2,'sha256'))",[terminal,token]);
  await q("insert into pos_shifts(id,employee_id,terminal_id,status,opening_cash) values($1,$2,$3,'open',500)",[shift,employee,terminal]);
  await q("select set_config('request.jwt.claim.sub',$1,false)",[ownerUser]);
});
after(async()=>{if(db)await db.close()});

test('CG reception -> stocked physical product -> sale liability -> cash payout and reversal',async()=>{
  const req=randomUUID();
  const params=[token,req,'Propietaria de prueba','6241234567','Driver usado de prueba','Marcas leves','Funda',600,1000,null,2];
  const received=(await one('select pos_consignment_create($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) r',params)).r;
  assert.equal(received.status,'received');
  const published=(await one('select pos_consignment_publish($1,$2,$3,$4,$5,$6) r',
    [token,received.id,category,'Driver usado QA','Golf','Prueba'])).r;
  assert.equal(published.status,'on_sale');
  const product=await one('select sku,stock from products where id=$1',[published.product_id]);
  assert.equal(product.sku,'CG000001');assert.equal(product.stock,1);
  const variant=await one('select id from product_variants where product_id=$1',[published.product_id]);
  const sale=randomUUID();
  await q('insert into pos_sales(id,shift_id,employee_id,terminal_id,subtotal,total) values($1,$2,$3,$4,1000,1000)',
    [sale,shift,employee,terminal]);
  await q("update pos_consignments set expires_on=current_date-2 where id=$1",[received.id]);
  await assert.rejects(q(`insert into pos_sale_items(sale_id,product_id,variant_id,product_name,
      unit_price,quantity,line_subtotal,discount_amount,line_total)
    values($1,$2,$3,'Driver QA',1000,1,1000,0,1000)`,
    [sale,published.product_id,variant.id]),/CONSIGNMENT_EXPIRED/);
  await q('update pos_consignments set expires_on=null where id=$1',[received.id]);
  await assert.rejects(q(`insert into pos_sale_items(sale_id,product_id,variant_id,product_name,
      unit_price,quantity,line_subtotal,discount_amount,line_total)
    values($1,$2,$3,'Driver QA',1000,1,1000,100,900)`,
    [sale,published.product_id,variant.id]),/CONSIGNMENT_DISCOUNT_OR_PRICE_NOT_ALLOWED/);
  assert.equal((await one('select status from pos_consignments where id=$1',[received.id])).status,'on_sale');
  await q(`insert into pos_sale_items(sale_id,product_id,variant_id,product_name,
    unit_price,quantity,line_subtotal,discount_amount,line_total)
    values($1,$2,$3,'Driver QA',1000,1,1000,0,1000)`,
  [sale,published.product_id,variant.id]);
  assert.equal((await one('select status from pos_consignments where id=$1',[received.id])).status,'sold_pending');
  const payout=(await one('select pos_consignment_payout($1,$2,$3,$4,$5,$6) r',
    [token,received.id,randomUUID(),'cash',null,true])).r;
  assert.equal(Number(payout.amount),600);
  assert.equal((await one("select count(*)::int n from pos_cash_movements where movement_type='cash_out'")).n,1);
  await q("update pos_sales set status='refunded' where id=$1",[sale]);
  assert.equal((await one('select status from pos_consignments where id=$1',[received.id])).status,'refunded_paid');
});
