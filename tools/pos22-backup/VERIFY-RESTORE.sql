-- UpNDown Cabo POS 2.2 recovery preflight
-- Read-only. Run against the restored database and a consistent source snapshot.
-- Results contain aggregate business metrics: handle as confidential.
select current_setting('server_version') as postgres_version;
select
 (select count(*) from public.products) as products,
 (select count(*) from public.product_variants) as variants,
 (select count(*) from public.pos_sales) as sales,
 (select count(*) from public.pos_sale_items) as sale_items,
 (select count(*) from public.pos_payments) as payments,
 (select count(*) from public.pos_shifts) as shifts,
 (select count(*) from public.inventory_movements) as movements,
 (select coalesce(sum(stock),0) from public.products) as product_stock_sum,
 (select coalesce(sum(stock),0) from public.product_variants) as variant_stock_sum,
 (select coalesce(sum(total),0) from public.pos_sales) as sales_total_sum,
 (select coalesce(sum(amount),0) from public.pos_payments) as payment_total_sum;
select n.nspname as schema_name,p.proname as routine_name,
       pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef as security_definer
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
 'pos_create_sale_v21','pos_create_sale_v22',
 'pos_refund_sale_v21','pos22_match_promotion',
 'reserve_checkout_inventory','release_checkout_reservation',
 'reserve_checkout_inventory_v2','release_checkout_inventory_v2'
) order by p.proname;
select c.relname as table_name,c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in (
 'pos_sales','pos_sale_items','pos_payments','products',
 'product_variants','pos22_promotions','checkout_inventory_reservations',
 'checkout_v2_reservations'
) and c.relkind in ('r','p') order by c.relname;
