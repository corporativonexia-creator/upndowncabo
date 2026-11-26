-- CANDIDATO NO APLICADO. Generar migración fechada con Supabase CLI y probar en local.
begin;
alter table public.pos_service_receptions
  add column order_lines jsonb check(order_lines is null or (jsonb_typeof(order_lines)='array' and jsonb_array_length(order_lines) between 1 and 20)),
  add column order_request jsonb,
  add column order_revision integer not null default 0,
  add column order_events jsonb not null default '[]'::jsonb;

create or replace function public.pos_reception_access(p_device_token text)
returns jsonb language plpgsql security definer set search_path=''
as $access$
declare e public.pos_employees%rowtype; t public.pos_terminals%rowtype;
begin
  if not public.pos_is_session_active() then raise exception 'POS_SESSION_REVOKED'; end if;
  select * into e from public.pos_employees where auth_user_id=auth.uid() and status='active';
  if not found then raise exception 'POS_EMPLOYEE_NOT_ACTIVE'; end if;
  select * into t from public.pos_terminals
    where status='active' and device_token_hash=extensions.digest(coalesce(p_device_token,''),'sha256');
  if not found then raise exception 'TERMINAL_NOT_AUTHORIZED'; end if;
  return jsonb_build_object('employee_id',e.id,'employee_number',e.employee_number,
    'employee_name',e.full_name,'employee_role',e.role,'terminal_id',t.id,'terminal_name',t.name);
end;
$access$;
revoke all on function public.pos_reception_access(text) from PUBLIC,anon,authenticated;
grant execute on function public.pos_reception_access(text) to authenticated;


create or replace function public.pos_reception_create_multi(
  p_device_token text,p_request_id uuid,p_customer_name text,p_customer_phone text,p_lines jsonb
) returns jsonb language plpgsql security definer set search_path=''
as $multi$
declare a jsonb; r public.pos_service_receptions%rowtype; l jsonb; first_line jsonb;
  svc public.products%rowtype; normalized jsonb:='[]'::jsonb; saved jsonb;
  eq integer; qty integer; description text; work text; condition text; accessories text;
begin
  a:=public.pos_reception_access(p_device_token);
  if p_request_id is null then raise exception 'REQUEST_ID_REQUIRED'; end if;
  if jsonb_typeof(p_lines) is distinct from 'array' then raise exception 'MULTISERVICE_LINES_REQUIRED'; end if;
  if jsonb_array_length(p_lines) not between 1 and 20 then raise exception 'MULTISERVICE_LINE_LIMIT'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
  select * into r from public.pos_service_receptions where request_id=p_request_id for update;
  if found then
    if r.employee_id<>(a->>'employee_id')::uuid or r.customer_name<>btrim(coalesce(p_customer_name,'')) or
      r.customer_phone<>btrim(coalesce(p_customer_phone,'')) or r.order_request is distinct from p_lines then
      raise exception 'RECEPTION_REQUEST_CONFLICT';
    end if;
    return to_jsonb(r)-'order_request'-'order_events';
  end if;
  for l in select value from jsonb_array_elements(p_lines) loop
    if jsonb_typeof(l) is distinct from 'object' or coalesce(l->>'equipment_key','') !~ '^[1-9][0-9]{0,8}$'
      or coalesce(l->>'quantity','') !~ '^[1-9][0-9]{0,2}$' then raise exception 'MULTISERVICE_LINE_INVALID'; end if;
    eq:=(l->>'equipment_key')::int; qty:=(l->>'quantity')::int;
    description:=btrim(coalesce(l->>'equipment_description','')); work:=btrim(coalesce(l->>'work_description',''));
    condition:=btrim(coalesce(l->>'condition_notes',''));
    accessories:=coalesce(nullif(btrim(coalesce(l->>'accessories','')),''),'No especificados');
    if qty not between 1 and 100 or length(description) not between 3 and 240 or length(work) not between 5 and 240 or
      length(condition) not between 3 and 240 or length(accessories)>120 then raise exception 'MULTISERVICE_LINE_INVALID'; end if;
    if exists(select 1 from jsonb_array_elements(normalized) x where (x->>'equipment_key')::int=eq and
      (x->>'equipment_description'<>description or x->>'condition_notes'<>condition or x->>'accessories'<>accessories))
      then raise exception 'MULTISERVICE_EQUIPMENT_CONFLICT'; end if;
    select * into svc from public.products where id=(l->>'service_product_id')::uuid and is_service and pos_visible and status='active';
    if not found then raise exception 'SERVICE_NOT_AVAILABLE'; end if;
    normalized:=normalized||jsonb_build_array(jsonb_build_object(
      'equipment_key',eq,'equipment_description',description,'condition_notes',condition,'accessories',accessories,
      'service_product_id',svc.id,'service_name',svc.name,'work_description',work,'quantity',qty,'status','pending','price_cents',null));
  end loop;
  first_line:=normalized->0;
  saved:=public.pos_reception_create(p_device_token,p_request_id,p_customer_name,p_customer_phone,
    first_line->>'equipment_description',(first_line->>'service_product_id')::uuid,first_line->>'work_description',
    first_line->>'condition_notes',first_line->>'accessories');
  update public.pos_service_receptions set order_lines=normalized,order_request=p_lines,
    order_events=jsonb_build_array(jsonb_build_object('event','created','at',now(),'employee_id',a->>'employee_id'))
    where id=(saved->>'id')::uuid and order_lines is null returning * into r;
  if not found then raise exception 'RECEPTION_REQUEST_CONFLICT'; end if;
  return to_jsonb(r)-'order_request'-'order_events';
end;
$multi$;
revoke all on function public.pos_reception_create_multi(text,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.pos_reception_create_multi(text,uuid,text,text,jsonb) to authenticated;

create or replace function public.pos_reception_update_multi_line(
  p_device_token text,p_reception_id uuid,p_revision int,p_line_index int,p_price_cents bigint,p_status text
) returns jsonb language plpgsql security definer set search_path=''
as $line$
declare a jsonb; r public.pos_service_receptions%rowtype; old_line jsonb; new_line jsonb; employee_role text;
begin
  a:=public.pos_reception_access(p_device_token);
  select role into employee_role from public.pos_employees where id=(a->>'employee_id')::uuid and status='active';
  select * into r from public.pos_service_receptions where id=p_reception_id for update;
  if not found or r.order_lines is null or r.status<>'received' then raise exception 'MULTISERVICE_NOT_EDITABLE'; end if;
  if p_revision is distinct from r.order_revision then raise exception 'MULTISERVICE_STALE_REVISION'; end if;
  if p_line_index is null or p_line_index<0 or p_line_index>=jsonb_array_length(r.order_lines)
    or p_status is null or p_status not in ('pending','approved','in_progress','finished','cancelled')
    or (p_price_cents is not null and (p_price_cents<1 or p_price_cents>9999999900))
    then raise exception 'MULTISERVICE_LINE_INVALID'; end if;
  old_line:=r.order_lines->p_line_index;
  if old_line->>'status'='cancelled' then raise exception 'MULTISERVICE_LINE_CANCELLED'; end if;
  if (p_price_cents is distinct from (old_line->>'price_cents')::bigint or
    p_status in ('approved','cancelled') and p_status<>old_line->>'status')
    and coalesce(employee_role,'') not in ('pos_admin','supervisor') then raise exception 'MULTISERVICE_MANAGER_REQUIRED'; end if;
  if p_status in ('approved','in_progress','finished') and p_price_cents is null then raise exception 'MULTISERVICE_PRICE_REQUIRED'; end if;
  if p_status<>'cancelled' and p_price_cents is distinct from (old_line->>'price_cents')::bigint and p_status not in ('pending','approved')
    then raise exception 'MULTISERVICE_REAPPROVAL_REQUIRED'; end if;
  if (p_status='in_progress' and old_line->>'status' not in ('approved','in_progress'))
    or (p_status='finished' and old_line->>'status' not in ('approved','in_progress','finished'))
    then raise exception 'MULTISERVICE_APPROVAL_REQUIRED'; end if;
  if p_price_cents is not null and p_price_cents::numeric*(old_line->>'quantity')::int>9999999900 then raise exception 'MULTISERVICE_AMOUNT_LIMIT'; end if;
  new_line:=old_line||jsonb_build_object('price_cents',p_price_cents,'status',p_status);
  update public.pos_service_receptions set order_lines=jsonb_set(order_lines,array[p_line_index::text],new_line),
    order_revision=order_revision+1,order_events=order_events||jsonb_build_array(jsonb_build_object('event','line_updated','at',now(),
    'employee_id',a->>'employee_id','index',p_line_index,'before',old_line,'after',new_line))
    where id=r.id returning * into r;
  return to_jsonb(r)-'order_request'-'order_events';
end;
$line$;
revoke all on function public.pos_reception_update_multi_line(text,uuid,int,int,bigint,text) from public,anon,authenticated;
grant execute on function public.pos_reception_update_multi_line(text,uuid,int,int,bigint,text) to authenticated;

create or replace function public.pos_reception_recent(p_device_token text,p_search text default '')
returns jsonb language plpgsql security definer set search_path=''
as $recent$
declare a jsonb; term text:=btrim(coalesce(p_search,'')); result jsonb;
begin
  a:=public.pos_reception_access(p_device_token);
  if length(term)>80 then raise exception 'SEARCH_TOO_LONG'; end if;
  select coalesce(jsonb_agg((to_jsonb(x)-'order_request'-'order_events') order by x.received_at desc,x.receipt_number desc),'[]'::jsonb)
    into result from (
      select r.* from public.pos_service_receptions r
      where term='' or r.receipt_number::text=regexp_replace(upper(term),'^SR-0*','','g') or
      r.customer_name ilike ('%'||term||'%') or r.customer_phone ilike ('%'||term||'%') or
      r.equipment_description ilike ('%'||term||'%') or exists(select 1 from jsonb_array_elements(r.order_lines) l where l->>'equipment_description' ilike ('%'||term||'%') or l->>'service_name' ilike ('%'||term||'%'))
      order by r.received_at desc,r.receipt_number desc limit 40
    ) x;
  return result;
end;
$recent$;
revoke all on function public.pos_reception_recent(text,text) from PUBLIC,anon,authenticated;
grant execute on function public.pos_reception_recent(text,text) to authenticated;


create or replace function public.pos_reception_set_ready(p_device_token text,p_reception_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $ready$
declare a jsonb; r public.pos_service_receptions%rowtype;
begin
  a:=public.pos_reception_access(p_device_token);
  select * into r from public.pos_service_receptions
    where id=p_reception_id for update;
  if not found then raise exception 'RECEPTION_NOT_FOUND'; end if;
  if r.status='delivered' then raise exception 'RECEPTION_ALREADY_DELIVERED'; end if;
  if r.order_lines is not null and (not exists(select 1 from jsonb_array_elements(r.order_lines) l where l->>'status'<>'cancelled') or exists(select 1 from jsonb_array_elements(r.order_lines) l where l->>'status'<>'cancelled' and (l->>'status'<>'finished' or l->>'price_cents' is null))) then raise exception 'MULTISERVICE_NOT_FINISHED'; end if;
  if r.status='received' then
    update public.pos_service_receptions
      set status='ready', ready_at=now()
      where id=r.id returning * into r;
  end if;
  return to_jsonb(r)-'order_request'-'order_events';
end;
$ready$;
revoke all on function public.pos_reception_set_ready(text,uuid) from PUBLIC,anon,authenticated;
grant execute on function public.pos_reception_set_ready(text,uuid) to authenticated;


create or replace function public.pos_reception_checkout(
  p_device_token text,p_reception_id uuid,p_items jsonb,p_payments jsonb,
  p_discount_amount numeric default 0,p_notes text default null,
  p_promo_approval_token uuid default null
) returns jsonb language plpgsql security definer set search_path=''
as $checkout$
declare
  a jsonb; r public.pos_service_receptions%rowtype;
  item jsonb; sale jsonb; previous_sale public.pos_sales%rowtype;
  v_service_lines int;
begin
  a:=public.pos_reception_access(p_device_token);
  if p_reception_id is null then raise exception 'RECEPTION_ID_REQUIRED'; end if;
  select * into r from public.pos_service_receptions
    where id=p_reception_id for update;
  if not found then raise exception 'RECEPTION_NOT_FOUND'; end if;
  if r.status='delivered' then
    -- A network retry with the SAME checkout request returns the original sale.
    -- All other attempts are rejected, preventing a duplicated payment.
    select * into previous_sale from public.pos_sales where id=r.checkout_sale_id;
    if found and previous_sale.status='completed'
      and nullif(previous_sale.metadata->>'pos_request_id','') is not null
      and previous_sale.metadata->>'pos_request_id' = p_payments #>> '{0,metadata,pos_request_id}'
      and previous_sale.metadata->'request_payload' = jsonb_build_object(
        'items',p_items,'payments',p_payments,'discount',p_discount_amount,
        'notes',p_notes,'approval',p_promo_approval_token) then
      return jsonb_build_object('ok',true,'sale_id',previous_sale.id,
        'sale_number',previous_sale.sale_number,'total',previous_sale.total,
        'currency',previous_sale.currency,'subtotal',previous_sale.subtotal,
        'discount_amount',previous_sale.discount_amount,'replayed',true,
        'service_reception_id',r.id,'service_reception_status','delivered');
    end if;
    raise exception 'RECEPTION_ALREADY_DELIVERED';
  end if;
  if r.status<>'ready' then raise exception 'RECEPTION_NOT_READY'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'SALE_ITEMS_REQUIRED'; end if;
  if jsonb_array_length(p_items)=0 then raise exception 'SALE_ITEMS_REQUIRED'; end if;
  if r.order_lines is not null then
    if not exists(select 1 from jsonb_array_elements(r.order_lines) l where l->>'status'<>'cancelled')
      or exists(select 1 from jsonb_array_elements(r.order_lines) l where l->>'status'<>'cancelled'
      and (l->>'status'<>'finished' or l->>'price_cents' is null)) then raise exception 'MULTISERVICE_NOT_FINISHED'; end if;
    if exists (
      select 1 from (
        select l->>'service_product_id' product_id, sum((l->>'price_cents')::numeric*(l->>'quantity')::int) cents
        from jsonb_array_elements(r.order_lines) l where l->>'status'<>'cancelled' group by 1
      ) g where not exists(select 1 from public.products p where p.id=g.product_id::uuid and p.status='active' and p.pos_visible and p.is_service)
        or (select count(*) from jsonb_array_elements(p_items) x where x->>'product_id'=g.product_id)<>1
        or not exists(select 1 from jsonb_array_elements(p_items) x where x->>'product_id'=g.product_id
          and x->>'quantity'='1' and not (x ? 'variant_id') and jsonb_typeof(x->'service_unit_price')='number'
          and (x->>'service_unit_price')::numeric*100=g.cents)
    ) then raise exception 'MULTISERVICE_ITEMS_OR_PRICES_INVALID'; end if;
  else
  select count(*) into v_service_lines
  from jsonb_array_elements(p_items) as x
  where x->>'product_id'=r.service_product_id::text;
  if v_service_lines<>1 then raise exception 'RECEPTION_SERVICE_REQUIRED_ONCE'; end if;
  select x into item from jsonb_array_elements(p_items) x
  where x->>'product_id'=r.service_product_id::text;
  if (item->>'quantity') is distinct from '1'
    or item ? 'variant_id'
    or jsonb_typeof(item->'service_unit_price') is distinct from 'number'
    or (item->>'service_unit_price')::numeric<=0 then
    raise exception 'RECEPTION_SERVICE_PRICE_OR_QUANTITY_INVALID';
  end if;
  -- No se acepta una orden asociada a una variante ni a un servicio eliminado.
  if not exists(select 1 from public.products
    where id=r.service_product_id and status='active' and pos_visible=true and is_service=true)
    then raise exception 'RECEPTION_SERVICE_NOT_AVAILABLE';
  end if;
  end if;
  sale:=public.pos_create_sale_v22(
    p_device_token,p_items,p_payments,p_discount_amount,p_notes,p_promo_approval_token
  );
  if coalesce((sale->>'ok')::boolean,false) is distinct from true
    or nullif(sale->>'sale_id','') is null then
    raise exception 'RECEPTION_SALE_NOT_CONFIRMED';
  end if;
  update public.pos_service_receptions
    set status='delivered', delivered_at=now(),checkout_sale_id=(sale->>'sale_id')::uuid
    where id=r.id;
  return sale || jsonb_build_object('service_reception_id',r.id,'service_reception_folio',
    'SR-'||lpad(r.receipt_number::text,6,'0'),'service_reception_status','delivered');
end;
$checkout$;
revoke all on function public.pos_reception_checkout(text,uuid,jsonb,jsonb,numeric,text,uuid)
  from PUBLIC,anon,authenticated;
grant execute on function public.pos_reception_checkout(text,uuid,jsonb,jsonb,numeric,text,uuid)
  to authenticated;

commit;
