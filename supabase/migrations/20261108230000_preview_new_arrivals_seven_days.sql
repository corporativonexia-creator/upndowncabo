-- UpNDown Web 2.0 · New arrivals (7-day window).
-- Additive only. Does not modify stock, variants, orders or legacy featured flags.
-- Existing products are NOT retroactively classified as new after bulk imports.
do $setup$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='products' and column_name='new_arrival_enabled'
  ) then
    alter table public.products
      add column new_arrival_enabled boolean not null default false;
    -- Existing rows keep false; new rows default true.
    alter table public.products
      alter column new_arrival_enabled set default true;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='products' and column_name='new_arrival_at'
  ) then
    alter table public.products add column new_arrival_at timestamptz;
  end if;
end
$setup$;

comment on column public.products.new_arrival_enabled is
  'Whether the product participates in the seven-day New Arrivals display.';
comment on column public.products.new_arrival_at is
  'Start time of the active New Arrivals seven-day window; null means no active window.';

create or replace function public.stamp_product_new_arrival()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $fn$
begin
  if not coalesce(new.new_arrival_enabled, false) then
    new.new_arrival_at := null;
    return new;
  end if;

  if new.status = 'active' and new.online_visible = true then
    if tg_op = 'INSERT' then
      new.new_arrival_at := coalesce(new.new_arrival_at, statement_timestamp());
    elsif (not old.new_arrival_enabled)
       or (old.status <> 'active')
       or (old.online_visible is distinct from true) then
      new.new_arrival_at := statement_timestamp();
    end if;
  end if;

  return new;
end
$fn$;

drop trigger if exists trg_stamp_product_new_arrival on public.products;
create trigger trg_stamp_product_new_arrival
  before insert or update of status, online_visible, new_arrival_enabled, new_arrival_at
  on public.products
  for each row execute function public.stamp_product_new_arrival();

create index if not exists products_new_arrival_lookup_idx
  on public.products(new_arrival_at desc)
  where new_arrival_enabled = true and status = 'active' and online_visible = true;
