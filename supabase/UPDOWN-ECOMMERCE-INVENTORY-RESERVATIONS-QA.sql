-- ============================================================
-- UP AND DOWN · RESERVATIONS QA · SOLO LECTURA
-- ============================================================

-- 1. Reservas
select
  r.created_at,
  r.reservation_token,
  r.status,
  r.stripe_checkout_session_id,
  r.seller_ref,
  r.expires_at,
  r.consumed_at,
  r.released_at,
  r.release_reason
from public.checkout_inventory_reservations r
order by r.created_at desc
limit 50;


-- 2. Artículos de reservas
select
  r.reservation_token,
  r.status,
  r.expires_at,
  i.product_id,
  i.sku,
  i.product_name,
  i.quantity,
  i.unit_price,
  i.stock_before,
  i.stock_after,
  p.stock as current_stock
from public.checkout_inventory_reservation_items i
join public.checkout_inventory_reservations r
  on r.id=i.reservation_id
join public.products p
  on p.id=i.product_id
order by r.created_at desc,i.product_name;


-- 3. Movimientos de reserva
select
  im.created_at,
  im.product_id,
  p.sku,
  p.name,
  im.movement_type,
  im.quantity_change,
  im.stock_before,
  im.stock_after,
  im.note,
  p.stock as current_stock
from public.inventory_movements im
join public.products p
  on p.id=im.product_id
where im.movement_type in ('reservation','reservation_release')
order by im.created_at desc
limit 100;


-- 4. Reservas activas vencidas (idealmente 0 después del cleanup)
select count(*) as expired_active_reservations
from public.checkout_inventory_reservations
where status='active'
  and expires_at <= now();


-- 5. Seguridad de RPC
select
  has_function_privilege(
    'service_role',
    'public.reserve_checkout_inventory(jsonb,text,integer)',
    'EXECUTE'
  ) as reserve_service_role,

  has_function_privilege(
    'authenticated',
    'public.reserve_checkout_inventory(jsonb,text,integer)',
    'EXECUTE'
  ) as reserve_authenticated,

  has_function_privilege(
    'anon',
    'public.reserve_checkout_inventory(jsonb,text,integer)',
    'EXECUTE'
  ) as reserve_anon,

  has_function_privilege(
    'service_role',
    'public.consume_checkout_reservation(text)',
    'EXECUTE'
  ) as consume_service_role,

  has_function_privilege(
    'anon',
    'public.consume_checkout_reservation(text)',
    'EXECUTE'
  ) as consume_anon;
