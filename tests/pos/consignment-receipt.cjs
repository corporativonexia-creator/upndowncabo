'use strict';
const { test }=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const { default: Code39Reader }=require('@zxing/library/cjs/core/oned/Code39Reader');

const source=fs.readFileSync('src/lib/pos/consignment-receipt.ts','utf8');
const exportsModule={exports:{}};
new Function('exports','require',ts.transpileModule(source,{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
}).outputText)(exportsModule.exports,require);
const { buildConsignmentReceipt,buildConsignmentPayoutReceipt,consignmentFolio }=exportsModule.exports;
const fixture={
  id:'qa',receipt_number:999999,owner_name:'PROPIETARIO DE PRUEBA',owner_phone:'6240000000',
  equipment_description:'Driver usado de prueba',condition_notes:'Pequeños rayones',accessories:'Funda',
  agreed_payout:600,asking_price:1000,expires_on:null,payout_business_days:2,
  status:'paid',product_id:'product',sale_id:'sale',sold_price:1000,
  sold_at:'2026-11-21T18:00:00Z',payout_due_on:'2026-11-24',paid_at:'2026-11-22T18:00:00Z',
  payout_method:'cash',payout_reference:'QA',created_at:'2026-11-21T18:00:00Z',
};

test('CG receipt uses scanner-compatible Code39 (compare patterns against ZXing)',()=>{
  assert.equal(consignmentFolio(999999),'CG999999');
  const mapping=source.match(/const CODE39:[\s\S]*?};/)?.[0];
  assert.ok(mapping);
  const entries=[...mapping.matchAll(/"([*CG0-9])":\s*"([nw]{9})"/g)];
  assert.equal(entries.length,13);
  for(const [,symbol,pattern] of entries){
    const encoded=[...pattern].reduce((bits,part)=>bits*2+(part==='w'?1:0),0);
    const expected=symbol==='*'?Code39Reader.ASTERISK_ENCODING:
      Code39Reader.CHARACTER_ENCODINGS[Code39Reader.ALPHABET_STRING.indexOf(symbol)];
    assert.equal(encoded,expected,`Invalid Code39 bars for ${symbol}`);
  }
});

test('CG handoff and owner payout PDFs each contain exactly two copies',()=>{
  const receipt=buildConsignmentReceipt(fixture);
  const payout=buildConsignmentPayoutReceipt(fixture);
  assert.equal(receipt.getNumberOfPages(),2);
  assert.equal(payout.getNumberOfPages(),2);
  assert.ok(receipt.output('arraybuffer').byteLength>1000);
  assert.ok(payout.output('arraybuffer').byteLength>1000);
  assert.throws(()=>buildConsignmentPayoutReceipt({...fixture,status:'sold_pending'}),/No hay una liquidación/);
});

test('long owner payout receipts grow to keep all fields and the signature printable',()=>{
  const receipt=buildConsignmentPayoutReceipt({
    ...fixture,owner_name:'PROPIETARIO '.repeat(11),
    equipment_description:'Equipo de golf con detalle de uso y accesorios incluidos. '.repeat(9),
    payout_reference:'TRANSFERENCIA-'.repeat(11),
  });
  assert.equal(receipt.getNumberOfPages(),2);
  assert.ok(receipt.internal.pageSize.getHeight()>158);
});
