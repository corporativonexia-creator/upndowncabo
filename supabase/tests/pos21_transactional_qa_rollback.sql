-- QA transaccional POS 2.1: no debe persistir ninguna venta ni cambio de stock.
begin;
do $qa$
declare
 v_emp uuid; v_auth uuid; v_term uuid; v_shift uuid;
 v_product uuid; v_variant uuid; v_original numeric; v_final numeric;
 v_stock_before integer; v_items jsonb; v_payments jsonb;
 v_token uuid; v_sale jsonb; v_sale_id uuid;
 v_cash numeric; v_approval_state uuid;
begin
 select e.id,e.auth_user_id into v_emp,v_auth from public.pos_employees e
   where e.role='pos_admin' and e.status='active' and e.auth_user_id is not null limit 1;
 if v_emp is null then raise exception 'QA_NO_ADMIN'; end if;
 perform set_config('request.jwt.claim.sub',v_auth::text,true);
 insert into public.pos_terminals(name,status,device_token_hash,activated_at)
 values('POS21 QA TRANSIENT','active',extensions.digest(convert_to('pos21-qa-only-token','UTF8'),'sha256'),now())
 returning id into v_term;
 insert into public.pos_shifts(employee_id,terminal_id,status,opening_cash)
 values(v_emp,v_term,'open',0) returning id into v_shift;
 select p.id,v.id,round(coalesce(v.sale_price,v.price,p.sale_price,p.price),2),v.stock
 into v_product,v_variant,v_original,v_stock_before
 from public.product_variants v join public.products p on p.id=v.product_id
 where v.is_active and v.stock>0 and p.status='active' and p.pos_visible=true
 and coalesce(v.sale_price,v.price,p.sale_price,p.price)>100
 order by v.stock desc,v.id limit 1;
 if v_product is null then raise exception 'QA_NO_PRODUCT_AVAILABLE';end if;
 v_items:=jsonb_build_array(jsonb_build_object('product_id',v_product,'variant_id',v_variant,
    'quantity',1,'promotion_mode','percent','promotion_value',30));
 v_final:=public.pos21_promotional_unit_price(v_original,'percent',30);
 v_cash:=round(v_final*0.4,2);
 v_payments:=jsonb_build_array(
   jsonb_build_object('method','cash','amount',v_cash,'metadata',
      jsonb_build_object('pos_request_id',gen_random_uuid())),
   jsonb_build_object('method','transfer','amount',v_final-v_cash,'reference','POS21-QA-TRANSIENT')
 );
 begin
  perform public.pos_create_sale_v21('pos21-qa-only-token',v_items,v_payments,0,null,null);
  raise exception 'QA_UNAUTHORIZED_PROMOTION_SUCCEEDED';
 exception when others then
  if sqlerrm not like 'PROMOTION_ADMIN_APPROVAL_REQUIRED%' then raise;end if;
 end;
 v_token:=public.pos21_issue_promotion_approval(v_emp,v_items,'QA transaccional: prueba sin persistencia');
 v_sale:=public.pos_create_sale_v21('pos21-qa-only-token',v_items,v_payments,0,
   'QA mixed payment, rollback',v_token);
 v_sale_id:=(v_sale->>'sale_id')::uuid;
 if abs((v_sale->>'total')::numeric-v_final)>0.001 then
    raise exception 'QA_TOTAL_MISMATCH'; end if;
 if (select count(*) from public.pos_sale_items where sale_id=v_sale_id and
      discount_amount=round(v_original-v_final,2) and line_total=v_final)<>1
 then raise exception 'QA_LINE_DISCOUNT_NOT_SAVED'; end if;
 if (select count(*) from public.pos_payments where sale_id=v_sale_id)<>2
 then raise exception 'QA_MIXED_PAYMENTS_NOT_SAVED';end if;
 if (select count(*) from public.pos_sale_events where sale_id=v_sale_id and
       event_type in ('price_changed_by_promotion','mixed_payment_recorded'))<>2
 then raise exception 'QA_PROMOTION_EVENTS_MISSING';end if;
 select a.consumed_sale_id into v_approval_state from public.pos21_promotion_approvals a where a.token=v_token;
 if v_approval_state is distinct from v_sale_id then raise exception 'QA_APPROVAL_NOT_CONSUMED';end if;
 if (select v.stock from public.product_variants v where v.id=v_variant)<>v_stock_before-1
 then raise exception 'QA_STOCK_NOT_DEDUCTED';end if;
 raise notice 'QA_PASS: discounts, admin approval, mixed payments, stock, audit. Changes rolled back.';
end $qa$;
rollback;