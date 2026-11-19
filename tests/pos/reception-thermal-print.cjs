'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const bridge = fs.readFileSync('tools/pos-print-bridge/UpNDownPrintBridge.ps1', 'utf8');
const receipt = fs.readFileSync('src/lib/pos/reception-receipt.ts', 'utf8');

test('thermal reception barcode uses raster rendering rather than native GS k that truncated tickets', () => {
  const barcode = bridge.slice(bridge.indexOf('function AddReceptionBarcode('), bridge.indexOf('function ReceptionLine('));
  assert.match(barcode, /AddRaster \$b \$data \$widthBytes \$height/);
  assert.doesNotMatch(barcode, /\$GS,107|\$GS,\s*107|\$GS,\s*107/);
  assert.match(barcode, /ReceptionLine \$b \$folio/);

  const code39Pdf = Object.fromEntries([...receipt.matchAll(/"([*SR0-9-])":"([nw]{9})"/g)].map(m => [m[1], m[2]]));
  const code39Bridge = Object.fromEntries([...barcode.matchAll(/'([*SR0-9-])'='([nw]{9})'/g)].map(m => [m[1], m[2]]));
  assert.equal(Object.keys(code39Bridge).length, 14);
  assert.deepEqual(code39Bridge, code39Pdf, 'thermal and PDF must encode identical Code39 symbols');

  const body = bridge.slice(bridge.indexOf('function BuildReceptionBody('), bridge.indexOf('function BuildReceptionTicket('));
  assert.match(body, /AddReceptionBarcode \$b \$folio/);
  for (const field of ['CLIENTE', 'TELEFONO', 'EQUIPO', 'SERVICIO', 'TRABAJO SOLICITADO', 'CONDICION AL RECIBIR', 'ACCESORIOS']) {
    assert.match(body, new RegExp("ReceptionText \\$b '" + field + "'"));
  }
});

test('thermal reception has two RAW jobs, each with its own cutter command and no drawer', () => {
  const ticket = bridge.slice(bridge.indexOf('function BuildReceptionTicket('), bridge.indexOf('function SendRaw('));
  assert.match(ticket, /AddBytes \$b \(BuildReceptionBody \$r \$copy\)/);
  assert.match(ticket, /AddBytes \$b \$CUT/);

  const start = bridge.indexOf("if($c.Request.Url.AbsolutePath -eq '/print-reception')");
  const end = bridge.indexOf('};$sale=$p.sale;', start);
  assert.ok(start >= 0 && end > start);
  const route = bridge.slice(start, end);
  assert.equal((route.match(/SendRaw \(BuildReceptionTicket/g) || []).length, 2);
  assert.match(route, /BuildReceptionTicket \$reception 'CLIENTE'/);
  assert.match(route, /BuildReceptionTicket \$reception 'TALLER'/);
  assert.doesNotMatch(route, /SendRaw \$CUT|\$DRAWER/);
});

test('scanner hyphen normalization is limited to workshop folios', () => {
  const block = receipt.slice(receipt.indexOf('export function normalizeReceptionFolioInput('), receipt.indexOf('export function receptionFileName('));
  assert.match(block, /\^SR\[/);
  assert.match(block, /\[0-9\]\{1,12\}\$/);
  assert.match(block, /"SR-"/);
});

test('safe reception hardware check prints fictitious data, without server or cash drawer', () => {
  const start = bridge.indexOf('if($TestReception){');
  const end = bridge.indexOf('if($TestReceipt){', start);
  const listener = bridge.indexOf('$l=New-Object Net.HttpListener;');
  assert.ok(start > 0 && end > start && listener > end);
  const sample = bridge.slice(start, end);
  assert.match(sample, /receipt_number=999999/);
  assert.match(sample, /customer_name='CLIENTE DE PRUEBA - NO REAL'/);
  assert.match(sample, /equipment_description='Putter ficticio de prueba'/);
  assert.match(sample, /service_name='Cambio de grip \(prueba\)'/);
  assert.match(sample, /BuildReceptionTicket \$sample 'CLIENTE'/);
  assert.match(sample, /BuildReceptionTicket \$sample 'TALLER'/);
  assert.doesNotMatch(sample, /\$DRAWER|pos_reception_create|pos_create_sale/);
  assert.match(bridge, /if\(\$r\.is_test\)\{ReceptionLine \$b '\*\*\* PRUEBA - NO ES RECEPCION REAL \*\*\*'\}/);
});
