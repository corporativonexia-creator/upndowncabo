-- POS 2.1: preserve all stock counters when archiving.
-- Archived parent status blocks sale; variant active status need not be disabled.
begin;
update public.product_variants v
set is_active = (original.variant->>'is_active')::boolean,
    updated_at=now()
from public.pos21_product_retirements a
cross join lateral jsonb_array_elements(a.original_variants) as original(variant)
where v.product_id=a.product_id and v.id=(original.variant->>'id')::uuid;
do $check$
declare actual integer; expected integer;
begin
 select sum(p.stock),sum((a.original_product->>'stock')::integer) into actual, expected
 from public.pos21_product_retirements a join public.products p on p.id=a.product_id;
 if actual is distinct from expected then raise exception 'STOCK_NOT_RESTORED: % vs %',actual,expected;end if;
 if exists (select 1 from public.products p join public.pos21_product_retirements a on a.product_id=p.id
 where p.status<>'archived' or p.pos_visible or p.online_visible) then raise exception 'RETIRED_PRODUCT_BECAME_VISIBLE';end if;
end $check$;
commit;