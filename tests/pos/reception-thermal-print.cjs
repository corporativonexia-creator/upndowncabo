'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const bridge = fs.readFileSync('tools/pos-print-bridge/UpNDownPrintBridge.ps1', 'utf8');
const receipt = fs.readFileSync('src/lib/pos/reception-receipt.ts', 'utf8');

test('thermal reception barcode stays within the width of the already-working logo raster', () => {
  const barcode = bridge.slice(bridge.indexOf('function AddReceptionBarcode('), bridge.indexOf('function ReceptionLine('));
  assert.match(barcode, /AddRaster \$b \$data \$widthBytes \$height/);
  const barcodeWidthBytes = Number(barcode.match(/\$widthBytes=(\d+);\$height=/)?.[1]);
  const logoWidthBytes = Number(bridge.match(/function AddLogo\(\$b\)\{AddRaster \$b \$LogoRaster (\d+)/)?.[1]);
  assert.equal(barcodeWidthBytes, 48);
  assert.equal(barcodeWidthBytes, logoWidthBytes);
  assert.doesNotMatch(barcode, /\$GS,107|\$GS,\s*107|\$GS,\s*107/);
  assert.match(barcode, /ReceptionLine \$b \$folio/);
  assert.ok(barcode.indexOf('ReceptionLine $b $folio') < barcode.indexOf('AddRaster $b $data'),
    'barcode must be the final printable item; commands after the raster were lost on POS-80C');

  const code39Pdf = Object.fromEntries([...receipt.matchAll(/"([*SR0-9-])":"([nw]{9})"/g)].map(m => [m[1], m[2]]));
  const code39Bridge = Object.fromEntries([...barcode.matchAll(/'([*SR0-9-])'='([nw]{9})'/g)].map(m => [m[1], m[2]]));
  assert.equal(Object.keys(code39Bridge).length, 13);
  assert.deepEqual(code39Bridge, code39Pdf, 'thermal and PDF must encode identical Code39 symbols');
  assert.doesNotMatch(barcode, /'\-'=/);

  // Code39: six narrow + three wide bars/spaces per symbol; one narrow separator.
  const fits = (digits, narrow, wide) => {
    const count = digits + 4; // Start, S, R, digits, stop.
    return count * (6 * narrow + 3 * wide) + (count - 1) * narrow <= barcodeWidthBytes * 8;
  };
  for (let digits = 6; digits <= 9; digits++) assert.ok(fits(digits, 2, 5));
  for (let digits = 10; digits <= 12; digits++) assert.ok(fits(digits, 1, 3));

  const body = bridge.slice(bridge.indexOf('function BuildReceptionBody('), bridge.indexOf('function BuildReceptionBarcode('));
  assert.doesNotMatch(body, /AddReceptionBarcode|AddRaster/, 'text body cannot include the barcode raster');
  for (const field of ['CLIENTE', 'TELEFONO', 'EQUIPO', 'SERVICIO', 'TRABAJO SOLICITADO', 'CONDICION AL RECIBIR', 'ACCESORIOS']) {
    assert.match(body, new RegExp("ReceptionText \\$b '" + field + "'"));
  }
  const raster = bridge.slice(bridge.indexOf('function BuildReceptionBarcode('), bridge.indexOf('function BuildReceptionFinish('));
  assert.match(raster, /AddBytes \$b \$INIT/);
  assert.match(raster, /AddReceptionBarcode \$b \$folio/);
  assert.doesNotMatch(raster, /\$CUT/);
  const finish = bridge.slice(bridge.indexOf('function BuildReceptionFinish('), bridge.indexOf('function SendRaw('));
  assert.match(finish, /AddBytes \$b \$INIT/);
  assert.match(finish, /ReceptionLine \$b \('FIN '/);
  assert.doesNotMatch(finish, /\$ESC,100,8|AddBytes \$b \$CUT/, 'footer should contain text only');
  assert.match(bridge, /\$RECEPTION_FEED_CUT=B @\(\$ESC,64,\$ESC,100,8,\$GS,86,0\)/);
});

test('reception sends text, raster and visible finish as separate jobs per copy, never drawer', () => {
  const print = bridge.slice(bridge.indexOf('function PrintReceptionCopy('), bridge.indexOf('function Reply('));
  assert.equal((print.match(/SendRaw \(BuildReceptionBody/g) || []).length, 1);
  assert.equal((print.match(/SendRaw \(BuildReceptionBarcode/g) || []).length, 1);
  assert.equal((print.match(/SendRaw \(BuildReceptionFinish/g) || []).length, 1);
  assert.equal((print.match(/SendRaw \$RECEPTION_FEED_CUT/g) || []).length, 1);
  assert.ok(print.indexOf('SendRaw (BuildReceptionBody') < print.indexOf('SendRaw (BuildReceptionBarcode'));
  assert.ok(print.indexOf('SendRaw (BuildReceptionBarcode') < print.indexOf('SendRaw (BuildReceptionFinish'));
  assert.ok(print.indexOf('SendRaw (BuildReceptionFinish') < print.indexOf('SendRaw $RECEPTION_FEED_CUT'));
  assert.match(print, /PrintReceptionCopy \$r 'CLIENTE'/);
  assert.match(print, /PrintReceptionCopy \$r 'TALLER'/);
  assert.doesNotMatch(print, /\$DRAWER/);

  const retail = bridge.slice(bridge.indexOf('if($TestReceipt){'));
  assert.match(retail, /SendRaw \$CUT \("Venta "\+\$sale.sale_number\+" CORTE CLIENTE"\)/);
  assert.match(retail, /SendRaw \$DRAWER \("Venta "\+\$sale.sale_number\+" CAJON"\)/);
  const start = bridge.indexOf("if($c.Request.Url.AbsolutePath -eq '/print-reception')");
  const end = bridge.indexOf('};$sale=$p.sale;', start);
  assert.ok(start >= 0 && end > start);
  const route = bridge.slice(start, end);
  assert.match(route, /PrintReception \$reception/);
  assert.match(route, /"drawer":0/);
  assert.doesNotMatch(route, /\$DRAWER/);
});

test('new receipts use SR + numbers; legacy hyphens and apostrophes remain searchable', () => {
  const block = receipt.slice(receipt.indexOf('export function receptionFolio('), receipt.indexOf('export function receptionFileName('));
  const plainJs = block.replaceAll('export function ', 'function ')
    .replace('(number: number)', '(number)').replaceAll('(value: string)', '(value)');
  const {receptionFolio,normalizeReceptionFolioInput,receptionSearchTerm} = new Function(
    plainJs + '\nreturn {receptionFolio,normalizeReceptionFolioInput,receptionSearchTerm};'
  )();
  assert.equal(receptionFolio(1), 'SR000001');
  assert.equal(receptionFolio(1000000), 'SR1000000');
  for (const oldCode of ['SR000001','sr-000001',"SR'000001",'SR–000001','SR0000001']) {
    assert.equal(normalizeReceptionFolioInput(oldCode), 'SR000001');
    assert.equal(receptionSearchTerm(oldCode), '1');
  }
  assert.equal(receptionSearchTerm('SR000129'), '129');
  assert.equal(receptionSearchTerm('SR-000129'), '129');
  assert.equal(receptionSearchTerm('Cliente Driver'), 'Cliente Driver');
  assert.equal(normalizeReceptionFolioInput('SR-QA'), 'SR-QA');
});

test('local diagnostic prints fictitious data; plain mode isolates barcode and print cut without opening drawer', () => {
  const start = bridge.indexOf('if($TestReception -or $TestReceptionPlain -or $TestReceptionBarcode){');
  const end = bridge.indexOf('if($TestReceipt){', start);
  const listener = bridge.indexOf('$l=New-Object Net.HttpListener;');
  assert.ok(start > 0 && end > start && listener > end);
  const sample = bridge.slice(start, end);
  assert.match(sample, /receipt_number=999999/);
  assert.match(sample, /customer_name='CLIENTE DE PRUEBA - NO REAL'/);
  assert.match(sample, /equipment_description='Putter ficticio de prueba'/);
  assert.match(sample, /service_name='Cambio de grip \(prueba\)'/);
  assert.match(sample, /if\(\$TestReceptionPlain\)/);
  assert.match(sample, /BuildReceptionBody \$sample 'CLIENTE'/);
  assert.match(sample, /SendRaw \$RECEPTION_FEED_CUT 'QA RECEPCION AVANCE Y CORTE SOLO TEXTO'/);
  assert.match(sample, /if\(\$TestReceptionBarcode\)/);
  assert.match(sample, /PrintReceptionCopy \$sample 'CLIENTE'/);
  assert.match(sample, /PrintReception \$sample/);
  assert.match(bridge, /\$folio='SR'\+\$number\.ToString\('000000'\)/);
  assert.doesNotMatch(sample, /\$DRAWER|pos_reception_create|pos_create_sale/);
  assert.match(bridge, /if\(\$r\.is_test\)\{ReceptionLine \$b '\*\*\* PRUEBA - NO ES RECEPCION REAL \*\*\*'\}/);
});
