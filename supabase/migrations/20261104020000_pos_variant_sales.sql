-- POS variant support; apply only after review and staging tests.
CREATE OR REPLACE FUNCTION public.pos_create_sale(p_device_token text, p_items jsonb, p_payments jsonb, p_discount_amount numeric DEFAULT 0, p_notes text DEFAULT NULL::text)
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

  v_subtotal numeric(12,2) := 0;
  v_discount numeric(12,2) := round(coalesce(p_discount_amount,0),2);
  v_total numeric(12,2) := 0;
  v_payment_total numeric(12,2) := 0;

  v_method text;
  v_amount numeric(12,2);
  v_reference text;

  v_max_discount numeric(12,2);
  v_item_count integer := 0;
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

  -- ------------------------------------------------------------------------
  -- A single product/variant must occur only once per request.
  -- Prevent repeated lines from bypassing stock checks in the first pass.
  if exists (
    select 1 from jsonb_array_elements(p_items) as item
    group by item ->> 'product_id', item ->> 'variant_id'
    having count(*) > 1
  ) then
    raise exception 'DUPLICATE_SALE_ITEM';
  end if;

  -- Primera pasada: bloquea inventario y calcula subtotal con precio servidor.
  -- ------------------------------------------------------------------------
  for v_item in
    select value
    from jsonb_array_elements(p_items)
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
    for update;

    if not found then
      raise exception 'PRODUCT_NOT_AVAILABLE:%', v_product_id;
    end if;

    if v_variant_id is not null then
      select * into v_variant from public.product_variants where id=v_variant_id and product_id=v_product_id and is_active=true for update;
      if not found then raise exception 'VARIANT_NOT_AVAILABLE:%',v_variant_id; end if;
    end if;
    if (case when v_variant_id is null then v_product.stock else v_variant.stock end) < v_quantity then
      raise exception
        'INSUFFICIENT_STOCK:%:AVAILABLE=%:REQUESTED=%',
        v_product.id,
        case when v_variant_id is null then v_product.stock else v_variant.stock end,
        v_quantity;
    end if;

    v_unit_price :=
      round(case when v_variant_id is null then coalesce(v_product.sale_price,v_product.price,0) else coalesce(v_variant.sale_price,v_variant.price,v_product.sale_price,v_product.price,0) end,2);

    if v_unit_price < 0 then
      raise exception 'INVALID_PRODUCT_PRICE:%', v_product.id;
    end if;

    v_line_subtotal := round(v_unit_price * v_quantity,2);
    v_subtotal := v_subtotal + v_line_subtotal;
    v_item_count := v_item_count + v_quantity;
  end loop;

  v_subtotal := round(v_subtotal,2);

  if v_discount < 0 then
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

  if v_discount > v_max_discount then
    raise exception
      'DISCOUNT_NOT_AUTHORIZED:MAX=%',
      v_max_discount;
  end if;

  if v_discount > v_subtotal then
    raise exception 'DISCOUNT_EXCEEDS_SUBTOTAL';
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

    if v_amount is null or v_amount <= 0 then
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
      'item_count', v_item_count
    )
  )
  returning id, sale_number
  into v_sale_id, v_sale_number;

  -- ------------------------------------------------------------------------
  -- Segunda pasada: snapshots + descuento de stock.
  -- Se vuelven a tomar los productos bloqueados en esta misma transacción.
  -- El descuento global se conserva en cabecera; V1 no distribuye descuento
  -- entre líneas para evitar errores de redondeo contable.
  -- ------------------------------------------------------------------------
  for v_item in
    select value
    from jsonb_array_elements(p_items)
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
    v_unit_price := round(case when v_variant_id is null then coalesce(v_product.sale_price,v_product.price,0) else coalesce(v_variant.sale_price,v_variant.price,v_product.sale_price,v_product.price,0) end,2);

    v_line_subtotal := round(v_unit_price * v_quantity,2);

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
      case when v_variant_id is null then v_product.name else v_product.name || ' · ' || coalesce(nullif(v_variant.title,''),v_variant.sku,'Variante') end,
      v_unit_price,
      v_quantity,
      v_line_subtotal,
      0,
      v_line_subtotal,
      jsonb_build_object(
        'variant_id',v_variant_id,
        'name', v_product.name,
        'sku', v_product.sku,
        'brand', v_product.brand,
        'model', v_product.model,
        'condition', v_product.item_condition,
        'cover_image_url', v_product.cover_image_url,
        'currency', coalesce(v_product.currency,'MXN'),
        'catalog_price', v_product.price,
        'catalog_sale_price', v_product.sale_price,
        'pos_unit_price', v_unit_price
      )
    );

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
        'sku', v_product.sku,
        'quantity', v_quantity,
        'stock_before', case when v_variant_id is null then v_product.stock else v_variant.stock end,
        'stock_after', (case when v_variant_id is null then v_product.stock else v_variant.stock end)-v_quantity
      )
    );
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


CREATE OR REPLACE FUNCTION public.pos_void_sale(p_device_token text, p_sale_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_employee public.pos_employees%rowtype;
  v_terminal public.pos_terminals%rowtype;
  v_shift public.pos_shifts%rowtype;
  v_sale public.pos_sales%rowtype;
  v_item record;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_reason text;
begin
  v_reason := btrim(coalesce(p_reason,''));

  if length(v_reason) < 4 then
    raise exception 'VOID_REASON_REQUIRED';
  end if;

  select e.*
  into v_employee
  from public.pos_employees e
  where e.auth_user_id = auth.uid();

  if not found or v_employee.status <> 'active' then
    raise exception 'POS_EMPLOYEE_NOT_ACTIVE';
  end if;

  if v_employee.role not in ('supervisor','pos_admin') then
    raise exception 'SUPERVISOR_REQUIRED';
  end if;

  select t.*
  into v_terminal
  from public.pos_terminals t
  where t.status = 'active'
    and t.device_token_hash =
      extensions.digest(
        convert_to(coalesce(p_device_token,''),'UTF8'),
        'sha256'
      );

  if not found then
    raise exception 'TERMINAL_NOT_AUTHORIZED';
  end if;

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

  select ps.*
  into v_sale
  from public.pos_sales ps
  where ps.id = p_sale_id
  for update;

  if not found then
    raise exception 'SALE_NOT_FOUND';
  end if;

  if v_sale.status <> 'completed' then
    raise exception 'SALE_NOT_REVERSIBLE:%', v_sale.status;
  end if;

  if v_sale.shift_id <> v_shift.id then
    raise exception 'VOID_ONLY_CURRENT_SHIFT';
  end if;

  for v_item in
    select psi.product_id, psi.variant_id, psi.quantity, psi.sku
    from public.pos_sale_items psi
    where psi.sale_id = v_sale.id
  loop
    select p.*
    into v_product
    from public.products p
    where p.id = v_item.product_id
    for update;

    if not found then
      raise exception 'PRODUCT_NOT_FOUND:%', v_item.product_id;
    end if;

    if v_item.variant_id is not null then
      select * into v_variant from public.product_variants where id=v_item.variant_id and product_id=v_item.product_id for update;
      if not found then raise exception 'VARIANT_NOT_FOUND:%',v_item.variant_id; end if;
    end if;
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
      v_item.variant_id,
      null,
      v_sale.id,
      'sale',
      v_item.quantity,
      case when v_item.variant_id is null then v_product.stock else v_variant.stock end,
      (case when v_item.variant_id is null then v_product.stock else v_variant.stock end)+v_item.quantity,
      format(
        'ANULACIÓN POS #%s · reposición de inventario · %s',
        v_sale.sale_number,
        v_reason
      )
    );

    if v_item.variant_id is null then
      update public.products p set stock=p.stock+v_item.quantity,updated_at=now() where p.id=v_product.id;
    else
      update public.product_variants pv set stock=pv.stock+v_item.quantity,updated_at=now() where pv.id=v_item.variant_id;
    end if;

    insert into public.pos_sale_events(
      sale_id,
      employee_id,
      terminal_id,
      event_type,
      details
    )
    values(
      v_sale.id,
      v_employee.id,
      v_terminal.id,
      'inventory_restored',
      jsonb_build_object(
        'operation', 'void',
        'product_id', v_product.id,
        'variant_id',v_item.variant_id,
        'sku', v_item.sku,
        'quantity', v_item.quantity,
        'stock_before', case when v_item.variant_id is null then v_product.stock else v_variant.stock end,
        'stock_after', (case when v_item.variant_id is null then v_product.stock else v_variant.stock end)+v_item.quantity
      )
    );
  end loop;

  update public.pos_sales ps
  set
    status = 'voided',
    voided_at = now(),
    voided_by = v_employee.id,
    void_reason = v_reason,
    updated_at = now()
  where ps.id = v_sale.id;

  insert into public.pos_sale_events(
    sale_id,
    employee_id,
    terminal_id,
    event_type,
    details
  )
  values(
    v_sale.id,
    v_employee.id,
    v_terminal.id,
    'sale_voided',
    jsonb_build_object(
      'sale_number', v_sale.sale_number,
      'amount', v_sale.total,
      'reason', v_reason
    )
  );

  return jsonb_build_object(
    'ok', true,
    'operation', 'void',
    'sale_id', v_sale.id,
    'sale_number', v_sale.sale_number,
    'amount', v_sale.total,
    'status', 'voided'
  );
end;
$function$;


CREATE OR REPLACE FUNCTION public.pos_refund_sale(p_device_token text, p_sale_id uuid, p_method text, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_employee public.pos_employees%rowtype;
  v_terminal public.pos_terminals%rowtype;
  v_shift public.pos_shifts%rowtype;
  v_sale public.pos_sales%rowtype;
  v_item record;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_refund_id uuid;
  v_refund_number bigint;
  v_method text;
  v_reason text;
begin
  v_method := lower(btrim(coalesce(p_method,'')));
  v_reason := btrim(coalesce(p_reason,''));

  if v_method not in ('cash','card_terminal','transfer','other') then
    raise exception 'INVALID_REFUND_METHOD';
  end if;

  if length(v_reason) < 4 then
    raise exception 'REFUND_REASON_REQUIRED';
  end if;

  select e.*
  into v_employee
  from public.pos_employees e
  where e.auth_user_id = auth.uid();

  if not found or v_employee.status <> 'active' then
    raise exception 'POS_EMPLOYEE_NOT_ACTIVE';
  end if;

  if v_employee.role not in ('supervisor','pos_admin') then
    raise exception 'SUPERVISOR_REQUIRED';
  end if;

  select t.*
  into v_terminal
  from public.pos_terminals t
  where t.status = 'active'
    and t.device_token_hash =
      extensions.digest(
        convert_to(coalesce(p_device_token,''),'UTF8'),
        'sha256'
      );

  if not found then
    raise exception 'TERMINAL_NOT_AUTHORIZED';
  end if;

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

  select ps.*
  into v_sale
  from public.pos_sales ps
  where ps.id = p_sale_id
  for update;

  if not found then
    raise exception 'SALE_NOT_FOUND';
  end if;

  if v_sale.status <> 'completed' then
    raise exception 'SALE_NOT_REFUNDABLE:%', v_sale.status;
  end if;

  if exists(
    select 1
    from public.pos_refunds pr
    where pr.sale_id = v_sale.id
  ) then
    raise exception 'SALE_ALREADY_REFUNDED';
  end if;

  for v_item in
    select psi.product_id, psi.variant_id, psi.quantity, psi.sku
    from public.pos_sale_items psi
    where psi.sale_id = v_sale.id
  loop
    select p.*
    into v_product
    from public.products p
    where p.id = v_item.product_id
    for update;

    if not found then
      raise exception 'PRODUCT_NOT_FOUND:%', v_item.product_id;
    end if;

    if v_item.variant_id is not null then
      select * into v_variant from public.product_variants where id=v_item.variant_id and product_id=v_item.product_id for update;
      if not found then raise exception 'VARIANT_NOT_FOUND:%',v_item.variant_id; end if;
    end if;
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
      v_item.variant_id,
      null,
      v_sale.id,
      'sale',
      v_item.quantity,
      case when v_item.variant_id is null then v_product.stock else v_variant.stock end,
      (case when v_item.variant_id is null then v_product.stock else v_variant.stock end)+v_item.quantity,
      format(
        'DEVOLUCIÓN POS #%s · reposición de inventario · %s',
        v_sale.sale_number,
        v_reason
      )
    );

    if v_item.variant_id is null then
      update public.products p set stock=p.stock+v_item.quantity,updated_at=now() where p.id=v_product.id;
    else
      update public.product_variants pv set stock=pv.stock+v_item.quantity,updated_at=now() where pv.id=v_item.variant_id;
    end if;

    insert into public.pos_sale_events(
      sale_id,
      employee_id,
      terminal_id,
      event_type,
      details
    )
    values(
      v_sale.id,
      v_employee.id,
      v_terminal.id,
      'inventory_restored',
      jsonb_build_object(
        'operation', 'refund',
        'product_id', v_product.id,
        'variant_id',v_item.variant_id,
        'sku', v_item.sku,
        'quantity', v_item.quantity,
        'stock_before', case when v_item.variant_id is null then v_product.stock else v_variant.stock end,
        'stock_after', (case when v_item.variant_id is null then v_product.stock else v_variant.stock end)+v_item.quantity
      )
    );
  end loop;

  insert into public.pos_refunds(
    sale_id,
    shift_id,
    employee_id,
    terminal_id,
    method,
    amount,
    reason,
    metadata
  )
  values(
    v_sale.id,
    v_shift.id,
    v_employee.id,
    v_terminal.id,
    v_method,
    v_sale.total,
    v_reason,
    jsonb_build_object(
      'original_shift_id', v_sale.shift_id,
      'sale_number', v_sale.sale_number
    )
  )
  returning id, refund_number
  into v_refund_id, v_refund_number;

  update public.pos_sales ps
  set
    status = 'refunded',
    refunded_at = now(),
    refunded_by = v_employee.id,
    refund_reason = v_reason,
    updated_at = now()
  where ps.id = v_sale.id;

  insert into public.pos_sale_events(
    sale_id,
    employee_id,
    terminal_id,
    event_type,
    details
  )
  values(
    v_sale.id,
    v_employee.id,
    v_terminal.id,
    'refund_recorded',
    jsonb_build_object(
      'refund_id', v_refund_id,
      'refund_number', v_refund_number,
      'method', v_method,
      'amount', v_sale.total,
      'reason', v_reason,
      'refund_shift_id', v_shift.id
    )
  );

  insert into public.pos_sale_events(
    sale_id,
    employee_id,
    terminal_id,
    event_type,
    details
  )
  values(
    v_sale.id,
    v_employee.id,
    v_terminal.id,
    'sale_refunded',
    jsonb_build_object(
      'sale_number', v_sale.sale_number,
      'refund_number', v_refund_number,
      'amount', v_sale.total
    )
  );

  return jsonb_build_object(
    'ok', true,
    'operation', 'refund',
    'sale_id', v_sale.id,
    'sale_number', v_sale.sale_number,
    'refund_id', v_refund_id,
    'refund_number', v_refund_number,
    'method', v_method,
    'amount', v_sale.total,
    'status', 'refunded'
  );
end;
$function$;

