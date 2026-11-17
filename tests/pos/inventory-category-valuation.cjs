'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

const source = fs.readFileSync('src/components/admin/inventory-admin.tsx', 'utf8');
const start = source.indexOf('  const price=(r:Row)=>{');
const end = source.indexOf('  if(String(format)==="ticket"){', start);
assert.ok(start >= 0 && end > start, 'Inventory valuation implementation must be present');
const body = ts.transpileModule(source.slice(start, end), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }
}).outputText;
const valuation = new Function(body + '\nreturn valuation;')();

const sample = [
 {product_id:'a',category_name:'Drivers',stock:2,effective_price:4550,currency:'MXN'},
 {product_id:'b',category_name:'Drivers',stock:3,effective_price:1250,currency:'MXN'},
 {product_id:'c',category_name:'Drivers',stock:1,effective_price:100,currency:'USD'},
 {product_id:'d',category_name:'Drivers',stock:1,effective_price:null,currency:'MXN'},
 {product_id:'e',category_name:'Drivers',stock:0,effective_price:null,currency:'MXN'},
 {product_id:'f',category_name:'Wedges',stock:2,effective_price:500,currency:'MXN'},
];

test('Category totals are quantity times current unit price, separated by currency', () => {
 const out = valuation(sample.filter(r=>r.category_name==='Drivers'));
 assert.equal(out.amounts.MXN, 12850);
 assert.equal(out.amounts.USD, 100);
 assert.equal(out.pieces, 7);
 assert.equal(out.variants, 5);
 assert.equal(out.unpriced, 1);
 assert.deepEqual(Array.from(out.currencies), ['MXN','USD']);
});

test('Printed overall total respects category choice (not all inventory)', () => {
 const drivers = valuation(sample.filter(r=>r.category_name==='Drivers'));
 const wedges = valuation(sample.filter(r=>r.category_name==='Wedges'));
 assert.equal(drivers.amounts.MXN, 12850);
 assert.equal(wedges.amounts.MXN, 1000);
 assert.equal(valuation(sample).amounts.MXN, 13850);
});

test('Zero stock variants without price do not create artificial missing valuation', () => {
 const x = valuation([{product_id:'a',stock:0,effective_price:null,currency:'MXN'}]);
 assert.equal(x.unpriced, 0);
 assert.equal(x.amounts.MXN, 0);
});

test('Ticket and A4/PDF clearly show category subtotals and final totals', () => {
 for (const label of ['TOTAL CATEGORÍA ', 'SUMATORIA TOTAL · ','TOTAL GENERAL DE CATEGORÍAS','TOTAL GENERAL ']) {
   assert.ok(source.includes(label), 'Missing printable heading '+label);
 }
 for (const field of ['Precio unit.','Exist.','Importe','Sin precio','total parcial']) {
   assert.ok(source.includes(field), 'Missing report detail '+field);
 }
});
