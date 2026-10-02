create or replace function public.admin_inventory_movement_log(p_limit integer default 200)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  return jsonb_build_object('rows',coalesce((
    select jsonb_agg(to_jsonb(x) order by x.created_at desc)
    from (
      select m.id,m.created_at,m.movement_type,m.quantity_change,m.stock_before,m.stock_after,m.note,
             m.order_id,m.pos_sale_id,m.variant_id,m.product_id,
             p.name as product_name,coalesce(v.title,'Principal') as variant_title,
             coalesce(v.sku,p.sku) as sku,coalesce(v.barcode,p.barcode) as barcode
      from public.inventory_movements m
      left join public.products p on p.id=m.product_id
      left join public.product_variants v on v.id=m.variant_id
      order by m.created_at desc
      limit greatest(1,least(coalesce(p_limit,200),1000))
    ) x
  ),'[]'::jsonb));
end $$;
grant execute on function public.admin_inventory_movement_log(integer) to authenticated;
