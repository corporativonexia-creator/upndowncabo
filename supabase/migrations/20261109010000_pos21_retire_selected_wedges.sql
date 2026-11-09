-- POS 2.1 / Phase 1 - irreversible-to-catalog archival of eleven exact EAN13.
-- Preserve stock snapshots, sale and inventory movement foreign-key history.
-- Do not physically delete referenced products or modify their stock quantities.
begin;
create table if not exists public.pos21_product_retirements (
  product_id uuid primary key,
  barcode text not null,
  sku text not null,
  archived_at timestamptz not null default now(),
  original_product jsonb not null,
  original_variants jsonb not null,
  inventory_movement_count integer not null,
  reason text not null
);
alter table public.pos21_product_retirements enable row level security;
revoke all on public.pos21_product_retirements from public, anon, authenticated;
alter table public.products drop constraint if exists products_at_least_one_sales_channel;
alter table public.products add constraint products_at_least_one_sales_channel
  check (status='archived' or online_visible or pos_visible);
do $archive$
declare v_ids uuid[];
declare v_count integer;
declare v_stock integer;
begin
  select array_agg(id order by barcode),count(*),sum(stock)
    into v_ids,v_count,v_stock
  from public.products
  where barcode in (
    '2000000005966','2000000005591','2000000005669',
    '2000000005188','2000000005201','2000000005249',
    '2000000005263','2000000005164','2000000005157',
    '2000000005317','2000000006413'
  );
  if v_count<>11 then raise exception 'POS21_RETIREMENT_MISMATCH: %/11',v_count;end if;
  if v_stock<>6 then raise exception 'POS21_REMAINING_STOCK_MISMATCH: %/6',v_stock;end if;
  if exists(select 1 from public.pos21_product_retirements where product_id=any(v_ids)) then
    raise exception 'POS21_RETIREMENTS_ALREADY_APPLIED';
  end if;
  insert into public.pos21_product_retirements(
    product_id,barcode,sku,original_product,original_variants,inventory_movement_count,reason
  )
  select p.id,p.barcode,p.sku,to_jsonb(p),
    coalesce((select jsonb_agg(to_jsonb(v)) from public.product_variants v where v.product_id=p.id),'[]'::jsonb),
    (select count(*) from public.inventory_movements m where m.product_id=p.id),
    'POS 2.1 - Retiro autorizado por terminación exacta de EAN13; conservar historial y existencias para conciliación física'
  from public.products p where p.id=any(v_ids);
  update public.products set status='archived',online_visible=false,pos_visible=false,
    featured=false,new_arrival_enabled=false,updated_at=now() where id=any(v_ids);
  update public.product_variants set is_active=false,updated_at=now() where product_id=any(v_ids);
  if (select count(*) from public.products where id=any(v_ids) and status='archived'
     and not pos_visible and not online_visible)<>11 then
    raise exception 'POS21_ARCHIVE_NOT_COMPLETE';
  end if;
end
$archive$;
commit;