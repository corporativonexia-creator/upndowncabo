-- UpNDown Checkout V2: isolated mixed product/variant inventory accounting.
-- Legacy checkout_inventory_reservations and historic RPCs remain untouched.
alter table public.order_items
  add column if not exists variant_id uuid references public.product_variants(id) on delete set null;

create table if not exists public.checkout_v2_reservations (
  id uuid primary key default gen_random_uuid(),
  reservation_token uuid not null unique default gen_random_uuid(),
  status text not null default 'active' check (status in ('active','released','expired','consumed')),
  stripe_checkout_session_id text unique,
  seller_ref text,
  expires_at timestamptz not null,
  released_at timestamptz,
  consumed_at timestamptz,
  release_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.checkout_v2_items (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.checkout_v2_reservations(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid references public.product_variants(id) on delete restrict,
  sku text,
  product_name text not null,
  quantity integer not null check (quantity between 1 and 20),
  currency text not null,
  unit_price numeric(12,2) not null check (unit_price > 0),
  stock_before integer not null,
  stock_after integer not null,
  image_url text,
  unique (reservation_id, product_id, variant_id)
);
create index if not exists checkout_v2_items_reservation_idx on public.checkout_v2_items(reservation_id);
create index if not exists checkout_v2_items_product_idx on public.checkout_v2_items(product_id);
create index if not exists checkout_v2_items_variant_idx on public.checkout_v2_items(variant_id) where variant_id is not null;
create index if not exists order_items_variant_id_idx on public.order_items(variant_id) where variant_id is not null;
create index if not exists checkout_v2_reservations_expiry_idx on public.checkout_v2_reservations(expires_at) where status='active';
create unique index if not exists checkout_v2_items_unique_product_no_variant on public.checkout_v2_items(reservation_id,product_id) where variant_id is null;

alter table public.checkout_v2_reservations enable row level security;
alter table public.checkout_v2_items enable row level security;
revoke all on public.checkout_v2_reservations from public, anon, authenticated;
revoke all on public.checkout_v2_items from public, anon, authenticated;
grant select,insert,update,delete on public.checkout_v2_reservations to service_role;
grant select,insert,update,delete on public.checkout_v2_items to service_role;

create or replace function public.reserve_checkout_inventory_v2(
  p_items jsonb, p_seller_ref text default null, p_ttl_minutes int default 30
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_res_id uuid;
  v_token uuid;
  v_expires timestamptz;
  v_item record;
  v_parent public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_variant_id uuid;
  v_parent_id uuid;
  v_qty integer;
  v_before integer;
  v_price numeric(12,2);
  v_currency text;
  v_sku text;
  v_name text;
  v_image text;
  v_label text;
  v_total integer := 0;
  v_count integer := 0;
  v_results jsonb := '[]'::jsonb;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 20 then
    raise exception 'INVALID_CART';
  end if;
  if p_ttl_minutes < 15 or p_ttl_minutes > 60 then
    raise exception 'INVALID_RESERVATION_TTL';
  end if;
  v_expires := now() + make_interval(mins=>p_ttl_minutes);
  insert into public.checkout_v2_reservations(seller_ref,expires_at,metadata)
    values(nullif(upper(trim(coalesce(p_seller_ref,''))),''),v_expires,'{"version":"v2","source":"upndown_web"}'::jsonb)
    returning id,reservation_token into v_res_id,v_token;

  -- Normalize duplicates before locking inventory; never trust client prices, stock or SKU.
  for v_item in
    select item_id, sum(qty)::integer as quantity
    from (
      select btrim(x.id) as item_id, x.quantity as qty
      from jsonb_to_recordset(p_items) as x(id text,quantity integer)
    ) n group by item_id order by item_id
  loop
    v_count := v_count+1;
    v_qty := v_item.quantity;
    v_label := v_item.item_id;
    if v_count > 20 or v_qty is null or v_qty < 1 or v_qty > 20 or v_label is null or length(v_label)>64 then
      raise exception 'INVALID_CART_ITEM';
    end if;
    v_total := v_total+v_qty;
    if v_total > 100 then raise exception 'CART_TOO_LARGE'; end if;

    v_variant_id := null;
    v_parent_id := null;
    if left(v_label,8)='variant:' then
      begin v_variant_id := substring(v_label from 9)::uuid;
      exception when others then raise exception 'INVALID_VARIANT_ID'; end;
      select * into v_variant
        from public.product_variants where id=v_variant_id and is_active=true for update;
      if not found then raise exception 'VARIANT_NOT_AVAILABLE:%',v_variant_id; end if;
      v_parent_id := v_variant.product_id;
    else
      begin v_parent_id := v_label::uuid;
      exception when others then raise exception 'INVALID_PRODUCT_ID'; end;
    end if;

    select * into v_parent from public.products
      where id=v_parent_id and status='active' and online_visible=true for update;
    if not found then raise exception 'PRODUCT_NOT_AVAILABLE:%',v_parent_id; end if;

    if v_variant_id is null and exists(
      select 1 from public.product_variants where product_id=v_parent_id and is_active=true
    ) then
      raise exception 'SELECT_VARIANT:%',v_parent_id;
    end if;

    if v_variant_id is not null then
      v_before := v_variant.stock;
      v_price := round(coalesce(v_variant.sale_price,
          case when v_variant.price is null then v_parent.sale_price else null end,
          v_variant.price,v_parent.price)::numeric,2);
      v_sku := coalesce(nullif(v_variant.sku,''),v_parent.sku);
      v_name := v_parent.name;
      if btrim(coalesce(v_variant.title,'')) <> '' and lower(v_variant.title) not in ('unica','única','principal') then
        v_name := v_name || ' · ' || v_variant.title;
      end if;
      v_image := coalesce(nullif(v_variant.attributes->>'image_url',''),
        nullif(v_variant.attributes->>'photo_url',''),v_parent.cover_image_url);
    else
      v_before := v_parent.stock;
      v_price := round(coalesce(v_parent.sale_price,v_parent.price)::numeric,2);
      v_sku := v_parent.sku;
      v_name := v_parent.name;
      v_image := v_parent.cover_image_url;
    end if;
    if v_before < v_qty then raise exception 'INSUFFICIENT_STOCK:%',v_name; end if;
    if v_price is null or v_price <= 0 then raise exception 'INVALID_UNIT_PRICE:%',v_name; end if;
    v_currency := upper(coalesce(v_parent.currency,'MXN'));

    insert into public.checkout_v2_items(
      reservation_id,product_id,variant_id,sku,product_name,quantity,currency,
      unit_price,stock_before,stock_after,image_url
    ) values(v_res_id,v_parent_id,v_variant_id,v_sku,v_name,v_qty,v_currency,
      v_price,v_before,v_before-v_qty,v_image);

    -- Stock movement accounts for reservation; parent stock is synced by variant triggers.
    insert into public.inventory_movements(
      product_id,variant_id,movement_type,quantity_change,stock_before,stock_after,note
    ) values(v_parent_id,v_variant_id,'adjustment',-v_qty,v_before,v_before-v_qty,
      'RESERVA V2 '||v_token::text);

    if v_variant_id is not null then
      update public.product_variants set stock=stock-v_qty,updated_at=now() where id=v_variant_id;
    else
      update public.products set stock=stock-v_qty,updated_at=now() where id=v_parent_id;
    end if;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'id',v_label,'product_id',v_parent_id,'variant_id',v_variant_id,'sku',v_sku,
      'name',v_name,'quantity',v_qty,'currency',v_currency,'unit_price',v_price,
      'image_url',v_image
    ));
  end loop;
  if v_count=0 then raise exception 'EMPTY_CART'; end if;
  return jsonb_build_object('ok',true,'reservation_id',v_res_id,'reservation_token',v_token,
    'status','active','expires_at',v_expires,'items',v_results);
end;
$$;

create or replace function public.bind_checkout_inventory_v2(
  p_reservation_token uuid,p_stripe_checkout_session_id text
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_record public.checkout_v2_reservations%rowtype;
begin
  if nullif(btrim(p_stripe_checkout_session_id),'') is null then raise exception 'STRIPE_SESSION_REQUIRED'; end if;
  select * into v_record from public.checkout_v2_reservations
    where reservation_token=p_reservation_token for update;
  if not found or v_record.status<>'active' or v_record.expires_at<=now() then
    raise exception 'RESERVATION_UNAVAILABLE';
  end if;
  if v_record.stripe_checkout_session_id is not null and v_record.stripe_checkout_session_id<>p_stripe_checkout_session_id then
    raise exception 'SESSION_ALREADY_BOUND';
  end if;
  update public.checkout_v2_reservations set stripe_checkout_session_id=p_stripe_checkout_session_id where id=v_record.id;
  return jsonb_build_object('ok',true,'reservation_token',v_record.reservation_token);
end;
$$;

create or replace function public.release_checkout_inventory_v2(
  p_reservation_token uuid,p_reason text default 'released'
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_record public.checkout_v2_reservations%rowtype;
  v_item public.checkout_v2_items%rowtype;
  v_parent public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_before integer;
  v_units integer:=0;
begin
  select * into v_record from public.checkout_v2_reservations
    where reservation_token=p_reservation_token for update;
  if not found then raise exception 'RESERVATION_NOT_FOUND'; end if;
  if v_record.status in ('released','expired') then
    return jsonb_build_object('ok',true,'already_released',true,'status',v_record.status);
  end if;
  if v_record.status='consumed' then raise exception 'ALREADY_CONSUMED'; end if;
  for v_item in select * from public.checkout_v2_items where reservation_id=v_record.id
     order by product_id,variant_id nulls first
  loop
    if v_item.variant_id is not null then
      select * into v_variant from public.product_variants where id=v_item.variant_id for update;
      if not found then raise exception 'RESERVED_VARIANT_MISSING'; end if;
      v_before:=v_variant.stock;
      insert into public.inventory_movements(
        product_id,variant_id,movement_type,quantity_change,stock_before,stock_after,note
      ) values(v_item.product_id,v_item.variant_id,'adjustment',v_item.quantity,v_before,
        v_before+v_item.quantity,'LIBERACION RESERVA V2 '||v_record.reservation_token::text);
      update public.product_variants set stock=stock+v_item.quantity,updated_at=now()
        where id=v_item.variant_id;
    else
      select * into v_parent from public.products where id=v_item.product_id for update;
      if not found then raise exception 'RESERVED_PRODUCT_MISSING'; end if;
      v_before:=v_parent.stock;
      insert into public.inventory_movements(
        product_id,movement_type,quantity_change,stock_before,stock_after,note
      ) values(v_item.product_id,'adjustment',v_item.quantity,v_before,
        v_before+v_item.quantity,'LIBERACION RESERVA V2 '||v_record.reservation_token::text);
      update public.products set stock=stock+v_item.quantity,updated_at=now()
        where id=v_item.product_id;
    end if;
    v_units:=v_units+v_item.quantity;
  end loop;
  update public.checkout_v2_reservations set
    status=case when expires_at<=now() then 'expired' else 'released' end,
    released_at=now(),release_reason=left(coalesce(p_reason,'released'),200)
    where id=v_record.id;
  return jsonb_build_object('ok',true,'released_units',v_units,'already_released',false);
end;
$$;

create or replace function public.process_checkout_inventory_v2(
  p_stripe_event_id text,p_event_type text,p_stripe_session_id text,
  p_payment_intent_id text,p_checkout_reference text,p_customer_email text,
  p_customer_name text,p_customer_phone text,p_currency text,
  p_amount_subtotal numeric,p_amount_total numeric,p_stripe_created_at timestamptz,
  p_reservation_token uuid
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_record public.checkout_v2_reservations%rowtype;
  v_item public.checkout_v2_items%rowtype;
  v_parent public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_order public.orders%rowtype;
  v_event public.stripe_webhook_events%rowtype;
  v_order_id uuid;
  v_order_number bigint;
  v_before integer;
  v_sum numeric(12,2);
  v_currency text;
  v_seller public.affiliate_sellers%rowtype;
  v_commission numeric(12,2);
  v_rate numeric(5,2);
begin
  if nullif(btrim(p_stripe_event_id),'') is null or nullif(btrim(p_stripe_session_id),'') is null then
    raise exception 'MISSING_STRIPE_IDENTIFIERS';
  end if;
  select * into v_record from public.checkout_v2_reservations
    where reservation_token=p_reservation_token for update;
  if not found or v_record.stripe_checkout_session_id is distinct from p_stripe_session_id then
    raise exception 'INVALID_RESERVATION_SESSION';
  end if;
  select * into v_order from public.orders where stripe_checkout_session_id=p_stripe_session_id;
  if found then
    return jsonb_build_object('duplicate',true,'order_id',v_order.id,'order_number',v_order.order_number);
  end if;
  if v_record.status<>'active' then raise exception 'RESERVATION_NOT_ACTIVE'; end if;
  select * into v_event from public.stripe_webhook_events where stripe_event_id=p_stripe_event_id;
  if found then raise exception 'STRIPE_EVENT_ALREADY_HANDLED_WITHOUT_ORDER'; end if;

  select coalesce(sum(quantity*unit_price),0),min(currency) into v_sum,v_currency
    from public.checkout_v2_items where reservation_id=v_record.id;
  if v_sum<=0 or upper(coalesce(p_currency,''))<>v_currency or
     abs(v_sum-coalesce(p_amount_total,0))>0.01 or
     abs(v_sum-coalesce(p_amount_subtotal,0))>0.01 then
    raise exception 'STRIPE_PAYMENT_AMOUNT_MISMATCH';
  end if;

  if v_record.seller_ref is not null then
    select * into v_seller from public.affiliate_sellers
      where code=v_record.seller_ref and is_active=true;
  end if;
  v_rate:=case when v_seller.id is not null
    then least(100,greatest(0,coalesce(v_seller.commission_rate,0))) else null end;
  v_commission:=case when v_rate is null then null else round(v_sum*v_rate/100.0,2) end;
  insert into public.orders(
    stripe_checkout_session_id,stripe_payment_intent_id,checkout_reference,
    customer_email,customer_name,customer_phone,currency,subtotal,total,
    payment_status,order_status,metadata,seller_ref,affiliate_seller_id,
    affiliate_commission_rate,affiliate_commission_amount
  ) values(
    p_stripe_session_id,nullif(p_payment_intent_id,''),nullif(p_checkout_reference,''),
    nullif(p_customer_email,''),nullif(p_customer_name,''),nullif(p_customer_phone,''),
    v_currency,v_sum,v_sum,'paid','processing',
    jsonb_build_object('checkout_version','v2','reservation_token',v_record.reservation_token,
      'stripe_event_id',p_stripe_event_id),
    case when v_seller.id is not null then v_seller.code else null end,
    v_seller.id,v_rate,v_commission
  ) returning id,order_number into v_order_id,v_order_number;

  -- Keep the existing affiliate commission ledger in sync with all V2 orders.
  if v_seller.id is not null then
    update public.orders set metadata = metadata || jsonb_build_object(
      'affiliate_seller_id',v_seller.id,'affiliate_code',v_seller.code,
      'affiliate_commission_rate',v_rate,'affiliate_commission_amount',v_commission
    ) where id=v_order_id;
    insert into public.affiliate_commissions(
      order_id,seller_id,seller_code,currency,order_total,
      commission_rate,commission_amount,status
    ) values(
      v_order_id,v_seller.id,v_seller.code,v_currency,v_sum,
      v_rate,v_commission,'pending'
    ) on conflict(order_id) do nothing;
  end if;

  -- Atomic conversion of the reserved quantity to a sale:
  -- both operations are inside this transaction and all rows stay locked.
  for v_item in select * from public.checkout_v2_items where reservation_id=v_record.id
    order by product_id,variant_id nulls first
  loop
    if v_item.variant_id is not null then
      select * into v_variant from public.product_variants where id=v_item.variant_id for update;
      if not found then raise exception 'RESERVED_VARIANT_MISSING'; end if;
      v_before:=v_variant.stock;
      insert into public.inventory_movements(product_id,variant_id,order_id,
        movement_type,quantity_change,stock_before,stock_after,note)
        values(v_item.product_id,v_item.variant_id,v_order_id,'adjustment',v_item.quantity,
          v_before,v_before+v_item.quantity,'CONVERSION RESERVA V2 A VENTA');
      update public.product_variants set stock=stock+v_item.quantity where id=v_item.variant_id;
      insert into public.inventory_movements(product_id,variant_id,order_id,
        movement_type,quantity_change,stock_before,stock_after,note)
        values(v_item.product_id,v_item.variant_id,v_order_id,'sale',-v_item.quantity,
          v_before+v_item.quantity,v_before,'VENTA STRIPE V2');
      update public.product_variants set stock=stock-v_item.quantity where id=v_item.variant_id;
    else
      select * into v_parent from public.products where id=v_item.product_id for update;
      if not found then raise exception 'RESERVED_PRODUCT_MISSING'; end if;
      v_before:=v_parent.stock;
      insert into public.inventory_movements(product_id,order_id,movement_type,
        quantity_change,stock_before,stock_after,note)
        values(v_item.product_id,v_order_id,'adjustment',v_item.quantity,v_before,
          v_before+v_item.quantity,'CONVERSION RESERVA V2 A VENTA');
      update public.products set stock=stock+v_item.quantity where id=v_item.product_id;
      insert into public.inventory_movements(product_id,order_id,movement_type,
        quantity_change,stock_before,stock_after,note)
        values(v_item.product_id,v_order_id,'sale',-v_item.quantity,
          v_before+v_item.quantity,v_before,'VENTA STRIPE V2');
      update public.products set stock=stock-v_item.quantity where id=v_item.product_id;
    end if;
    insert into public.order_items(
      order_id,product_id,variant_id,sku,product_name,unit_price,quantity,line_total,product_snapshot
    ) values(v_order_id,v_item.product_id,v_item.variant_id,v_item.sku,v_item.product_name,
      v_item.unit_price,v_item.quantity,v_item.unit_price*v_item.quantity,
      jsonb_build_object('checkout_version','v2','product_id',v_item.product_id,
        'variant_id',v_item.variant_id,'sku',v_item.sku,'name',v_item.product_name,
        'image_url',v_item.image_url,'currency',v_item.currency));
  end loop;

  insert into public.stripe_webhook_events(
    stripe_event_id,event_type,stripe_object_id,processing_status,order_id,
    processed_at,stripe_created_at,event_summary
  ) values(p_stripe_event_id,p_event_type,p_stripe_session_id,'completed',v_order_id,
    now(),p_stripe_created_at,jsonb_build_object('checkout_version','v2','order_number',v_order_number))
  on conflict(stripe_event_id) do nothing;
  update public.checkout_v2_reservations set status='consumed',consumed_at=now(),
    metadata=metadata||jsonb_build_object('order_id',v_order_id,'stripe_event_id',p_stripe_event_id)
    where id=v_record.id;
  return jsonb_build_object('ok',true,'duplicate',false,'order_id',v_order_id,
    'order_number',v_order_number,'inventory_mode','variant_aware_v2');
end;
$$;

create or replace function public.release_expired_checkout_inventory_v2(
  p_limit integer default 100
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare v_line record;v_count int:=0;
begin
  -- Grace period protects purchases whose Stripe webhook is delayed.
  for v_line in select reservation_token from public.checkout_v2_reservations
    where status='active' and expires_at<now()-interval '45 minutes'
    order by expires_at limit greatest(1,least(coalesce(p_limit,100),200))
  loop
    perform public.release_checkout_inventory_v2(v_line.reservation_token,'expired_fallback_grace_period');
    v_count:=v_count+1;
  end loop;
  return jsonb_build_object('ok',true,'released',v_count);
end;
$$;

revoke all on function public.reserve_checkout_inventory_v2(jsonb,text,int) from public,anon,authenticated;
revoke all on function public.bind_checkout_inventory_v2(uuid,text) from public,anon,authenticated;
revoke all on function public.release_checkout_inventory_v2(uuid,text) from public,anon,authenticated;
revoke all on function public.process_checkout_inventory_v2(text,text,text,text,text,text,text,text,text,numeric,numeric,timestamptz,uuid) from public,anon,authenticated;
revoke all on function public.release_expired_checkout_inventory_v2(int) from public,anon,authenticated;
grant execute on function public.reserve_checkout_inventory_v2(jsonb,text,int) to service_role;
grant execute on function public.bind_checkout_inventory_v2(uuid,text) to service_role;
grant execute on function public.release_checkout_inventory_v2(uuid,text) to service_role;
grant execute on function public.process_checkout_inventory_v2(text,text,text,text,text,text,text,text,text,numeric,numeric,timestamptz,uuid) to service_role;
grant execute on function public.release_expired_checkout_inventory_v2(int) to service_role;
