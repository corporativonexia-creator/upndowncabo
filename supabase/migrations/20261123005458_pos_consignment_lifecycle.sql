-- Consignaciones: custodia separada de servicios y liquidacion por propietario.
-- NO se altera el motor de cobro POS: los eventos se vinculan en la misma transaccion.
begin;

create table public.pos_consignments (
  id uuid primary key default gen_random_uuid(),
  receipt_number bigint generated always as identity unique,
  request_id uuid not null unique,
  owner_name text not null check (length(btrim(owner_name)) between 2 and 140),
  owner_phone text not null check (length(btrim(owner_phone)) between 7 and 30),
  equipment_description text not null check (length(btrim(equipment_description)) between 3 and 500),
  condition_notes text not null check (length(btrim(condition_notes)) between 3 and 1000),
  accessories text not null default 'Sin accesorios',
  agreed_payout numeric(12,2) not null check (agreed_payout > 0),
  asking_price numeric(12,2) not null check (asking_price >= agreed_payout),
  expires_on date,
  payout_business_days int not null default 2 check (payout_business_days between 0 and 60),
  status text not null default 'received' check (status in
    ('received','on_sale','sold_pending','paid','returned','refunded','refunded_paid')),
  product_id uuid unique references public.products(id) on delete restrict,
  sale_id uuid unique references public.pos_sales(id) on delete restrict,
  sale_item_id uuid unique references public.pos_sale_items(id) on delete restrict,
  sold_price numeric(12,2),
  sold_at timestamptz,
  payout_due_on date,
  paid_at timestamptz,
  received_by uuid not null references public.pos_employees(id) on delete restrict,
  returned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pos_consignments_state_idx on public.pos_consignments(status,created_at desc);
create index pos_consignments_owner_idx on public.pos_consignments(lower(owner_name));

create table public.pos_consignment_payouts (
  id uuid primary key default gen_random_uuid(),
  consignment_id uuid not null unique references public.pos_consignments(id) on delete restrict,
  request_id uuid not null unique,
  amount numeric(12,2) not null check (amount > 0),
  method text not null check (method in ('cash','transfer','other')),
  reference text,
  recipient_confirmed boolean not null default false,
  employee_id uuid not null references public.pos_employees(id) on delete restrict,
  shift_id uuid references public.pos_shifts(id) on delete restrict,
  created_at timestamptz not null default now()
);

-- Los datos de propietarios y pagos se consultan solo por RPC autorizadas.
alter table public.pos_consignments enable row level security;
alter table public.pos_consignment_payouts enable row level security;
revoke all on public.pos_consignments,public.pos_consignment_payouts from public,anon,authenticated;
revoke all on sequence public.pos_consignments_receipt_number_seq from public,anon,authenticated;

create or replace function public.pos_consignment_manager(p_device_token text)
returns jsonb language plpgsql security definer set search_path=''
as $manager$
declare a jsonb; v_role text;
begin
  a:=public.pos_reception_access(p_device_token);
  select role into v_role from public.pos_employees where id=(a->>'employee_id')::uuid and status='active';
  if v_role not in ('pos_admin','supervisor') or v_role is null
    then raise exception 'CONSIGNMENT_MANAGER_REQUIRED'; end if;
  return a;
end;
$manager$;
revoke all on function public.pos_consignment_manager(text) from public,anon,authenticated;
grant execute on function public.pos_consignment_manager(text) to authenticated;

create or replace function public.pos_consignment_create(
  p_device_token text,p_request_id uuid,p_owner_name text,p_owner_phone text,
  p_equipment_description text,p_condition_notes text,p_accessories text,
  p_agreed_payout numeric,p_asking_price numeric,p_expires_on date default null,
  p_payout_business_days integer default 2
) returns jsonb language plpgsql security definer set search_path=''
as $receive$
declare a jsonb; r public.pos_consignments%rowtype;
begin
  a:=public.pos_consignment_manager(p_device_token);
  if p_request_id is null then raise exception 'REQUEST_ID_REQUIRED'; end if;
  if length(btrim(coalesce(p_owner_name,''))) not between 2 and 140
    or length(btrim(coalesce(p_owner_phone,''))) not between 7 and 30
    or length(btrim(coalesce(p_equipment_description,''))) not between 3 and 500
    or length(btrim(coalesce(p_condition_notes,''))) not between 3 and 1000
    then raise exception 'CONSIGNMENT_REQUIRED_FIELDS'; end if;
  if p_agreed_payout is null or p_agreed_payout <= 0 or p_asking_price is null or p_asking_price < p_agreed_payout
    then raise exception 'CONSIGNMENT_INVALID_PRICE'; end if;
  if p_expires_on is not null and p_expires_on < current_date
    then raise exception 'CONSIGNMENT_EXPIRED'; end if;
  if p_payout_business_days is null or p_payout_business_days not between 0 and 60
    then raise exception 'CONSIGNMENT_INVALID_PAYOUT_TERM'; end if;
  insert into public.pos_consignments(
    request_id,owner_name,owner_phone,equipment_description,condition_notes,accessories,
    agreed_payout,asking_price,expires_on,payout_business_days,received_by
  ) values (
    p_request_id,btrim(p_owner_name),btrim(p_owner_phone),btrim(p_equipment_description),
    btrim(p_condition_notes),coalesce(nullif(btrim(coalesce(p_accessories,'')),''),'Sin accesorios'),
    round(p_agreed_payout,2),round(p_asking_price,2),p_expires_on,p_payout_business_days,
    (a->>'employee_id')::uuid
  ) on conflict (request_id) do nothing returning * into r;
  if not found then
    select * into r from public.pos_consignments where request_id=p_request_id;
    if not found or r.received_by<>(a->>'employee_id')::uuid
      or r.owner_name<>btrim(p_owner_name) or r.owner_phone<>btrim(p_owner_phone)
      or r.equipment_description<>btrim(p_equipment_description)
      or r.agreed_payout<>round(p_agreed_payout,2) or r.asking_price<>round(p_asking_price,2)
      or r.condition_notes<>btrim(p_condition_notes)
      or r.accessories<>coalesce(nullif(btrim(coalesce(p_accessories,'')),''),'Sin accesorios')
      or r.expires_on is distinct from p_expires_on or r.payout_business_days<>p_payout_business_days
      then raise exception 'CONSIGNMENT_REQUEST_CONFLICT'; end if;
  end if;
  return to_jsonb(r);
end;
$receive$;
revoke all on function public.pos_consignment_create(text,uuid,text,text,text,text,text,numeric,numeric,date,integer) from public,anon,authenticated;
grant execute on function public.pos_consignment_create(text,uuid,text,text,text,text,text,numeric,numeric,date,integer) to authenticated;

-- Producto fisico unico: CG + numero, UPC externo opcional en la descripcion.
-- Se evita mezclar una misma variante de varios propietarios.
create or replace function public.pos_consignment_publish(
  p_device_token text,p_consignment_id uuid,p_category_id uuid,p_product_name text,
  p_brand text default null,p_model text default null
) returns jsonb language plpgsql security definer set search_path=''
as $publish$
declare a jsonb; r public.pos_consignments%rowtype; v_folio text; v_product uuid; v_variant uuid;
begin
  a:=public.pos_consignment_manager(p_device_token);
  select * into r from public.pos_consignments where id=p_consignment_id for update;
  if not found then raise exception 'CONSIGNMENT_NOT_FOUND'; end if;
  if r.status='on_sale' and r.product_id is not null then return to_jsonb(r); end if;
  if r.status<>'received' or r.product_id is not null then raise exception 'CONSIGNMENT_NOT_PUBLISHABLE'; end if;
  if r.expires_on is not null and r.expires_on<current_date then raise exception 'CONSIGNMENT_EXPIRED'; end if;
  if length(btrim(coalesce(p_product_name,'')))<3 then raise exception 'CONSIGNMENT_PRODUCT_NAME_REQUIRED'; end if;
  if p_category_id is null or not exists(select 1 from public.categories where id=p_category_id)
    then raise exception 'CONSIGNMENT_CATEGORY_REQUIRED'; end if;
  v_folio:='CG'||lpad(r.receipt_number::text,6,'0');
  insert into public.products(
    category_id,sku,barcode,name,slug,brand,model,item_condition,currency,
    price,stock,status,online_visible,pos_visible,description
  ) values (
    p_category_id,v_folio,v_folio,btrim(p_product_name),'consignacion-'||lower(v_folio),
    nullif(btrim(coalesce(p_brand,'')),''),nullif(btrim(coalesce(p_model,'')),''),
    'used','MXN',r.asking_price,0,'active',false,true,
    r.equipment_description||E'\nEstado al recibir: '||r.condition_notes
  ) returning id into v_product;
  insert into public.product_variants(product_id,title,sku,barcode,price,stock,is_default,is_active)
  values(v_product,'Única',v_folio,v_folio,r.asking_price,1,true,true)
  returning id into v_variant;
  insert into public.inventory_movements(
    product_id,variant_id,movement_type,quantity_change,stock_before,stock_after,note
  ) values(v_product,v_variant,'restock',1,0,1,'Entrada en custodia · '||v_folio);
  update public.pos_consignments set product_id=v_product,status='on_sale',updated_at=now()
  where id=r.id returning * into r;
  return to_jsonb(r);
end;
$publish$;
revoke all on function public.pos_consignment_publish(text,uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.pos_consignment_publish(text,uuid,uuid,text,text,text) to authenticated;

create or replace function public.pos_consignment_add_business_days(p_day date,p_days integer)
returns date language plpgsql immutable set search_path=''
as $days$
declare result date:=p_day; n int:=0;
begin
  while n<p_days loop
    result:=result+1;
    if extract(isodow from result)<6 then n:=n+1; end if;
  end loop;
  return result;
end;
$days$;
revoke all on function public.pos_consignment_add_business_days(date,integer) from public,anon,authenticated;

-- AFTER INSERT en venta: el registro de deuda queda en la misma transaccion del cobro.
create or replace function public.pos_consignment_on_sale_item()
returns trigger language plpgsql security definer set search_path=''
as $sale$
declare r public.pos_consignments%rowtype; s public.pos_sales%rowtype;
begin
  select * into r from public.pos_consignments where product_id=new.product_id for update;
  if not found then return new; end if;
  if r.status<>'on_sale' then raise exception 'CONSIGNMENT_NOT_AVAILABLE'; end if;
  if r.expires_on is not null and r.expires_on<timezone('America/Mazatlan',now())::date
    then raise exception 'CONSIGNMENT_EXPIRED'; end if;
  select * into s from public.pos_sales where id=new.sale_id;
  if not found or s.status<>'completed' then raise exception 'CONSIGNMENT_SALE_INVALID'; end if;
  if new.quantity<>1 or new.discount_amount<>0
    or coalesce((s.metadata->>'global_discount_amount')::numeric,0)<>0
    or new.line_total<r.agreed_payout
    then raise exception 'CONSIGNMENT_DISCOUNT_OR_PRICE_NOT_ALLOWED'; end if;
  update public.pos_consignments set
    status='sold_pending',sale_id=s.id,sale_item_id=new.id,sold_price=new.line_total,
    sold_at=coalesce(s.completed_at,now()),
    payout_due_on=public.pos_consignment_add_business_days(
      timezone('America/Mazatlan',coalesce(s.completed_at,now()))::date,r.payout_business_days),
    updated_at=now()
  where id=r.id;
  return new;
end;
$sale$;
create trigger trg_pos_consignment_sold after insert on public.pos_sale_items
for each row execute function public.pos_consignment_on_sale_item();
revoke all on function public.pos_consignment_on_sale_item() from public,anon,authenticated;

-- No borrar evidencia financiera: una devolucion despues de pagar queda en disputa.
create or replace function public.pos_consignment_sale_reversed()
returns trigger language plpgsql security definer set search_path=''
as $reverse$
begin
  if new.status=old.status or new.status not in ('voided','refunded') then return new; end if;
  update public.pos_consignments set
    status=case when paid_at is null then 'refunded' else 'refunded_paid' end,
    updated_at=now()
  where sale_id=new.id and status in ('sold_pending','paid');
  return new;
end;
$reverse$;
create trigger trg_pos_consignment_reversal after update of status on public.pos_sales
for each row execute function public.pos_consignment_sale_reversed();
revoke all on function public.pos_consignment_sale_reversed() from public,anon,authenticated;

create or replace function public.pos_consignment_recent(p_device_token text,p_search text default '')
returns jsonb language plpgsql security definer set search_path=''
as $recent$
declare a jsonb; term text:=left(btrim(coalesce(p_search,'')),80); v_rows jsonb;
begin
  a:=public.pos_consignment_manager(p_device_token);
  select coalesce(jsonb_agg(to_jsonb(x) order by (x.status='sold_pending') desc,x.created_at desc),'[]'::jsonb) into v_rows
  from (select r.*,p.method as payout_method,p.reference as payout_reference,p.created_at as payout_recorded_at
    from public.pos_consignments r
    left join public.pos_consignment_payouts p on p.consignment_id=r.id
    where term='' or r.receipt_number::text=regexp_replace(upper(term),'^CG0*','','g')
      or r.owner_name ilike '%'||term||'%' or r.owner_phone ilike '%'||term||'%'
      or r.equipment_description ilike '%'||term||'%'
    order by (r.status='sold_pending') desc,r.created_at desc limit 100) x;
  return v_rows;
end;
$recent$;
revoke all on function public.pos_consignment_recent(text,text) from public,anon,authenticated;
grant execute on function public.pos_consignment_recent(text,text) to authenticated;

create or replace function public.pos_consignment_payout(
  p_device_token text,p_consignment_id uuid,p_request_id uuid,
  p_method text,p_reference text default null,p_recipient_confirmed boolean default false
) returns jsonb language plpgsql security definer set search_path=''
as $payout$
declare a jsonb; r public.pos_consignments%rowtype; v_shift public.pos_shifts%rowtype; p public.pos_consignment_payouts%rowtype;
begin
  a:=public.pos_consignment_manager(p_device_token);
  select * into r from public.pos_consignments where id=p_consignment_id for update;
  if not found then raise exception 'CONSIGNMENT_NOT_FOUND'; end if;
  if r.status='paid' then
    select * into p from public.pos_consignment_payouts where consignment_id=r.id;
    if found and p.request_id=p_request_id then return to_jsonb(p); end if;
    raise exception 'CONSIGNMENT_ALREADY_PAID';
  end if;
  if r.status<>'sold_pending' then raise exception 'CONSIGNMENT_NOT_PAYABLE'; end if;
  if not exists(select 1 from public.pos_sales where id=r.sale_id and status='completed')
    then raise exception 'CONSIGNMENT_SALE_NOT_COMPLETED'; end if;
  if p_request_id is null or p_method not in ('cash','transfer','other')
    then raise exception 'CONSIGNMENT_PAYMENT_INVALID'; end if;
  if p_method in ('transfer','other') and nullif(btrim(coalesce(p_reference,'')),'') is null
    then raise exception 'CONSIGNMENT_PAYMENT_REFERENCE_REQUIRED'; end if;
  if not p_recipient_confirmed then raise exception 'CONSIGNMENT_RECEIPT_CONFIRMATION_REQUIRED'; end if;
  if p_method='cash' then
    select * into v_shift from public.pos_shifts
      where terminal_id=(a->>'terminal_id')::uuid and status='open'
      order by opened_at desc limit 1 for update;
    if not found then raise exception 'CONSIGNMENT_CASH_SHIFT_REQUIRED'; end if;
  end if;
  insert into public.pos_consignment_payouts(
    consignment_id,request_id,amount,method,reference,recipient_confirmed,employee_id,shift_id
  ) values (
    r.id,p_request_id,r.agreed_payout,p_method,nullif(btrim(coalesce(p_reference,'')),''),
    p_recipient_confirmed,(a->>'employee_id')::uuid,
    case when p_method='cash' then v_shift.id else null end
  ) returning * into p;
  if p_method='cash' then
    insert into public.pos_cash_movements(
      shift_id,employee_id,terminal_id,movement_type,amount,reason,metadata
    ) values (
      v_shift.id,(a->>'employee_id')::uuid,(a->>'terminal_id')::uuid,
      'cash_out',r.agreed_payout,
      'Liquidación consignación CG'||lpad(r.receipt_number::text,6,'0'),
      jsonb_build_object('consignment_id',r.id,'payout_id',p.id)
    );
  end if;
  update public.pos_consignments set status='paid',paid_at=now(),updated_at=now() where id=r.id;
  return to_jsonb(p);
end;
$payout$;
revoke all on function public.pos_consignment_payout(text,uuid,uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.pos_consignment_payout(text,uuid,uuid,text,text,boolean) to authenticated;

create or replace function public.pos_consignment_return(p_device_token text,p_consignment_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $return$
declare a jsonb; r public.pos_consignments%rowtype; v public.product_variants%rowtype;
begin
  a:=public.pos_consignment_manager(p_device_token);
  select * into r from public.pos_consignments where id=p_consignment_id for update;
  if not found then raise exception 'CONSIGNMENT_NOT_FOUND'; end if;
  if r.status not in ('received','on_sale') then raise exception 'CONSIGNMENT_NOT_RETURNABLE'; end if;
  if r.product_id is not null then
    select * into v from public.product_variants where product_id=r.product_id and is_default=true for update;
    if not found or v.stock<>1 then raise exception 'CONSIGNMENT_STOCK_MISMATCH'; end if;
    update public.product_variants set stock=0,updated_at=now() where id=v.id;
    update public.products set status='archived',pos_visible=false,online_visible=true,updated_at=now() where id=r.product_id;
    insert into public.inventory_movements(
      product_id,variant_id,movement_type,quantity_change,stock_before,stock_after,note
    ) values(r.product_id,v.id,'supplier_return',-1,1,0,
      'Devolución al propietario · CG'||lpad(r.receipt_number::text,6,'0'));
  end if;
  update public.pos_consignments set status='returned',returned_at=now(),updated_at=now()
  where id=r.id returning * into r;
  return to_jsonb(r);
end;
$return$;
revoke all on function public.pos_consignment_return(text,uuid) from public,anon,authenticated;
grant execute on function public.pos_consignment_return(text,uuid) to authenticated;

commit;
