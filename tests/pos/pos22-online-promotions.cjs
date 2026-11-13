'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const file=fs.readFileSync('src/lib/storefront/online-pricing.ts','utf8');
const compiled=ts.transpileModule(file,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const loaded={exports:{}};
new Function('module','exports','require',compiled)(loaded,loaded.exports,require);
const {onlinePrice,matchOnlineCampaign}=loaded.exports;
const fixture={
 id:'c1',title:'Wedges noviembre',target_type:'category',
 target_value:'wedges',discount_percent:20
};
test('online: offer 900 takes priority over regular 1000 before 20% campaign',()=>{
 assert.deepEqual(onlinePrice({price:1000,salePrice:900,campaignPercent:20}),
 {price:720,comparePrice:1000,campaignPercent:20});
});
test('online: when no special price campaign discounts regular 1000',()=>{
 assert.deepEqual(onlinePrice({price:1000,campaignPercent:20}),
 {price:800,comparePrice:1000,campaignPercent:20});
});
test('online: existing special offer without category promotion remains valid',()=>{
 assert.deepEqual(onlinePrice({price:1000,salePrice:900,campaignPercent:0}),
 {price:900,comparePrice:1000,campaignPercent:0});
});
test('online: an invalid special price above regular never increases checkout price',()=>{
 assert.equal(onlinePrice({price:1000,salePrice:1200,campaignPercent:20}).price,800);
});
test('online: unchanged regular price has no strike-through',()=>{
 assert.deepEqual(onlinePrice({price:1000,campaignPercent:0}),
 {price:1000,comparePrice:null,campaignPercent:0});
});
test('online: campaign matches parent category on individual variant',()=>{
 assert.equal(matchOnlineCampaign([fixture],{categoryId:'wedges',sku:'WED-001-V01'}).discount_percent,20);
});
test('online: strongest active SKU or parent barcode campaign wins once',()=>{
 const promos=[
  fixture,
  {id:'sku',title:'Individual',target_type:'sku',target_value:'WED-001-V01',discount_percent:15},
  {id:'ean',title:'Barcode',target_type:'barcode',target_value:'2000000000053',discount_percent:25}
 ];
 assert.equal(matchOnlineCampaign(promos,{categoryId:'wedges',sku:'WED-001-V01',parentBarcode:'2000000000053'}).id,'ean');
});
test('online: foreign category never discounts product',()=>{
 assert.equal(matchOnlineCampaign([fixture],{categoryId:'putters',sku:'PUT-001'}),null);
});
test('online: rejects out-of-range campaign values',()=>{
 assert.throws(()=>onlinePrice({price:1000,campaignPercent:105}),/INVALID_CAMPAIGN_PERCENT/);
});
const runtime=fs.readFileSync('public/updown-parity-runtime.js','utf8');
const i=runtime.indexOf('  function storefrontPricing(');
const j=runtime.indexOf('  function cartUnits()',i);
assert.ok(i>=0&&j>i,'Legacy storefront pricing functions must exist');
const ctx=vm.createContext({});
vm.runInContext(runtime.slice(i,j),ctx);
test('online: legacy cards and cart apply the same offer-first price',()=>{
 assert.equal(ctx.storefrontPricing({price:1000,sale_price:900,automaticPromotion:{percent:20}}).price,720);
 assert.equal(ctx.storefrontPricing({price:1000,sale_price:null,automaticPromotion:{percent:20}}).price,800);
});
test('online: storefront campaign priority also applies to parent SKU and variants',()=>{
 const [result]=ctx.applyStorefrontPromotions([{price:1000,category_id:'wedges',sku:'WED-001-V01',parent_sku:'WED-001'}],
 [fixture,{id:'p',title:'Parent SKU',target_type:'sku',target_value:'WED-001',discount_percent:18}]);
 assert.equal(result.automaticPromotion.percent,20);
});
// Exercise the actual storefront card formatter in a sandboxed, fake-DOM-free runtime.
const cardStart=runtime.indexOf('  function stockCopy(');
const cardEnd=runtime.indexOf('  function markImageFallback(',cardStart);
assert.ok(cardStart>=0&&cardEnd>cardStart,'Store card price renderer must exist');
const cardCtx=vm.createContext({
 currentLanguage:'es',conditionLabels:{new:'Nuevo'},conditionLabelsEn:{new:'New'},
 normalizeSpecKey:x=>String(x).toLowerCase(),golfSpecChips:()=>[],
 escapeHtml:x=>String(x),categoryLabel:()=> 'Wedges',
 localizedProductText:()=>'',money:n=>'
test('online: checkout V1 and V2 both calculate campaign on the server',()=>{
 assert.match(sql,/function public.reserve_checkout_inventory\(/i);
 assert.match(sql,/function public.reserve_checkout_inventory_v2\(/i);
 assert.match(sql,/pos22_match_promotion\(v_product.id,null\)/);
 assert.match(sql,/pos22_match_promotion\(v_parent_id,v_variant_id\)/);
 assert.match(sql,/grant execute on function public.pos22_public_active_promotions\(\) to anon,authenticated/);
});
+Number(n).toFixed(2),
 siteText:()=> 'Envío no incluido',storefrontPricing:ctx.storefrontPricing
});
vm.runInContext(runtime.slice(cardStart,cardEnd),cardCtx);
test('online: real card markup displays campaign badge, crossed regular and final price',()=>{
 const html=cardCtx.cardHtml({
  id:'qa-wedge',name:'Wedge 56',item_condition:'new',category_id:'wedges',stock:3,
  currency:'MXN',price:1000,sale_price:900,automaticPromotion:{percent:20}
 });
 assert.match(html,/uds-campaign-badge[^>]*>-20%/);
 assert.match(html,/uds-price[^>]*>\$720\.00/);
 assert.match(html,/uds-old-price[^>]*>\$1000\.00/);
});
test('online: card without campaign retains special price and no campaign badge',()=>{
 const html=cardCtx.cardHtml({name:'Wedge 52',stock:4,item_condition:'new',
  price:1000,sale_price:900,currency:'MXN'});
 assert.doesNotMatch(html,/uds-campaign-badge/);
 assert.match(html,/uds-price[^>]*>\$900\.00/);
});
const addStart=runtime.indexOf('  function addToCart(');
const addEnd=runtime.indexOf('  function changeQty(',addStart);
assert.ok(addStart>=0&&addEnd>addStart,'Cart item pricing must exist');
const cartCtx=vm.createContext({
 cart:[],currentLanguage:'es',PREVIEW_CATEGORY_GROUPS:[{id:'qa'}],
 showToast:()=>{},saveCart:()=>{},golfSummary:()=>'',storefrontPricing:ctx.storefrontPricing
});
vm.runInContext(runtime.slice(addStart,addEnd),cartCtx);
test('online: Add-to-cart transfers exact discounted value into stored cart item',()=>{
 cartCtx.addToCart({id:'qa-wedge',name:'Wedge 56',sku:'WED-QA',
  currency:'MXN',stock:3,price:1000,sale_price:900,
  automaticPromotion:{percent:20}});
 assert.equal(cartCtx.cart[0].price,720);
 assert.equal(cartCtx.cart[0].quantity,1);
});
const sql=fs.readFileSync('supabase/migrations/20261113093000_pos22_storefront_campaign_checkout.sql','utf8');
test('online: checkout V1 and V2 both calculate campaign on the server',()=>{
 assert.match(sql,/function public.reserve_checkout_inventory\(/i);
 assert.match(sql,/function public.reserve_checkout_inventory_v2\(/i);
 assert.match(sql,/pos22_match_promotion\(v_product.id,null\)/);
 assert.match(sql,/pos22_match_promotion\(v_parent_id,v_variant_id\)/);
 assert.match(sql,/grant execute on function public.pos22_public_active_promotions\(\) to anon,authenticated/);
});
