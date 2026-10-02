-- Keep the legacy product-level POS identifier in sync while a product has one active variant.
-- This preserves current POS compatibility without changing the canonical variant inventory model.
create or replace function public.sync_single_variant_to_product()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_product_id uuid;
  v_count integer;
  v_variant public.product_variants%rowtype;
begin
  v_product_id := coalesce(new.product_id, old.product_id);

  select count(*) into v_count
  from public.product_variants
  where product_id=v_product_id and is_active=true;

  if v_count=1 then
    select * into v_variant
    from public.product_variants
    where product_id=v_product_id and is_active=true
    limit 1;

    update public.products
    set barcode=coalesce(nullif(btrim(v_variant.barcode),''),barcode),
        stock=coalesce(v_variant.stock,stock),
        updated_at=now()
    where id=v_product_id;
  end if;

  return coalesce(new,old);
end;
$$;

drop trigger if exists trg_sync_single_variant_to_product on public.product_variants;
create trigger trg_sync_single_variant_to_product
after insert or update or delete on public.product_variants
for each row execute function public.sync_single_variant_to_product();

with single_variant as (
  select product_id,
         max(barcode) filter (where is_active) as barcode,
         max(stock) filter (where is_active) as stock
  from public.product_variants
  group by product_id
  having count(*) filter (where is_active)=1
)
update public.products p
set barcode=coalesce(nullif(btrim(s.barcode),''),p.barcode),
    stock=coalesce(s.stock,p.stock),
    updated_at=now()
from single_variant s
where p.id=s.product_id;
