-- POS 2.1: full rollback-only mixed and legacy refund regression.
begin;
do $qa$
declare
  v_emp uuid;v_auth uuid;v_terminal uuid;v_shift uuid;
  v_product uuid;v_variant uuid;v_price numeric;v_stock_before int;
  v_item jsonb;v_sale jsonb;v_sale_id uuid;v_refund jsonb;v_refund_id uuid;
  v_cash numeric;v_split jsonb;v_payments jsonb;
  v_shift_summary jsonb;v_shift_close jsonb;
begin
  select id,auth_user_id into v_emp,v_auth
    from public.pos_employees where role='pos_admin' and status='active'
    and auth_user_id is not null limit 1;
  if v_emp is null then raise exception 'QA_NO_POS_ADMIN';end if;
  perform set_config('request.jwt.claim.sub',v_auth::text,true);
  insert into public.pos_terminals(name,status,device_token_hash,activated_at)
  values('POS21 REFUND QA TRANSIENT','active',
    extensions.digest(convert_to('pos21-split-refund-qa-token','UTF8'),'sha256'),now())
  returning id into v_terminal;
  insert into public.pos_shifts(employee_id,terminal_id,status,opening_cash)
  values(v_emp,v_terminal,'open',0) returning id into v_shift;
  select p.id,v.id,round(coalesce(v.sale_price,v.price,p.sale_price,p.price),2),v.stock
  into v_product,v_variant,v_price,v_stock_before
  from public.product_variants v join public.products p on p.id=v.product_id
  where v.is_active and v.stock>0 and p.status='active'
    and p.pos_visible=true and coalesce(v.sale_price,v.price,p.sale_price,p.price)>200
  order by v.stock desc,v.id limit 1;
  if v_product is null then raise exception 'QA_NO_STOCK_PRODUCT';end if;
  v_item:=jsonb_build_array(jsonb_build_object(
     'product_id',v_product,'variant_id',v_variant,'quantity',1));
  v_cash:=round(v_price*0.30,2);
  v_payments:=jsonb_build_array(
    jsonb_build_object('method','cash','amount',v_cash,
      'metadata',jsonb_build_object('pos_request_id',gen_random_uuid())),
    jsonb_build_object('method','transfer','amount',v_price-v_cash,
      'reference','QA-REFUND-ONLY')
  );
  v_sale:=public.pos_create_sale_v21('pos21-split-refund-qa-token',
    v_item,v_payments,0,'QA mixed refund rollback',null);
  v_sale_id:=(v_sale->>'sale_id')::uuid;
  if (select stock from public.product_variants where id=v_variant)<>v_stock_before-1
  then raise exception 'QA_SALE_DID_NOT_DEDUCT_STOCK';end if;
  begin
    perform public.pos_refund_sale('pos21-split-refund-qa-token',
      v_sale_id,'cash','QA legacy forbidden');
    raise exception 'QA_LEGACY_ACCEPTED_MIXED';
  exception when others then
    if sqlerrm<>'MIXED_REFUND_REQUIRES_POS21' then raise;end if;
  end;
  begin
    perform public.pos_refund_sale_v21('pos21-split-refund-qa-token',
      v_sale_id,jsonb_build_array(
         jsonb_build_object('method','cash','amount',v_cash+1),
         jsonb_build_object('method','transfer','amount',v_price-v_cash-1)
      ),'QA wrong refund');
    raise exception 'QA_ACCEPTED_WRONG_ALLOCATIONS';
  exception when others then
    if sqlerrm not like 'REFUND_ORIGINAL_PAYMENT_MISMATCH%' then raise;end if;
  end;
  if (select stock from public.product_variants where id=v_variant)<>v_stock_before-1
  then raise exception 'QA_INVALID_REFUND_CHANGED_STOCK';end if;
  v_split:=jsonb_build_array(
    jsonb_build_object('method','cash','amount',v_cash),
    jsonb_build_object('method','transfer','amount',v_price-v_cash,
      'reference','QA-REFUND-TRF'));
  v_refund:=public.pos_refund_sale_v21('pos21-split-refund-qa-token',
     v_sale_id,v_split,'QA devolución original por método');
  v_refund_id:=(v_refund->>'refund_id')::uuid;
  if (select count(*) from public.pos21_refund_allocations where refund_id=v_refund_id)<>2
  then raise exception 'QA_MISSING_REFUND_ALLOCATIONS';end if;
  if (select count(*) from public.pos_refunds where id=v_refund_id and method='other'
      and amount=v_price and (metadata->>'mixed_payment')::boolean)<>1
  then raise exception 'QA_REFUND_SUMMARY_MISMATCH';end if;
  if (select count(*) from public.pos_sale_events
      where sale_id=v_sale_id and event_type='refund_recorded'
        and details->'allocations' is not null)<>1
  then raise exception 'QA_REFUND_AUDIT_MISSING';end if;
  if (select stock from public.product_variants where id=v_variant)<>v_stock_before
  then raise exception 'QA_REFUND_DID_NOT_RESTORE_STOCK';end if;
  v_shift_summary:=public.pos_get_current_shift_sales('pos21-split-refund-qa-token');
  if round((v_shift_summary->>'cash_refunds')::numeric,2)<>v_cash
    or round((v_shift_summary->>'expected_cash')::numeric,2)<>0
  then raise exception 'QA_MIXED_CASH_SHIFT_WRONG:%',v_shift_summary;end if;

  -- Legacy single-method refund still works normally.
  v_sale:=public.pos_create_sale_v21('pos21-split-refund-qa-token',v_item,
    jsonb_build_array(jsonb_build_object('method','cash','amount',v_price,
       'metadata',jsonb_build_object('pos_request_id',gen_random_uuid()))),
    0,'QA single refund rollback',null);
  v_sale_id:=(v_sale->>'sale_id')::uuid;
  v_refund:=public.pos_refund_sale('pos21-split-refund-qa-token',
     v_sale_id,'cash','QA legacy single');
  if (v_refund->>'method')<>'cash' then raise exception 'QA_LEGACY_REFUND_BROKEN';end if;
  v_shift_summary:=public.pos_get_current_shift_sales('pos21-split-refund-qa-token');
  if round((v_shift_summary->>'cash_refunds')::numeric,2)<>(v_cash+v_price)
    or round((v_shift_summary->>'expected_cash')::numeric,2)<>0
  then raise exception 'QA_LEGACY_CASH_SHIFT_WRONG';end if;
  v_shift_close:=public.pos_close_shift('pos21-split-refund-qa-token',0,
      'QA transaccional revertible');
  if round((v_shift_close->>'expected_cash')::numeric,2)<>0
  then raise exception 'QA_CLOSING_CASH_MISMATCH';end if;
  if (select stock from public.product_variants where id=v_variant)<>v_stock_before
  then raise exception 'QA_FINAL_STOCK_MISMATCH';end if;
  raise notice 'QA PASS split refund, amount restriction, legacy, closing, inventory; rolling back';
end
$qa$;
rollback;