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
  received_at timestamptz not null default now()
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
commit;
