'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function compile(source){
  return ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
}
const exportsHolder={};
new Function('exports','require',compile(fs.readFileSync('src/lib/pos/receipt-discounts.ts','utf8')))(exportsHolder,require);
const {receiptDiscountBreakdown:breakdown}=exportsHolder;
const fakeSale=(overrides={})=>({
  id:'qa-receipt',sale_number:991,status:'completed',currency:'MXN',
  subtotal:5000,discount_amount:1020,total:3980,created_at:'2026-11-13T15:00:00Z',
  items:[{product_id:'p1',sku:'QA-GOLF',product_name:'Pelotas de golf',
    unit_price:200,quantity:1,line_subtotal:200,discount_amount:20,
    promotion_mode:'amount',promotion_value:20,line_total:180}],
  payments:[{method:'cash',amount:1000},{method:'card_terminal',amount:2980,reference:'QA-TERMINAL'}],
  ...overrides
});
test('POS Retail V8: general 20% of 5000 + 20 per item yields exact 3980',()=>{
  assert.deepEqual(breakdown(fakeSale()),{original:5000,itemSavings:20,generalSavings:1000,totalSavings:1020,final:3980});
});
test('POS Retail V8: no general discount on historical/line-only receipts',()=>{
  const x=fakeSale({subtotal:200,discount_amount:20,total:180});
  assert.equal(breakdown(x).generalSavings,0);
});
test('POS Retail V8: campaigns and manual discounts are already in line savings',()=>{
  const x=fakeSale({subtotal:1000,discount_amount:350,total:650,items:[{discount_amount:150},{discount_amount:100}]});
  assert.deepEqual([breakdown(x).itemSavings,breakdown(x).generalSavings],[250,100]);
});
test('POS Retail V8: reject inconsistent accounting rather than print fictitious savings',()=>{
  assert.throws(()=>breakdown(fakeSale({total:3900})),/RECEIPT_LEDGER_MISMATCH/);
  assert.throws(()=>breakdown(fakeSale({discount_amount:10,total:4990})),/RECEIPT_LEDGER_MISMATCH/);
  assert.throws(()=>breakdown(fakeSale({discount_amount:'NaN'})),/INVALID_RECEIPT_AMOUNT/);
});
const page=fs.readFileSync('src/app/pos/page.tsx','utf8');
function part(start,end){
  const s=page.indexOf(start);const e=page.indexOf(end,s+start.length);
  assert.ok(s>=0&&e>s,'Source segment missing: '+start);
  return page.slice(s,e);
}
class SpyPdf{
  constructor(options){this.options=options;this.rows=[];}
  setDrawColor(){return this;}setLineWidth(){return this;}line(){return this;}
  setFont(){return this;}setFontSize(){return this;}setTextColor(){return this;}
  text(txt){this.rows.push(...(Array.isArray(txt)?txt:[txt]).map(String));return this;}
  splitTextToSize(txt){return [String(txt)];}
}
const pdfSource=[
  part('function money(', 'function productPrice('),
  part('function numeric(', '// POS 2.1:'),
  part('function paymentLabel(', 'function saleStatusLabel('),
  part('function receiptAmountWords(', 'function makeDeviceToken('),
].join('\n');
const ctx=vm.createContext({jsPDF:SpyPdf,receiptDiscountBreakdown:breakdown,Intl,Date,Math,Number,String});
vm.runInContext(compile(pdfSource),ctx);
test('POS Retail V8: PDF includes separate original, item, general and total savings',()=>{
  const result=ctx.buildReceiptPdf(fakeSale(),{employee_number:'QA',full_name:'Caja QA',terminal_name:'Caja QA'});
  const text=result.rows.join(' | ');
  for(const value of ['VENTA #991','PRECIO ORIGINAL','AHORRO ARTICULOS','DESCUENTO GENERAL','AHORRO TOTAL','TOTAL','PAGO MIXTO','Terminal','Efectivo','QA-TERMINAL'])
    assert.ok(text.includes(value), 'PDF must include '+value);
  assert.ok(text.includes('3,980'), 'PDF must show final amount 3980 MXN');
  assert.equal(result.options.format[0],80);
});
test('POS Retail V8: PDF suppresses absent general discount',()=>{
  const result=ctx.buildReceiptPdf(fakeSale({subtotal:200,total:180,discount_amount:20,payments:[{method:'cash',amount:180}]}),null);
  assert.ok(!result.rows.includes('DESCUENTO GENERAL'));
  assert.ok(result.rows.includes('AHORRO ARTICULOS'));
});
const bridge=fs.readFileSync('tools/pos-print-bridge/UpNDownPrintBridge.ps1','utf8');
test('POS Retail V8: thermal ticket reconciles discounts without re-querying promotion rules',()=>{
  assert.match(bridge,/\$generalSavings=\$totalSavings-\$itemSavings/);
  for(const value of ['RECEIPT_LEDGER_MISMATCH',"'AHORRO ARTICULOS'","'DESCUENTO GENERAL'","'AHORRO TOTAL'"])
    assert.ok(bridge.includes(value),'thermal bridge must contain '+value);
});
test('POS Retail V8: original two-copy, two-cut and cash-drawer flow remains present',()=>{
  assert.match(bridge,/BuildBody \$sale \$access 'CLIENTE'/);
  assert.match(bridge,/BuildBody \$sale \$access 'COMERCIO'/);
  assert.match(bridge,/SendRaw \$DRAWER/);
  assert.match(bridge,/copies":2,"cuts":2,"drawer":1/);
});

test('POS Retail V8: local simulation invokes existing BuildBody without network or stock',()=>{
 assert.match(bridge,/\[switch\]\$TestReceipt/);
 assert.match(bridge,/\[switch\]\$TestDrawer/);
 assert.match(bridge,/if\(\$TestReceipt\)\s*\{/);
 assert.match(bridge,/is_test=\$true/);
 assert.match(bridge,/sale_number='QA22-NO-VENTA'/);
 assert.match(bridge,/PRUEBA POS 2\.2 - NO ES VENTA/);
 assert.match(bridge,/NO EXISTE TRANSACCION REAL/);
 assert.match(bridge,/SIN COBRO - SIN CAMBIO DE STOCK/);
 assert.match(bridge,/BuildBody \$testSale \$null 'CLIENTE'/);
 assert.match(bridge,/BuildBody \$testSale \$null 'COMERCIO'/);
 assert.match(bridge,/if\(\$TestDrawer\)\{/);
 const diagnostic=bridge.slice(bridge.indexOf('if($TestReceipt){'),bridge.indexOf('$l=New-Object Net.HttpListener;'));
 assert.doesNotMatch(diagnostic,/fetch\(|supabase|https?:\/\/|pos_create_sale|inventory_movements/i);
 assert.match(diagnostic,/exit 0/);
 assert.equal((diagnostic.match(/SendRaw \$CUT/g)||[]).length,2);
 assert.equal((diagnostic.match(/SendRaw \$DRAWER/g)||[]).length,1);
});
test('POS Retail V8: simulated fixture totals match item savings and global discount',()=>{
 assert.match(bridge,/subtotal=5000\.00; discount_amount=1020\.00; total=3980\.00/);
 assert.match(bridge,/line_total=180\.00;discount_amount=20\.00/);
 assert.match(bridge,/line_total=4800\.00;discount_amount=0\.00/);
 assert.equal(180+4800-(1020-20),3980);
});

test('POS Retail V8: PowerShell grammar parses on runners with pwsh available',t=>{
 const {spawnSync}=require('node:child_process');
 const cmd='$tokens=$null;$errors=$null;[System.Management.Automation.Language.Parser]::ParseFile("tools/pos-print-bridge/UpNDownPrintBridge.ps1",[ref]$tokens,[ref]$errors)|Out-Null;if($errors.Count -gt 0){$errors|ForEach-Object {Write-Output $_.Message};exit 1}';
 const result=spawnSync('pwsh',['-NoProfile','-NonInteractive','-Command',cmd],{encoding:'utf8',timeout:20000});
 if(result.error?.code==='ENOENT'){t.skip('PowerShell is unavailable on this runner');return;}
 assert.equal(result.status,0,[result.stdout,result.stderr,result.error?.message].filter(Boolean).join('\n'));
});
