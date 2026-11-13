-- POS 2.2 public catalog campaigns and authoritative Stripe checkout prices.
-- Apply AFTER all POS 2.2 migrations, without mutating existing stock or orders.
begin;
create or replace function public.pos22_public_active_promotions()
returns jsonb language sql stable security definer set search_path=''
as $campaigns$
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',p.id,'title',p.title,'target_type',p.target_type,
   'target_value',p.target_value,'discount_percent',p.discount_percent)
   order by p.discount_percent desc,p.created_at,p.id),'[]'::jsonb)
 from public.pos22_promotions p
 where p.enabled=true
 and (now() at time zone 'America/Mazatlan')::date between p.starts_on and p.ends_on
$campaigns$;
revoke all on function public.pos22_public_active_promotions() from PUBLIC,anon,authenticated;
grant execute on function public.pos22_public_active_promotions() to anon,authenticated;
-- Legacy checkout: server reads the promotion, never accepts prices from browser.
CREATE OR REPLACE FUNCTION public.reserve_checkout_inventory(p_items jsonb, p_seller_ref text DEFAULT NULL::text, p_ttl_minutes integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_reservation_id uuid;
  v_token uuid;
  v_expires_at timestamptz;

  v_item jsonb;
  v_product public.products%rowtype;

  v_product_id uuid;
  v_quantity integer;
  v_price numeric(12,2);
  v_currency text;

  v_items_result jsonb := '[]'::jsonb;
begin
  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'RESERVATION_ITEMS_REQUIRED';
  end if;

  if coalesce(p_ttl_minutes,0) < 5
     or p_ttl_minutes > 1440 then
    raise exception 'INVALID_RESERVATION_TTL';
  end if;

  v_expires_at := now() + make_interval(mins => p_ttl_minutes);

  insert into public.checkout_inventory_reservations(
    seller_ref,
    expires_at,
    metadata
  )
  values(
    nullif(upper(trim(coalesce(p_seller_ref,''))),''),
    v_expires_at,
    jsonb_build_object(
      'source','ecommerce_checkout',
      'ttl_minutes',p_ttl_minutes
    )
  )
  returning id,reservation_token
  into v_reservation_id,v_token;

  -- Iteramos IDs ordenados para reducir riesgo de deadlock
  -- cuando dos checkouts compiten por varios productos.
  for v_item in
    select value
    from jsonb_array_elements(p_items)
    order by value ->> 'id'
  loop
    begin
      v_product_id := nullif(v_item ->> 'id','')::uuid;
    exception
      when others then
        raise exception 'INVALID_PRODUCT_ID';
    end;

    v_quantity := coalesce((v_item ->> 'quantity')::integer,0);

    if v_product_id is null or v_quantity <= 0 then
      raise exception 'INVALID_RESERVATION_ITEM';
    end if;

    -- Evitar producto duplicado dentro del payload.
    if exists(
      select 1
      from public.checkout_inventory_reservation_items ri
      where ri.reservation_id = v_reservation_id
        and ri.product_id = v_product_id
    ) then
      raise exception 'DUPLICATE_PRODUCT_IN_RESERVATION';
    end if;

    select *
    into v_product
    from public.products
    where id = v_product_id
      and status = 'active' and online_visible = true
    for update;

    if not found then
      raise exception 'PRODUCT_NOT_AVAILABLE:%',v_product_id;
    end if;

    if coalesce(v_product.stock,0) < v_quantity then
      raise exception
        'INSUFFICIENT_STOCK:%:available=%:requested=%',
        v_product.name,
        coalesce(v_product.stock,0),
        v_quantity;
    end if;

    v_price := round(coalesce(v_product.sale_price,v_product.price,0)::numeric,2);
    v_price := round(v_price*(1-coalesce(
      (public.pos22_match_promotion(v_product.id,null)->>'percent')::numeric,0
    )/100),2);

    v_currency := upper(coalesce(v_product.currency,'MXN'));

    insert into public.checkout_inventory_reservation_items(
      reservation_id,
      product_id,
      sku,
      product_name,
      quantity,
      currency,
      unit_price,
      stock_before,
      stock_after
    )
    values(
      v_reservation_id,
      v_product.id,
      v_product.sku,
      v_product.name,
      v_quantity,
      v_currency,
      v_price,
      v_product.stock,
      v_product.stock - v_quantity
    );

    insert into public.inventory_movements(
      product_id,
      movement_type,
      quantity_change,
      stock_before,
      stock_after,
      note
    )
    values(
      v_product.id,
      'reservation',
      -v_quantity,
      v_product.stock,
      v_product.stock - v_quantity,
      format(
        'RESERVA CHECKOUT %s · vence %s',
        v_token,
        v_expires_at
      )
    );

    update public.products
    set
      stock = stock - v_quantity,
      updated_at = now()
    where id = v_product.id;

    v_items_result :=
      v_items_result ||
      jsonb_build_array(
        jsonb_build_object(
          'id',v_product.id,
          'sku',v_product.sku,
          'name',v_product.name,
          'quantity',v_quantity,
          'currency',v_currency,
          'unit_price',v_price
        )
      );
  end loop;

  return jsonb_build_object(
    'ok',true,
    'reservation_id',v_reservation_id,
    'reservation_token',v_token,
    'status','active',
    'expires_at',v_expires_at,
    'items',v_items_result
  );
end;
$function$
-- Variant checkout: idem, with parent/category and variant SKU/barcode matching.
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
    v_price := round(v_price*(1-coalesce(
      (public.pos22_match_promotion(v_parent_id,v_variant_id)->>'percent')::numeric,0
    )/100),2);
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
commit;
