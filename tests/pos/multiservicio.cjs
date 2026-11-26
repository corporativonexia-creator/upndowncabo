'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const {Module}=require('node:module');
const src=fs.readFileSync('src/lib/pos/multiservicio.ts','utf8');
const code=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const m=new Module('multiservicio');m._compile(code,'multiservicio');
const {receptionChargeGroups,receptionPrintFields}=m.exports;
const line=(fields={})=>({equipment_key:1,equipment_description:'Driver',condition_notes:'Marcas',accessories:'Funda',
  service_product_id:'grip',service_name:'Cambio de grip',work_description:'Instalar grip',quantity:1,price_cents:45000,status:'finished',...fields});
test('consolida servicios iguales sin redondear ni perder precio diferente por equipo',()=>{
  const lines=[line(),line({equipment_key:2,equipment_description:'Putter',price_cents:65050,quantity:2}),line({service_product_id:'clean',price_cents:25000})];
  assert.deepEqual(receptionChargeGroups(lines),[{productId:'grip',cents:175100},{productId:'clean',cents:25000}]);
});
test('pendientes, no autorizados y órdenes sin trabajo facturable no se cobran',()=>{
  for(const l of [line({price_cents:null}),line({status:'in_progress'}),line({price_cents:0}),line({status:'cancelled'})])
    assert.throws(()=>receptionChargeGroups([l]));
  assert.deepEqual(receptionChargeGroups([line(),line({status:'cancelled'})]),[{productId:'grip',cents:45000}]);
});
test('proyección de impresión conserva ambos equipos, trabajos y estados',()=>{
  const result=receptionPrintFields([line(),line({equipment_key:2,equipment_description:'Putter',status:'pending',price_cents:null})]);
  assert.match(result.equipment_description,/Equipo 1: Driver.*Equipo 2: Putter/);
  assert.match(result.service_name,/Equipo 1: Cambio de grip.*Equipo 2: Cambio de grip.*Por cotizar/);
  assert.match(result.work_description,/Equipo 1.*Instalar grip.*Equipo 2.*Instalar grip/);
});
