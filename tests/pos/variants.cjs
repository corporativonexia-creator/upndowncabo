const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const { Client } = require('pg');
const ts = require('typescript');
const catalogModule = { exports: {} };
new Function('exports', 'require', ts.transpileModule(fs.readFileSync('src/lib/pos/catalog.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(catalogModule.exports, require);
const { buildPosCatalog, barcodeMatches, readAllPages } = catalogModule.exports;
let db;
const livePg = !!process.env.POS_TEST_DATABASE_URL;
const user = '10000000-0000-0000-0000-000000000001';
const user2 = '10000000-0000-0000-0000-000000000002';
let employee, employee2, terminal, terminal2, shift, shift2;
async function q(sql, args = []) { return db.query(sql, args); }
async function one(sql, args) { return (await q(sql,args)).rows[0]; }
async function stock(id, variant = true) { return (await one(`select stock from ${variant?'product_variants':'products'} where id=$1`,[id])).stock; }
async function fixture(options = {}) {
  const id=randomUUID();
  await q(`insert into products(id,sku,name,slug,price,sale_price,stock,status,pos_visible,currency) values($1,$2,'Tenis Puma',$2,100,90,10,'active',$3,$4)`,[id,`QA-${id}`,options.visible!==false,options.currency||'MXN']);
  if(options.simple) return {id};
  const ids=[];
  for(const [i,size] of [26,27,28].entries()) {
    const v=randomUUID();ids.push(v);
    await q(`insert into product_variants(id,product_id,sku,title,attributes,price,stock,is_default) values($1,$2,$3,$4,$5,$6,$7,$8)`,[v,id,`SKU-${v}`,`Talla ${size}`,{talla:size,color:'Azul'},size===27?150:null,[2,5,3][i],i===0]);
  }
  return {id,ids};
}
const item=(f,index=1,quantity=1)=>({product_id:f.id,...(f.ids?{variant_id:f.ids[index]}:{}),quantity});
async function sale(items,amount,requestId=randomUUID(),connection=db,token='qa-terminal') {
  return (await connection.query(`select pos_create_sale($1,$2::jsonb,$3::jsonb,0,null) as result`,[token,JSON.stringify(items),JSON.stringify([{method:'cash',amount,metadata:{pos_request_id:requestId}}])])).rows[0].result;
}
async function voidSale(id) { return one(`select pos_void_sale('qa-terminal',$1,'Anulación controlada QA') as result`,[id]); }
async function refund(id) { return one(`select pos_refund_sale('qa-terminal',$1,'cash','Devolución controlada QA') as result`,[id]); }
async function auth(id=user) { await q(`select set_config('request.jwt.claim.sub',$1,false)`,[id]); }
before(async()=>{
  if(livePg) {
    // Explicit opt-in: never accept the application's production database URL.
    const target=new URL(process.env.POS_TEST_DATABASE_URL);
    if(!['127.0.0.1','localhost'].includes(target.hostname)||target.pathname!='/pos_variant_qa') throw new Error('Disposable localhost pos_variant_qa database required');
    db=new Client({connectionString:process.env.POS_TEST_DATABASE_URL});await db.connect();
  } else db=new PGlite();
  let schema=fs.readFileSync('tests/pos/schema.sql','utf8');
  // PGlite lacks pgcrypto; use PostgreSQL's built-in SHA-256 for this exact digest signature.
  // CI uses unmodified pgcrypto and independent PostgreSQL 17 connections.
  if(!livePg) schema=schema.replace('CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;', () => `
    CREATE FUNCTION extensions.digest(bytea,text) RETURNS bytea LANGUAGE sql IMMUTABLE AS $$ SELECT sha256($1) WHERE $2='sha256' $$;
    CREATE FUNCTION extensions.digest(text,text) RETURNS bytea LANGUAGE sql IMMUTABLE AS $$ SELECT extensions.digest(convert_to($1,'UTF8'),$2) $$;`);
  if(livePg) await q(schema); else await db.exec(schema);
  const migration=fs.readFileSync('supabase/migrations/20261104020000_pos_variant_sales.sql','utf8');
  if(livePg) await q(migration); else await db.exec(migration);
  employee=randomUUID();employee2=randomUUID();terminal=randomUUID();terminal2=randomUUID();shift=randomUUID();shift2=randomUUID();
  await q(`insert into pos_employees(id,auth_user_id,employee_number,full_name,role,status) values($1,$2,'QA01','QA Uno','pos_admin','active'),($3,$4,'QA02','QA Dos','pos_admin','active')`,[employee,user,employee2,user2]);
  await q(`insert into pos_terminals(id,name,status,device_token_hash) values($1,'QA Terminal','active',extensions.digest('qa-terminal','sha256')),($2,'QA Terminal 2','active',extensions.digest('qa-terminal-2','sha256'))`,[terminal,terminal2]);
  await q(`insert into pos_shifts(id,employee_id,terminal_id,status,opening_cash) values($1,$2,$3,'open',500),($4,$5,$6,'open',0)`,[shift,employee,terminal,shift2,employee2,terminal2]);
  await auth();
});
after(async()=>{if(db) await (livePg?db.end():db.close());});

test('catalog uses variant identifiers, attributes, photo, price, visibility and stock',()=>{
  const parent={id:'p',name:'Tenis',price:100,sale_price:90,stock:10,status:'active',pos_visible:true,cover_image_url:'https://example.com/parent.jpg',currency:'MXN'};
  const v={id:'v',product_id:'p',sku:'SKU-27',barcode:'2000000000374',title:'Talla 27',attributes:{talla:27,color:'Azul',image_url:'https://example.com/variant.jpg'},price:150,sale_price:null,stock:5,is_active:true};
  const rows=buildPosCatalog([parent],[v]);
  assert.equal(rows.length,1);assert.equal(rows[0].id,'v');assert.equal(rows[0].parent_id,'p');assert.equal(rows[0].price,150);assert.equal(rows[0].sale_price,null);assert.equal(rows[0].stock,5);assert.equal(rows[0].cover_image_url,v.attributes.image_url);assert.match(rows[0].name,/Azul/);assert.doesNotMatch(rows[0].name,/https/);
  assert.equal(barcodeMatches(rows,v.barcode)[0].variant_id,'v');
  assert.equal(barcodeMatches([...rows,...rows],v.barcode).length,2);
  assert.equal(buildPosCatalog([parent],[{...v,is_active:false}]).length,0);
  assert.equal(buildPosCatalog([{...parent,pos_visible:false}],[v]).length,0);
  assert.equal(buildPosCatalog([parent],[])[0].id,'p');
});
test('catalog paginates past 2000 rows and propagates errors',async()=>{
  const all=Array.from({length:2301},(_,id)=>({id}));
  assert.equal((await readAllPages(async(from,to)=>({data:all.slice(from,to+1),error:null}))).length,2301);
  await assert.rejects(readAllPages(async()=>({data:null,error:new Error('read denied')})),/read denied/);
});
test('standalone product sale, inventory movement and void',async()=>{
  const f=await fixture({simple:true});const r=await sale([item(f,0,2)],180);
  assert.equal(await stock(f.id,false),8);
  const line=await one('select * from pos_sale_items where sale_id=$1',[r.sale_id]);assert.equal(line.variant_id,null);assert.equal(line.quantity,2);
  await voidSale(r.sale_id);assert.equal(await stock(f.id,false),10);
});
test('two units of size 27: 5 -> 3; siblings unchanged; void restores exactly once',async()=>{
  const f=await fixture();const r=await sale([item(f,1,2)],300);
  assert.equal(await stock(f.ids[1]),3);assert.equal(await stock(f.ids[0]),2);assert.equal(await stock(f.ids[2]),3);assert.equal(await stock(f.id,false),8);
  const line=await one('select * from pos_sale_items where sale_id=$1',[r.sale_id]);assert.equal(Number(line.unit_price),150);assert.equal(line.variant_id,f.ids[1]);assert.equal(line.product_id,f.id);assert.match(line.product_name,/Talla 27/);assert.match(line.product_name,/Azul/);
  assert.equal(line.product_snapshot.sku,`SKU-${f.ids[1]}`);
  const movement=await one('select * from inventory_movements where pos_sale_id=$1',[r.sale_id]);assert.equal(movement.variant_id,f.ids[1]);assert.equal(movement.stock_before,5);assert.equal(movement.stock_after,3);
  const report=(await one(`select pos_get_current_shift_sales('qa-terminal') as result`)).result;
  assert.match(report.sales.find(s=>s.id===r.sale_id).items[0].product_name,/Talla 27/);
  await voidSale(r.sale_id);assert.equal(await stock(f.ids[1]),5);assert.equal(await stock(f.id,false),10);
  await assert.rejects(voidSale(r.sale_id),/SALE_NOT_REVERSIBLE/);assert.equal(await stock(f.ids[1]),5);
});
test('two variants of one parent, fallback price, full refund and duplicate rejection',async()=>{
  const f=await fixture();const r=await sale([item(f,0),item(f,2,2)],270);
  assert.equal(await stock(f.ids[0]),1);assert.equal(await stock(f.ids[2]),1);assert.equal(await stock(f.ids[1]),5);
  await refund(r.sale_id);assert.equal(await stock(f.ids[0]),2);assert.equal(await stock(f.ids[2]),3);assert.equal(await stock(f.id,false),10);
  await assert.rejects(refund(r.sale_id),/SALE_NOT_REFUNDABLE/);
  await assert.rejects(voidSale(r.sale_id),/SALE_NOT_REVERSIBLE/);
});
test('invalid stock, duplicate lines, parent aggregate and wrong variant fail atomically',async()=>{
  const f=await fixture(),other=await fixture();
  const before=await one('select count(*)::integer as n from pos_sales');
  await assert.rejects(sale([item(f,0,3)],270),/INSUFFICIENT_STOCK/);
  await assert.rejects(sale([item(f,1,3),item(f,1,3)],900),/DUPLICATE_SALE_ITEM/);
  await assert.rejects(sale([{product_id:f.id,quantity:1}],90),/VARIANT_REQUIRED/);
  await assert.rejects(sale([{product_id:f.id,variant_id:other.ids[1],quantity:1}],150),/VARIANT_NOT_AVAILABLE/);
  await q('update product_variants set stock=0 where id=$1',[f.ids[0]]);
  await assert.rejects(sale([item(f,0)],90),/INSUFFICIENT_STOCK/);
  assert.equal((await one('select count(*)::integer as n from pos_sales')).n,before.n);
  assert.equal(await stock(f.ids[1]),5);
});
test('canonical UUID duplicate lines cannot bypass validation',async()=>{
  const f=await fixture();const i=item(f,1,3);
  await assert.rejects(sale([i,{...i,product_id:f.id.toUpperCase(),variant_id:f.ids[1].toUpperCase()}],900),/DUPLICATE_SALE_ITEM/);
});
test('same request retry returns same sale without duplicate payments or stock deductions',async()=>{
  const f=await fixture(),request=randomUUID();const r=await sale([item(f)],150,request);const retry=await sale([item(f)],150,request);
  assert.equal(retry.sale_id,r.sale_id);assert.equal(retry.replayed,true);assert.equal(await stock(f.ids[1]),4);
  assert.equal((await one('select count(*)::integer as n from pos_payments where sale_id=$1',[r.sale_id])).n,1);
  await assert.rejects(sale([item(f,1,2)],300,request),/REQUEST_ID_CONFLICT/);
  await voidSale(r.sale_id);await assert.rejects(sale([item(f)],150,request),/REQUEST_ALREADY_REVERSED/);
});
test('visibility, currency, employee, terminal, role and payment validations survive',async()=>{
  const hidden=await fixture({visible:false}),usd=await fixture({currency:'USD'}),f=await fixture();
  await assert.rejects(sale([item(hidden)],150),/PRODUCT_NOT_AVAILABLE/);
  await assert.rejects(sale([item(usd)],150),/POS_CURRENCY_NOT_SUPPORTED/);
  await assert.rejects(sale([item(f)],1),/PAYMENT_TOTAL_MISMATCH/);
  await assert.rejects(sale([item(f)],150,randomUUID(),db,'wrong-token'),/TERMINAL_NOT_AUTHORIZED/);
  await auth(randomUUID());await assert.rejects(sale([item(f)],150),/POS_EMPLOYEE_NOT_FOUND/);await auth();
  await q("update pos_employees set status='suspended' where id=$1",[employee]);await assert.rejects(sale([item(f)],150),/POS_EMPLOYEE_NOT_ACTIVE/);await q("update pos_employees set status='active' where id=$1",[employee]);
  const r=await sale([item(f)],150);await q("update pos_employees set role='cashier' where id=$1",[employee]);await assert.rejects(voidSale(r.sale_id),/SUPERVISOR_REQUIRED/);await assert.rejects(refund(r.sale_id),/SUPERVISOR_REQUIRED/);await q("update pos_employees set role='pos_admin' where id=$1",[employee]);await voidSale(r.sale_id);
});
test('historical parent-only sale remains unchanged; refund restores original parent ledger',async()=>{
  const f=await fixture({simple:true});const r=await sale([item(f)],90);
  const before=await one('select * from pos_sale_items where sale_id=$1',[r.sale_id]);
  const v=randomUUID();await q("insert into product_variants(id,product_id,sku,stock,is_default) values($1,$2,$3,9,true)",[v,f.id,`SKU-${v}`]);
  await refund(r.sale_id);
  assert.deepEqual(await one('select * from pos_sale_items where sale_id=$1',[r.sale_id]),before);
  assert.equal(await stock(v),9);assert.equal(await stock(f.id,false),10);
});
test('simultaneous terminals cannot oversell; independent PostgreSQL sessions', {skip:!livePg},async()=>{
  const f=await fixture();
  const c=new Client({connectionString:process.env.POS_TEST_DATABASE_URL});await c.connect();
  try {
    await c.query("select set_config('request.jwt.claim.sub',$1,false)",[user2]);
    await q('begin');
    const first=await sale([item(f,1,4)],600);
    let settled=false;
    const second=sale([item(f,1,4)],600,randomUUID(),c,'qa-terminal-2').then(v=>{settled=true;return v},e=>{settled=true;throw e});
    const rejection=assert.rejects(second,/INSUFFICIENT_STOCK/);
    await new Promise(r=>setTimeout(r,200));assert.equal(settled,false,'Second terminal must wait for row lock');
    await q('commit');await rejection;assert.equal(await stock(f.ids[1]),1);
    assert.equal((await one('select count(*)::integer as n from pos_sale_items where variant_id=$1',[f.ids[1]])).n,1);
    await voidSale(first.sale_id);
  } finally { await q('rollback');await c.end(); }
});
test('movements balance and shift closure use net cash after void/refund',async()=>{
  assert.equal((await one('select count(*)::integer as n from inventory_movements where stock_after-stock_before<>quantity_change')).n,0);
  const report=(await one("select pos_get_current_shift_sales('qa-terminal') as result")).result;
  const expected=Number(report.expected_cash);
  const close=(await one("select pos_close_shift('qa-terminal',$1,'Cierre QA') as result",[expected])).result;
  assert.equal(Number(close.expected_cash),expected);assert.equal(Number(close.difference),0);
  const f=await fixture();await assert.rejects(sale([item(f)],150),/NO_OPEN_SHIFT/);
});
