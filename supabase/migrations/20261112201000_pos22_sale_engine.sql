begin;
CREATE OR REPLACE FUNCTION public.pos_create_sale_v22(p_device_token text, p_items jsonb, p_payments jsonb, p_discount_amount numeric DEFAULT 0, p_notes text DEFAULT NULL::text, p_promo_approval_token uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_employee public.pos_employees%rowtype;
  v_terminal public.pos_terminals%rowtype;
  v_shift public.pos_shifts%rowtype;

  v_sale_id uuid;
  v_sale_number bigint;

  v_item jsonb;
  v_payment jsonb;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_variant_id uuid;

  v_product_id uuid;
  v_quantity integer;
  v_unit_price numeric(12,2);
  v_line_subtotal numeric(12,2);
  v_line_discount numeric(12,2);
  v_discount_unit numeric(12,2);
  v_mode text;
  v_value numeric;
  v_approved_by uuid;
  v_approval_reason text;
  v_promo jsonb;
  v_auto_unit numeric(12,2);
  v_manual_unit numeric(12,2);
  v_auto_discount numeric(12,2):=0;
  v_manual_discount numeric(12,2):=0;
  v_global_mode text:='none';
  v_global_value numeric:=0;
  v_global_discount numeric(12,2):=0;
  v_authorization_discount numeric(12,2):=0;

  v_subtotal numeric(12,2) := 0;
  v_discount numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_payment_total numeric(12,2) := 0;

  v_method text;
  v_amount numeric(12,2);
  v_reference text;

  v_max_discount numeric(12,2);
  v_item_count integer := 0;
  v_request_id uuid;
  v_request_payload jsonb;
  v_existing public.pos_sales%rowtype;
  v_name text;
begin
  -- Empleado autenticado.
  select e.*
  into v_employee
  from public.pos_employees e
  where e.auth_user_id = auth.uid();

  if not found then
    raise exception 'POS_EMPLOYEE_NOT_FOUND';
  end if;

  if v_employee.status <> 'active' then
    raise exception 'POS_EMPLOYEE_NOT_ACTIVE';
  end if;

  -- Terminal autorizada por token físico/local.
  select t.*
  into v_terminal
  from public.pos_terminals t
  where t.status = 'active'
    and t.device_token_hash =
      extensions.digest(convert_to(coalesce(p_device_token,''),'UTF8'),'sha256');

  if not found then
    raise exception 'TERMINAL_NOT_AUTHORIZED';
  end if;

  -- El cajero debe tener un turno abierto EN ESA terminal.
  select s.*
  into v_shift
  from public.pos_shifts s
  where s.employee_id = v_employee.id
    and s.terminal_id = v_terminal.id
    and s.status = 'open'
  order by s.opened_at desc
  limit 1
  for update;

  if not found then
    raise exception 'NO_OPEN_SHIFT';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'SALE_ITEMS_REQUIRED';
  end if;

  if p_payments is null
     or jsonb_typeof(p_payments) <> 'array'
     or jsonb_array_length(p_payments) = 0 then
    raise exception 'PAYMENT_REQUIRED';
  end if;

  -- The shift lock serializes retries from this terminal. A unique index also
  -- prevents reuse from another shift. Legacy clients may omit the request ID.
  begin
    v_request_id := nullif(p_payments #>> '{0,metadata,pos_request_id}', '')::uuid;
  exception when invalid_text_representation then
    raise exception 'INVALID_REQUEST_ID';
  end;
  -- Global promotion verified after calculating server-side catalog subtotal.
  v_request_payload := jsonb_build_object('items',p_items,'payments',p_payments,
    'discount',p_discount_amount,'notes',p_notes,'approval',p_promo_approval_token);
  if v_request_id is not null then
    select * into v_existing from public.pos_sales
    where employee_id=v_employee.id and metadata ->> 'pos_request_id'=v_request_id::text;
    if found then
      if v_existing.shift_id <> v_shift.id or v_existing.metadata -> 'request_payload' is distinct from v_request_payload then
        raise exception 'REQUEST_ID_CONFLICT';
      end if;
      if v_existing.status <> 'completed' then raise exception 'REQUEST_ALREADY_REVERSED'; end if;
      return jsonb_build_object('ok',true,'sale_id',v_existing.id,
        'sale_number',v_existing.sale_number,'currency',v_existing.currency,
        'subtotal',v_existing.subtotal,'discount_amount',v_existing.discount_amount,
        'total',v_existing.total,'item_count',v_existing.metadata -> 'item_count','replayed',true);
    end if;
  end if;

  -- ------------------------------------------------------------------------
  -- A single product/variant must occur only once per request.
  -- Prevent repeated lines from bypassing stock checks in the first pass.
  if exists (
    select 1 from jsonb_array_elements(p_items) as item
    group by (item ->> 'product_id')::uuid, nullif(item ->> 'variant_id','')::uuid
    having count(*) > 1
  ) then
    raise exception 'DUPLICATE_SALE_ITEM';
  end if;

  -- Primera pasada: bloquea inventario y calcula subtotal con precio servidor.
  -- ------------------------------------------------------------------------
  for v_item in
    select value
    from jsonb_array_elements(p_items)
    order by (value ->> 'product_id')::uuid, nullif(value ->> 'variant_id','')::uuid
  loop
    begin
      v_product_id := nullif(v_item ->> 'product_id','')::uuid;
      v_quantity := (v_item ->> 'quantity')::integer;
      v_variant_id := nullif(v_item ->> 'variant_id','')::uuid;
    exception when others then
      raise exception 'INVALID_SALE_ITEM';
    end;

    if v_product_id is null or v_quantity is null or v_quantity <= 0 then
      raise exception 'INVALID_SALE_ITEM';
    end if;

    select p.*
    into v_product
    from public.products p
    where p.id = v_product_id
      and p.status = 'active'
      and p.pos_visible = true
    for update;

    if not found then
      raise exception 'PRODUCT_NOT_AVAILABLE:%', v_product_id;
    end if;

    if v_product.currency <> 'MXN' then raise exception 'POS_CURRENCY_NOT_SUPPORTED'; end if;
    -- A stale client must never sell aggregate parent stock as a separate SKU.
    if v_variant_id is null and exists(select 1 from public.product_variants where product_id=v_product_id) then
      raise exception 'VARIANT_REQUIRED:%',v_product_id;
    end if;

    if v_variant_id is not null then
      select * into v_variant from public.product_variants where id=v_variant_id and product_id=v_product_id and is_active=true for update;
      if not found then raise exception 'VARIANT_NOT_AVAILABLE:%',v_variant_id; end if;
    end if;
    if not v_product.is_service and (case when v_variant_id is null then v_product.stock else v_variant.stock end) < v_quantity then
      raise exception
        'INSUFFICIENT_STOCK:%:AVAILABLE=%:REQUESTED=%',
        v_product.id,
        case when v_variant_id is null then v_product.stock else v_variant.stock end,
        v_quantity;
    end if;

    if v_product.is_service then
      if v_variant_id is not null then raise exception 'SERVICE_VARIANT_NOT_ALLOWED';end if;
      begin v_unit_price:=round((v_item->>'service_unit_price')::numeric,2);
      exception when others then raise exception 'SERVICE_PRICE_REQUIRED';end;
      if v_unit_price is null or v_unit_price<=0 or v_unit_price>99999999 then raise exception 'INVALID_SERVICE_PRICE';end if;
    else
      if v_item ? 'service_unit_price' then raise exception 'PRICE_OVERRIDE_NOT_ALLOWED';end if;
      v_unit_price:=round(case when v_variant_id is null
        then coalesce(v_product.sale_price,v_product.price,0)
        else coalesce(v_variant.sale_price,v_variant.price,v_product.sale_price,v_product.price,0) end,2);
    end if;
    if v_unit_price<0 or v_unit_price::text in ('NaN','Infinity','-Infinity') then raise exception 'INVALID_PRODUCT_PRICE';end if;
    v_promo:=public.pos22_match_promotion(v_product.id,v_variant_id);
    v_auto_unit:=round(v_unit_price*coalesce((v_promo->>'percent')::numeric,0)/100,2);
    v_mode:=lower(coalesce(nullif(btrim(v_item->>'promotion_mode'),''),'none'));
    begin
      v_value:=case when v_mode='none' then null else (v_item->>'promotion_value')::numeric end;
      v_manual_unit:=round(v_unit_price-public.pos21_promotional_unit_price(v_unit_price,v_mode,v_value),2);
    exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'INVALID_PROMOTION_VALUE';end;
    v_discount_unit:=round(v_auto_unit+v_manual_unit,2);
    if v_discount_unit>v_unit_price then raise exception 'STACKED_DISCOUNT_EXCEEDS_ITEM_PRICE';end if;
    v_line_subtotal:=round(v_unit_price*v_quantity,2);
    v_line_discount:=round(v_discount_unit*v_quantity,2);
    v_auto_discount:=round(v_auto_discount+v_auto_unit*v_quantity,2);
    v_manual_discount:=round(v_manual_discount+v_manual_unit*v_quantity,2);
    v_discount:=round(v_discount+v_line_discount,2);
    v_subtotal:=round(v_subtotal+v_line_subtotal,2);
    v_item_count := v_item_count + v_quantity;
  end loop;

  v_subtotal:=round(v_subtotal,2);
  v_global_mode:=lower(coalesce(nullif(btrim(p_items #>> '{0,global_promotion_mode}'),''),'none'));
  begin
    v_global_value:=case when v_global_mode='none' then 0 else (p_items #>> '{0,global_promotion_value}')::numeric end;
  exception when others then raise exception 'INVALID_GLOBAL_PROMOTION';end;
  if v_global_value is null or v_global_value<0 or v_global_value::text in ('NaN','Infinity','-Infinity')
    then raise exception 'INVALID_GLOBAL_PROMOTION';end if;
  case v_global_mode
    when 'none' then v_global_discount:=0;
    when 'percent' then
      if v_global_value>100 then raise exception 'INVALID_GLOBAL_PERCENT';end if;
      v_global_discount:=round(v_subtotal*v_global_value/100,2);
    when 'amount' then v_global_discount:=round(v_global_value,2);
    when 'final' then v_global_discount:=round(v_subtotal-v_global_value,2);
    else raise exception 'INVALID_GLOBAL_MODE';
  end case;
  if v_global_discount<0 or v_global_discount>v_subtotal then raise exception 'INVALID_GLOBAL_DISCOUNT';end if;
  if round(coalesce(p_discount_amount,0),2)<>v_global_discount then raise exception 'GLOBAL_DISCOUNT_MISMATCH';end if;
  v_authorization_discount:=round(v_manual_discount+v_global_discount,2);
  v_discount:=round(v_discount+v_global_discount,2);

  if v_discount < 0 or v_discount::text in ('NaN','Infinity','-Infinity') then
    raise exception 'INVALID_DISCOUNT';
  end if;

  -- Política inicial de autorización de descuentos.
  if v_employee.role = 'cashier' then
    v_max_discount := 0;
  elsif v_employee.role = 'supervisor' then
    v_max_discount := round(v_subtotal * 0.10,2);
  elsif v_employee.role = 'pos_admin' then
    v_max_discount := round(v_subtotal * 0.25,2);
  else
    raise exception 'INVALID_POS_ROLE';
  end if;

  if v_authorization_discount > v_max_discount then
    if p_promo_approval_token is null then
      raise exception 'PROMOTION_ADMIN_APPROVAL_REQUIRED:MAX=%',v_max_discount;
    end if;
    select a.approved_by,a.reason into v_approved_by,v_approval_reason
    from public.pos21_promotion_approvals a
    where a.token=p_promo_approval_token
      and a.cashier_employee_id=v_employee.id
      and a.items=p_items
      and a.approved_discount >= v_authorization_discount
      and a.expires_at > now()
      and a.consumed_sale_id is null
    for update;
    if not found then raise exception 'INVALID_OR_EXPIRED_PROMOTION_APPROVAL'; end if;
  end if;

  if v_discount >= v_subtotal then
    raise exception 'ZERO_OR_NEGATIVE_TOTAL_NOT_ALLOWED';
  end if;

  v_total := round(v_subtotal - v_discount,2);

  -- ------------------------------------------------------------------------
  -- Pagos: validar total exacto.
  -- V1 permite pagos mixtos si la suma coincide exactamente.
  -- ------------------------------------------------------------------------
  for v_payment in
    select value
    from jsonb_array_elements(p_payments)
  loop
    v_method := lower(btrim(coalesce(v_payment ->> 'method','')));
    v_reference := nullif(btrim(coalesce(v_payment ->> 'reference','')),'');

    begin
      v_amount := round((v_payment ->> 'amount')::numeric,2);
    exception when others then
      raise exception 'INVALID_PAYMENT_AMOUNT';
    end;

    if v_method not in ('cash','card_terminal','transfer','other') then
      raise exception 'INVALID_PAYMENT_METHOD:%', v_method;
    end if;

    if v_amount is null or v_amount <= 0 or v_amount::text in ('NaN','Infinity','-Infinity') then
      raise exception 'INVALID_PAYMENT_AMOUNT';
    end if;

    v_payment_total := v_payment_total + v_amount;
  end loop;

  v_payment_total := round(v_payment_total,2);

  if v_payment_total <> v_total then
    raise exception
      'PAYMENT_TOTAL_MISMATCH:EXPECTED=%:RECEIVED=%',
      v_total,
      v_payment_total;
  end if;

  -- ------------------------------------------------------------------------
  -- Cabecera.
  -- ------------------------------------------------------------------------
  insert into public.pos_sales(
    shift_id,
    employee_id,
    terminal_id,
    channel,
    status,
    currency,
    subtotal,
    discount_amount,
    total,
    notes,
    metadata
  )
  values(
    v_shift.id,
    v_employee.id,
    v_terminal.id,
    'pos',
    'completed',
    'MXN',
    v_subtotal,
    v_discount,
    v_total,
    nullif(btrim(coalesce(p_notes,'')),''),
    jsonb_build_object(
      'employee_number', v_employee.employee_number,
      'employee_role', v_employee.role,
      'terminal_name', v_terminal.name,
      'item_count', v_item_count,
      'pos_request_id', v_request_id,
      'request_payload', case when v_request_id is not null then v_request_payload end,
      'promotion_approved_by',v_approved_by,
      'promotion_approval_reason',v_approval_reason,
      'global_promotion_mode',v_global_mode,
      'global_promotion_value',v_global_value,
      'global_discount_amount',v_global_discount,
      'automatic_discount_amount',v_auto_discount,
      'manual_discount_amount',v_manual_discount
    )
  )
  returning id, sale_number
  into v_sale_id, v_sale_number;
  if v_approved_by is not null then
    update public.pos21_promotion_approvals a
    set consumed_sale_id=v_sale_id, consumed_at=now()
    where a.token=p_promo_approval_token;
  end if;

  -- ------------------------------------------------------------------------
  -- Segunda pasada: snapshots + descuento de stock.
  -- Se vuelven a tomar los productos bloqueados en esta misma transacción.
  -- El descuento global se conserva en cabecera; V1 no distribuye descuento
  -- entre líneas para evitar errores de redondeo contable.
  -- ------------------------------------------------------------------------
  for v_item in
    select value
    from jsonb_array_elements(p_items)
    order by (value ->> 'product_id')::uuid, nullif(value ->> 'variant_id','')::uuid
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;
    v_variant_id := nullif(v_item ->> 'variant_id','')::uuid;

    select p.*
    into v_product
    from public.products p
    where p.id = v_product_id
    for update;

    if v_variant_id is not null then
      select * into v_variant from public.product_variants where id=v_variant_id and product_id=v_product_id and is_active=true for update;
      if not found then raise exception 'VARIANT_NOT_AVAILABLE:%',v_variant_id; end if;
    end if;
    if v_product.is_service then
      v_unit_price:=round((v_item->>'service_unit_price')::numeric,2);
    else
      v_unit_price:=round(case when v_variant_id is null then coalesce(v_product.sale_price,v_product.price,0)
        else coalesce(v_variant.sale_price,v_variant.price,v_product.sale_price,v_product.price,0) end,2);
    end if;
    v_line_subtotal:=round(v_unit_price*v_quantity,2);
    v_mode:=lower(coalesce(nullif(btrim(v_item->>'promotion_mode'),''),'none'));
    v_value:=case when v_mode='none' then null else (v_item->>'promotion_value')::numeric end;
    v_manual_unit:=round(v_unit_price-public.pos21_promotional_unit_price(v_unit_price,v_mode,v_value),2);
    v_promo:=public.pos22_match_promotion(v_product.id,v_variant_id);
    v_auto_unit:=round(v_unit_price*coalesce((v_promo->>'percent')::numeric,0)/100,2);
    v_discount_unit:=round(v_manual_unit+v_auto_unit,2);
    v_line_discount:=round(v_discount_unit*v_quantity,2);
    v_name := v_product.name;
    if v_variant_id is not null then
      select v_product.name || ' · ' || coalesce(string_agg(label, ' · ' order by ord),v_variant.sku)
      into v_name
      from (
        select label, min(ord) as ord from (
          select nullif(btrim(v_variant.title),'') as label, 0 as ord
          union all
          select btrim(value #>> '{}'), 1 from jsonb_each(v_variant.attributes)
          where key not in ('image_url','photo_url') and jsonb_typeof(value) in ('string','number')
        ) labels where label is not null and label <> '' group by label
      ) unique_labels;
    end if;

    insert into public.pos_sale_items(
      sale_id,
      product_id,
      variant_id,
      sku,
      product_name,
      unit_price,
      quantity,
      line_subtotal,
      discount_amount,
      line_total,
      product_snapshot
    )
    values(
      v_sale_id,
      v_product.id,
      v_variant_id,
      case when v_variant_id is null then v_product.sku else v_variant.sku end,
      v_name,
      v_unit_price,
      v_quantity,
      v_line_subtotal,
      v_line_discount,
      round(v_line_subtotal-v_line_discount,2),
      jsonb_build_object(
        'variant_id',v_variant_id,
        'name', v_name,
        'sku', case when v_variant_id is null then v_product.sku else v_variant.sku end,
        'barcode', case when v_variant_id is null then v_product.barcode else v_variant.barcode end,
        'attributes', case when v_variant_id is not null then v_variant.attributes else '{}'::jsonb end,
        'brand', v_product.brand,
        'model', v_product.model,
        'condition', v_product.item_condition,
        'cover_image_url', case when v_variant_id is null then v_product.cover_image_url else coalesce(nullif(v_variant.attributes ->> 'image_url',''),nullif(v_variant.attributes ->> 'photo_url',''),v_product.cover_image_url) end,
        'currency', coalesce(v_product.currency,'MXN'),
        'catalog_price', v_product.price,
        'catalog_sale_price', v_product.sale_price,
        'pos_unit_price', v_unit_price,
        'promotion_mode',case when v_promo is not null and v_mode<>'none' then 'amount' when v_mode='none' and v_promo is not null then 'percent' else v_mode end,
        'promotion_value',case when v_promo is not null and v_mode<>'none' then v_discount_unit when v_mode='none' and v_promo is not null then (v_promo->>'percent')::numeric else v_value end,
        'automatic_promotion_id',v_promo->>'id',
        'automatic_promotion_title',v_promo->>'title',
        'automatic_discount',round(v_auto_unit*v_quantity,2),
        'manual_discount',round(v_manual_unit*v_quantity,2),
        'is_service',v_product.is_service,
        'promotion_unit_price',round(v_unit_price-v_discount_unit,2),
        'promotion_approved_by',v_approved_by
      )
    );

    if v_line_discount > 0 then
      insert into public.pos_sale_events(sale_id,employee_id,terminal_id,event_type,details)
      values(v_sale_id,v_employee.id,v_terminal.id,'price_changed_by_promotion',
        jsonb_build_object(
          'note','Cambio de precio por promoción',
          'product_id',v_product.id,'variant_id',v_variant_id,
          'sku',case when v_variant_id is null then v_product.sku else v_variant.sku end,
          'quantity',v_quantity,'promotion_mode',v_mode,'promotion_value',v_value,
          'automatic_promotion',v_promo,'automatic_savings',round(v_auto_unit*v_quantity,2),
          'manual_savings',round(v_manual_unit*v_quantity,2),
          'original_unit_price',v_unit_price,
          'promotional_unit_price',round(v_unit_price-v_discount_unit,2),
          'original_total',v_line_subtotal,'savings',v_line_discount,
          'charged_total',round(v_line_subtotal-v_line_discount,2),
          'approved_by',v_approved_by,'approval_reason',v_approval_reason
        ));
    end if;
    if not v_product.is_service then
    insert into public.inventory_movements(
      product_id,
      variant_id,
      order_id,
      pos_sale_id,
      movement_type,
      quantity_change,
      stock_before,
      stock_after,
      note
    )
    values(
      v_product.id,
      v_variant_id,
      null,
      v_sale_id,
      'sale',
      -v_quantity,
      case when v_variant_id is null then v_product.stock else v_variant.stock end,
      (case when v_variant_id is null then v_product.stock else v_variant.stock end) - v_quantity,
      format('Venta POS #%s · %s', v_sale_number, v_terminal.name)
    );

    if v_variant_id is null then
      update public.products p set stock=p.stock-v_quantity,updated_at=now() where p.id=v_product.id;
    else
      update public.product_variants pv set stock=pv.stock-v_quantity,updated_at=now() where pv.id=v_variant_id;
    end if;

    insert into public.pos_sale_events(
      sale_id,
      employee_id,
      terminal_id,
      event_type,
      details
    )
    values(
      v_sale_id,
      v_employee.id,
      v_terminal.id,
      'inventory_deducted',
      jsonb_build_object(
        'product_id', v_product.id,
        'variant_id',v_variant_id,
        'sku', case when v_variant_id is null then v_product.sku else v_variant.sku end,
        'quantity', v_quantity,
        'stock_before', case when v_variant_id is null then v_product.stock else v_variant.stock end,
        'stock_after', (case when v_variant_id is null then v_product.stock else v_variant.stock end)-v_quantity
      )
    );
    end if; -- service must not change stock
  end loop;

  -- Pagos.
  for v_payment in
    select value
    from jsonb_array_elements(p_payments)
  loop
    v_method := lower(btrim(v_payment ->> 'method'));
    v_amount := round((v_payment ->> 'amount')::numeric,2);
    v_reference := nullif(btrim(coalesce(v_payment ->> 'reference','')),'');

    insert into public.pos_payments(
      sale_id,
      method,
      amount,
      reference,
      metadata
    )
    values(
      v_sale_id,
      v_method,
      v_amount,
      v_reference,
      coalesce(v_payment -> 'metadata','{}'::jsonb)
    );

    insert into public.pos_sale_events(
      sale_id,
      employee_id,
      terminal_id,
      event_type,
      details
    )
    values(
      v_sale_id,
      v_employee.id,
      v_terminal.id,
      'payment_recorded',
      jsonb_build_object(
        'method', v_method,
        'amount', v_amount,
        'reference', v_reference
      )
    );
  end loop;

  if jsonb_array_length(p_payments)>1 then
    insert into public.pos_sale_events(sale_id,employee_id,terminal_id,event_type,details)
    values(v_sale_id,v_employee.id,v_terminal.id,'mixed_payment_recorded',
       jsonb_build_object('note','Pago mixto registrado por método e importe',
         'payments',(select jsonb_agg(jsonb_build_object('method',x->>'method',
               'amount',round((x->>'amount')::numeric,2),'reference',x->>'reference'))
             from jsonb_array_elements(p_payments) x),
         'total',v_payment_total));
  end if;
  insert into public.pos_sale_events(
    sale_id,
    employee_id,
    terminal_id,
    event_type,
    details
  )
  values(
    v_sale_id,
    v_employee.id,
    v_terminal.id,
    'sale_completed',
    jsonb_build_object(
      'sale_number', v_sale_number,
      'subtotal', v_subtotal,
      'discount_amount', v_discount,
      'total', v_total,
      'payment_total', v_payment_total
    )
  );

  return jsonb_build_object(
    'ok', true,
    'sale_id', v_sale_id,
    'sale_number', v_sale_number,
    'currency', 'MXN',
    'subtotal', v_subtotal,
    'discount_amount', v_discount,
    'total', v_total,
    'item_count', v_item_count
  );
end;
$function$;


revoke all on function public.pos_create_sale_v22(text,jsonb,jsonb,numeric,text,uuid) from PUBLIC,anon;
grant execute on function public.pos_create_sale_v22(text,jsonb,jsonb,numeric,text,uuid) to authenticated;
commit;
