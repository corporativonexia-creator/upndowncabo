'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const page = fs.readFileSync('src/app/pos/page.tsx','utf8');
const sale = fs.readFileSync('supabase/migrations/20261112201000_pos22_sale_engine.sql','utf8');
const approval = fs.readFileSync('supabase/migrations/20261112202000_pos22_approval_and_service_reversals.sql','utf8');
function extract(start,end){
  const from=page.indexOf(start), to=page.indexOf(end,from);
  assert.ok(from>=0&&to>from,`Function anchors not found: ${start}`);
  return page.slice(from,to);
}
const functions=[
  extract('function roundMoney(', 'function cartUnitPrice('),
  extract('function globalDiscountAmount(', 'function pos21Items(')
].join('\n');
const js=ts.transpileModule(functions,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.None}}).outputText;
const ctx=vm.createContext({});
vm.runInContext(js,ctx);
const discount=(original, net, mode, value)=>ctx.globalDiscountAmount(original,true,mode,String(value),net);
const price=(net,amount)=>Math.round((net-amount)*100)/100;

test('Precio final general coincide exactamente con total cobrado, sin descuentos previos',()=>{
  assert.equal(price(5000,discount(5000,5000,'final',4000)),4000);
});
test('Precio final general respeta campañas por artículo ya aplicadas',()=>{
  assert.equal(price(4980,discount(5000,4980,'final',4000)),4000);
});
test('Precio final general respeta descuentos combinados',()=>{
  assert.equal(price(3500,discount(5000,3500,'final',3000)),3000);
});
test('Precio final general no puede incrementar el valor después de promociones',()=>{
  assert.ok(Number.isNaN(discount(5000,3500,'final',4000)));
});
test('Porcentaje y descuento fijo generales siguen calculándose sobre el importe original',()=>{
  assert.equal(discount(5000,4800,'percent',20),1000);
  assert.equal(discount(5000,4800,'amount',500),500);
});
test('Un descuento general excesivo no puede dejar precio negativo',()=>{
  assert.ok(Number.isNaN(discount(5000,1000,'percent',40)));
});
test('Venta SQL recalcula el precio final después de descuentos automáticos y manuales',()=>{
  assert.match(sale,/when 'final' then v_global_discount:=round\(v_subtotal-v_auto_discount-v_manual_discount-v_global_value,2\)/);
  assert.match(sale,/v_global_discount>round\(v_subtotal-v_auto_discount-v_manual_discount,2\)/);
});
test('Autorización SQL sigue la misma fórmula que la venta',()=>{
  assert.match(approval,/when 'final' then v_global_discount:=round\(sub_total-v_auto_discount-total_discount-v_global_value,2\)/);
  assert.match(approval,/v_global_discount>round\(sub_total-v_auto_discount-total_discount,2\)/);
});
test('Servicios no generan movimientos de inventario al revertirse',()=>{
  assert.equal(approval.split('if v_product.is_service then continue; end if;').length-1,3);
});
