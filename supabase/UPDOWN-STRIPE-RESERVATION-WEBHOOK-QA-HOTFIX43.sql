-- HOTFIX43 · QA SOLO LECTURA

-- 1. Seguridad
select
  has_function_privilege(
    'service_role',
    'public.process_reserved_stripe_checkout_affiliate(text,text,text,text,text,text,text,text,text,numeric,numeric,timestamptz,uuid,uuid,text,numeric)',
    'EXECUTE'
  ) as reserved_service_role,
  has_function_privilege(
    'authenticated',
    'public.process_reserved_stripe_checkout_affiliate(text,text,text,text,text,text,text,text,text,numeric,numeric,timestamptz,uuid,uuid,text,numeric)',
    'EXECUTE'
  ) as reserved_authenticated,
  has_function_privilege(
    'anon',
    'public.process_reserved_stripe_checkout_affiliate(text,text,text,text,text,text,text,text,text,numeric,numeric,timestamptz,uuid,uuid,text,numeric)',
    'EXECUTE'
  ) as reserved_anon;

-- 2. Últimas reservas
select
  r.created_at,
  r.reservation_token,
  r.status,
  r.stripe_checkout_session_id,
  r.expires_at,
  r.consumed_at,
  r.released_at,
  r.release_reason,
  r.metadata
from public.checkout_inventory_reservations r
order by r.created_at desc
limit 20;

-- 3. Trazabilidad reserva → conversión → venta
select
  im.created_at,
  p.sku,
  p.name,
  im.movement_type,
  im.quantity_change,
  im.stock_before,
  im.stock_after,
  im.note,
  p.stock as current_stock
from public.inventory_movements im
join public.products p on p.id=im.product_id
where im.movement_type in (
  'reservation',
  'reservation_conversion',
  'sale',
  'reservation_release'
)
order by im.created_at desc
limit 100;

-- 4. Pedidos Stripe recientes
select
  o.created_at,
  o.order_number,
  o.order_status,
  o.payment_status,
  o.stripe_checkout_session_id,
  o.total,
  o.currency,
  o.seller_ref
from public.orders o
where o.stripe_checkout_session_id is not null
order by o.created_at desc
limit 20;
