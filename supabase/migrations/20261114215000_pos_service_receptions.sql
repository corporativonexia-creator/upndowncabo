-- Recepción de equipos del taller: sin venta, turno ni movimientos de inventario.
begin;
create table public.pos_service_receptions (
  id uuid primary key default gen_random_uuid(),
  receipt_number bigint generated always as identity unique,
  request_id uuid not null unique,
  customer_name text not null check (length(btrim(customer_name)) between 2 and 140),
  customer_phone text not null check (length(btrim(customer_phone)) between 7 and 30),
  equipment_description text not null check (length(btrim(equipment_description)) between 3 and 240),
  service_product_id uuid not null references public.products(id) on delete restrict,
  service_name text not null check (length(btrim(service_name)) between 2 and 180),
  work_description text not null check (length(btrim(work_description)) between 5 and 1500),
  condition_notes text not null check (length(btrim(condition_notes)) between 3 and 1000),
  accessories text not null default 'No especificados' check (length(btrim(accessories)) between 1 and 400),
  employee_id uuid not null references public.pos_employees(id) on delete restrict,
  employee_number text not null,
  employee_name text not null,
  terminal_id uuid not null references public.pos_terminals(id) on delete restrict,
  terminal_name text not null,
  received_at timestamptz not null default now(),
  status text not null default 'received'
    check (status in ('received','ready','delivered')),
  ready_at timestamptz,
  delivered_at timestamptz,
  checkout_sale_id uuid unique references public.pos_sales(id) on delete restrict
);
create index pos_service_receptions_received_idx on public.pos_service_receptions(received_at desc);
create index pos_service_receptions_customer_idx on public.pos_service_receptions(lower(customer_name));
alter table public.pos_service_receptions enable row level security;
revoke all on public.pos_service_receptions from PUBLIC,anon,authenticated;
revoke all on sequence public.pos_service_receptions_receipt_number_seq from PUBLIC,anon,authenticated;

-- Validación del empleado y la terminal, sin exigir turno de caja.
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
    'employee_name',e.full_name,'terminal_id',t.id,'terminal_name',t.name);
end;
$access$;
revoke all on function public.pos_reception_access(text) from PUBLIC,anon,authenticated;
grant execute on function public.pos_reception_access(text) to authenticated;

-- Idempotencia por request_id: reintentos no crean otro equipo ni otro folio.
create or replace function public.pos_reception_create(
  p_device_token text, p_request_id uuid,
  p_customer_name text, p_customer_phone text,
  p_equipment_description text, p_service_product_id uuid,
  p_work_description text, p_condition_notes text, p_accessories text
) returns jsonb language plpgsql security definer set search_path=''
as $create$
declare
  a jsonb; svc public.products%rowtype; r public.pos_service_receptions%rowtype;
  v_name text:=btrim(coalesce(p_customer_name,''));
  v_phone text:=btrim(coalesce(p_customer_phone,''));
  v_equipment text:=btrim(coalesce(p_equipment_description,''));
  v_work text:=btrim(coalesce(p_work_description,''));
  v_condition text:=btrim(coalesce(p_condition_notes,''));
  v_accessories text:=coalesce(nullif(btrim(coalesce(p_accessories,'')),''),'No especificados');
begin
  a:=public.pos_reception_access(p_device_token);
  if p_request_id is null then raise exception 'REQUEST_ID_REQUIRED'; end if;
  if length(v_name) not between 2 and 140 then raise exception 'CUSTOMER_NAME_REQUIRED'; end if;
  if length(v_phone) not between 7 and 30 then raise exception 'CUSTOMER_PHONE_REQUIRED'; end if;
  if length(v_equipment) not between 3 and 240 then raise exception 'EQUIPMENT_REQUIRED'; end if;
  if length(v_work) not between 5 and 1500 then raise exception 'WORK_DESCRIPTION_REQUIRED'; end if;
  if length(v_condition) not between 3 and 1000 then raise exception 'CONDITION_REQUIRED'; end if;
  if length(v_accessories) > 400 then raise exception 'ACCESSORIES_TOO_LONG'; end if;
  select * into svc from public.products where id=p_service_product_id
    and is_service=true and pos_visible=true and status='active';
  if not found then raise exception 'SERVICE_NOT_AVAILABLE'; end if;
  insert into public.pos_service_receptions(
    request_id,customer_name,customer_phone,equipment_description,service_product_id,service_name,
    work_description,condition_notes,accessories,employee_id,employee_number,employee_name,terminal_id,terminal_name
  ) values (
    p_request_id,v_name,v_phone,v_equipment,svc.id,svc.name,
    v_work,v_condition,v_accessories,
    (a->>'employee_id')::uuid,a->>'employee_number',a->>'employee_name',
    (a->>'terminal_id')::uuid,a->>'terminal_name'
  ) on conflict(request_id) do nothing returning * into r;
  if not found then
    select * into r from public.pos_service_receptions where request_id=p_request_id;
    if not found or r.employee_id<>(a->>'employee_id')::uuid or
      r.customer_name<>v_name or r.customer_phone<>v_phone or
      r.equipment_description<>v_equipment or r.service_product_id<>svc.id or
      r.work_description<>v_work or r.condition_notes<>v_condition or
      r.accessories<>v_accessories then
      raise exception 'RECEPTION_REQUEST_CONFLICT';
    end if;
  end if;
  return to_jsonb(r);
end;
$create$;
revoke all on function public.pos_reception_create(text,uuid,text,text,text,uuid,text,text,text) from PUBLIC,anon,authenticated;
grant execute on function public.pos_reception_create(text,uuid,text,text,text,uuid,text,text,text) to authenticated;

create or replace function public.pos_reception_recent(p_device_token text,p_search text default '')
returns jsonb language plpgsql security definer set search_path=''
as $recent$
declare a jsonb; term text:=btrim(coalesce(p_search,'')); result jsonb;
begin
  a:=public.pos_reception_access(p_device_token);
  if length(term)>80 then raise exception 'SEARCH_TOO_LONG'; end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.received_at desc,x.receipt_number desc),'[]'::jsonb)
    into result from (
      select r.* from public.pos_service_receptions r
      where term='' or r.receipt_number::text=regexp_replace(upper(term),'^SR-0*','','g') or
      r.customer_name ilike ('%'||term||'%') or r.customer_phone ilike ('%'||term||'%') or
      r.equipment_description ilike ('%'||term||'%')
      order by r.received_at desc,r.receipt_number desc limit 40
    ) x;
  return result;
end;
$recent$;
revoke all on function public.pos_reception_recent(text,text) from PUBLIC,anon,authenticated;
grant execute on function public.pos_reception_recent(text,text) to authenticated;

-- Avance mínimo del taller: Recibido -> Listo para entregar.
-- Se conserva el ticket de recepción y el precio queda sin asignar.
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
  if r.status='received' then
    update public.pos_service_receptions
      set status='ready', ready_at=now()
      where id=r.id returning * into r;
  end if;
  return to_jsonb(r);
end;
$ready$;
revoke all on function public.pos_reception_set_ready(text,uuid) from PUBLIC,anon,authenticated;
grant execute on function public.pos_reception_set_ready(text,uuid) to authenticated;

-- Cobro atómico de una orden de taller usando EXACTAMENTE el motor POS 2.2.
-- El bloqueo del folio evita dos cobros concurrentes desde terminales distintas.
-- Si la venta falla, toda la transacción se revierte y la orden continúa abierta.
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
  select count(*) into v_service_lines
  from jsonb_array_elements(p_items) as x
  where x->>'product_id'=r.service_product_id::text;
  if v_service_lines<>1 then raise exception 'RECEPTION_SERVICE_REQUIRED_ONCE'; end if;
  select x into item from jsonb_array_elements(p_items) x
  where x->>'product_id'=r.service_product_id::text;
  if (item->>'quantity') is null
    or (item->>'quantity') !~ '^[0-9]+
    or (item->>'quantity')::int<>1
    or item ? 'variant_id'
    or not (item ? 'service_unit_price')
    or (item->>'service_unit_price') !~ '^[0-9]+(\.[0-9]{1,2})?
    or (item->>'service_unit_price')::numeric<=0 then
    raise exception 'RECEPTION_SERVICE_PRICE_OR_QUANTITY_INVALID';
  end if;
  -- No se acepta una orden asociada a una variante ni a un servicio eliminado.
  if not exists(select 1 from public.products
    where id=r.service_product_id and status='active' and pos_visible=true and is_service=true)
    then raise exception 'RECEPTION_SERVICE_NOT_AVAILABLE';
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
