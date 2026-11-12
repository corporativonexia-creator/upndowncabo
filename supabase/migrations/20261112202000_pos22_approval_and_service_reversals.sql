begin;
CREATE OR REPLACE FUNCTION public.pos22_issue_promotion_approval(p_cashier_employee_id uuid, p_items jsonb, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare admin_employee public.pos_employees%rowtype;
declare cashier_employee public.pos_employees%rowtype;
declare item jsonb;
declare product public.products%rowtype;
declare variant public.product_variants%rowtype;
declare qty integer;
declare variant_id uuid;
declare base numeric(12,2);
declare price_after numeric(12,2);
declare total_discount numeric(12,2):=0;
declare sub_total numeric(12,2):=0;
declare issued uuid;
declare v_promo jsonb;
declare v_auto_discount numeric(12,2):=0;
declare v_global_mode text:='none';
declare v_global_value numeric:=0;
declare v_global_discount numeric(12,2):=0;
begin
 select * into admin_employee from public.pos_employees
 where auth_user_id=auth.uid() and status='active' and role='pos_admin';
 if not found then raise exception 'POS_ADMIN_REQUIRED';end if;
 if length(btrim(coalesce(p_reason,'')))<6 then raise exception 'PROMOTION_APPROVAL_REASON_REQUIRED';end if;
 select * into cashier_employee from public.pos_employees
 where id=p_cashier_employee_id and status='active';
 if not found then raise exception 'INVALID_CASHIER';end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then
   raise exception 'SALE_ITEMS_REQUIRED';
 end if;
 if exists(select 1 from jsonb_array_elements(p_items) as duplicate(value)
    group by (duplicate.value->>'product_id')::uuid,
             nullif(duplicate.value->>'variant_id','')::uuid
    having count(*)>1) then raise exception 'DUPLICATE_SALE_ITEM';end if;
 for item in select value from jsonb_array_elements(p_items) loop
   begin
     qty=(item->>'quantity')::integer;
     variant_id=nullif(item->>'variant_id','')::uuid;
   exception when others then raise exception 'INVALID_SALE_ITEM';end;
   if qty is null or qty<1 then raise exception 'INVALID_SALE_ITEM';end if;
   select * into product from public.products where id=(item->>'product_id')::uuid
       and status='active' and pos_visible=true;
   if not found then raise exception 'PRODUCT_NOT_AVAILABLE';end if;
   if variant_id is not null then
     select * into variant from public.product_variants
       where id=variant_id and product_id=product.id and is_active=true;
     if not found then raise exception 'VARIANT_NOT_AVAILABLE';end if;
   else
     if exists(select 1 from public.product_variants where product_id=product.id)
       then raise exception 'VARIANT_REQUIRED';end if;
   end if;
   if product.is_service then
     if variant_id is not null then raise exception 'SERVICE_VARIANT_NOT_ALLOWED';end if;
     begin base:=round((item->>'service_unit_price')::numeric,2);
     exception when others then raise exception 'SERVICE_PRICE_REQUIRED';end;
     if base is null or base<=0 or base>99999999 then raise exception 'INVALID_SERVICE_PRICE';end if;
   else
     if item ? 'service_unit_price' then raise exception 'PRICE_OVERRIDE_NOT_ALLOWED';end if;
     base:=round(case when variant_id is null then coalesce(product.sale_price,product.price,0)
        else coalesce(variant.sale_price,variant.price,product.sale_price,product.price,0) end,2);
   end if;
   price_after:=public.pos21_promotional_unit_price(base,item->>'promotion_mode',
       case when lower(coalesce(item->>'promotion_mode','none'))='none' then null
          else (item->>'promotion_value')::numeric end);
   v_promo:=public.pos22_match_promotion(product.id,variant_id);
   v_auto_discount:=round(v_auto_discount+round(base*coalesce((v_promo->>'percent')::numeric,0)/100,2)*qty,2);
   if (base-price_after)+round(base*coalesce((v_promo->>'percent')::numeric,0)/100,2)>base then
     raise exception 'STACKED_DISCOUNT_EXCEEDS_ITEM_PRICE';
   end if;
   total_discount:=round(total_discount+(base-price_after)*qty,2);
   sub_total:=round(sub_total+base*qty,2);
 end loop;

 v_global_mode:=lower(coalesce(nullif(btrim(p_items #>> '{0,global_promotion_mode}'),''),'none'));
 begin v_global_value:=case when v_global_mode='none' then 0
                      else (p_items #>> '{0,global_promotion_value}')::numeric end;
 exception when others then raise exception 'INVALID_GLOBAL_PROMOTION';end;
 if v_global_value is null or v_global_value<0 or v_global_value::text in ('NaN','Infinity','-Infinity')
 then raise exception 'INVALID_GLOBAL_PROMOTION';end if;
 case v_global_mode
   when 'none' then v_global_discount:=0;
   when 'percent' then
     if v_global_value>100 then raise exception 'INVALID_GLOBAL_PERCENT';end if;
     v_global_discount:=round(sub_total*v_global_value/100,2);
   when 'amount' then v_global_discount:=round(v_global_value,2);
   when 'final' then v_global_discount:=round(sub_total-v_global_value,2);
   else raise exception 'INVALID_GLOBAL_MODE';
 end case;
 if v_global_discount<0 or v_global_discount>sub_total then raise exception 'INVALID_GLOBAL_DISCOUNT';end if;
 total_discount:=round(total_discount+v_global_discount,2);
 if total_discount<=0 then raise exception 'NO_PROMOTION_TO_APPROVE';end if;
 if total_discount+v_auto_discount>=sub_total then raise exception 'ZERO_OR_NEGATIVE_TOTAL_NOT_ALLOWED';end if;
 insert into public.pos21_promotion_approvals(cashier_employee_id,approved_by,items,approved_discount,reason)
 values(cashier_employee.id,admin_employee.id,p_items,total_discount,btrim(p_reason))
 returning token into issued;
 return issued;
end;
$function$


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
    order by psi.product_id, psi.variant_id, psi.id
  loop
    select p.*
    into v_product
    from public.products p
    where p.id = v_item.product_id
    for update;

    if not found then
      raise exception 'PRODUCT_NOT_FOUND:%', v_item.product_id;
    end if;
    if v_product.is_service then continue; end if; -- No reponer stock en servicios

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
$function$


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
  if (select count(distinct method) from public.pos_payments
      where sale_id=v_sale.id)>1 then
    raise exception 'MIXED_REFUND_REQUIRES_POS21';
  end if;

  for v_item in
    select psi.product_id, psi.variant_id, psi.quantity, psi.sku
    from public.pos_sale_items psi
    where psi.sale_id = v_sale.id
    order by psi.product_id, psi.variant_id, psi.id
  loop
    select p.*
    into v_product
    from public.products p
    where p.id = v_item.product_id
    for update;

    if not found then
      raise exception 'PRODUCT_NOT_FOUND:%', v_item.product_id;
    end if;
    if v_product.is_service then continue; end if; -- No reponer stock en servicios

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
$function$


CREATE OR REPLACE FUNCTION public.pos_refund_sale_v21(p_device_token text, p_sale_id uuid, p_allocations jsonb, p_reason text)
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
  v_entry jsonb;
  v_group record;
  v_amount numeric;
  v_allocated numeric:=0;
  v_count integer;
  v_match_count integer;
  v_match_amount numeric;
begin
  v_method := 'other'; -- detail table is the source of payment methods
  v_reason := btrim(coalesce(p_reason,''));
  if p_allocations is null or jsonb_typeof(p_allocations)<>'array'
     or jsonb_array_length(p_allocations) not between 2 and 4 then
    raise exception 'INVALID_MIXED_REFUND_ALLOCATIONS';
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
  -- Validate the exact original payment-method totals; no client pricing trust.
  select count(*) into v_count from
    (select method from public.pos_payments where sale_id=v_sale.id group by method) methods;
  if v_count<2 or jsonb_array_length(p_allocations)<>v_count then
    raise exception 'MIXED_REFUND_METHODS_MISMATCH';
  end if;
  if exists(select 1 from jsonb_array_elements(p_allocations) as x(value)
    group by x.value->>'method' having count(*)>1) then
    raise exception 'DUPLICATE_REFUND_METHOD';
  end if;
  for v_entry in select value from jsonb_array_elements(p_allocations) loop
    if v_entry->>'method' not in ('cash','card_terminal','transfer','other') then
      raise exception 'INVALID_REFUND_METHOD';
    end if;
    begin
      v_amount:=(v_entry->>'amount')::numeric;
    exception when others then raise exception 'INVALID_REFUND_AMOUNT'; end;
    if v_amount is null or v_amount<=0 or v_amount<>round(v_amount,2)
       or v_amount::text in ('NaN','Infinity','-Infinity') then
      raise exception 'INVALID_REFUND_AMOUNT';
    end if;
    if length(coalesce(v_entry->>'reference',''))>150 then
      raise exception 'REFUND_REFERENCE_TOO_LONG';
    end if;
    v_allocated:=v_allocated+v_amount;
  end loop;
  if round(v_allocated,2)<>v_sale.total then raise exception 'REFUND_TOTAL_MISMATCH';end if;
  for v_group in
    select method,round(sum(amount),2) as amount
    from public.pos_payments where sale_id=v_sale.id group by method
  loop
    select count(*),coalesce(sum((x.value->>'amount')::numeric),0)
      into v_match_count,v_match_amount
    from jsonb_array_elements(p_allocations) as x(value)
    where x.value->>'method'=v_group.method;
    if v_match_count<>1 or round(v_match_amount,2)<>v_group.amount then
      raise exception 'REFUND_ORIGINAL_PAYMENT_MISMATCH:%',v_group.method;
    end if;
  end loop;

  for v_item in
    select psi.product_id, psi.variant_id, psi.quantity, psi.sku
    from public.pos_sale_items psi
    where psi.sale_id = v_sale.id
    order by psi.product_id, psi.variant_id, psi.id
  loop
    select p.*
    into v_product
    from public.products p
    where p.id = v_item.product_id
    for update;

    if not found then
      raise exception 'PRODUCT_NOT_FOUND:%', v_item.product_id;
    end if;
    if v_product.is_service then continue; end if; -- No reponer stock en servicios

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
      'sale_number', v_sale.sale_number,
      'mixed_payment',true,'allocations',p_allocations
    )
  )
  returning id, refund_number
  into v_refund_id, v_refund_number;

  for v_entry in select value from jsonb_array_elements(p_allocations) loop
    insert into public.pos21_refund_allocations(refund_id,method,amount,reference)
    values(v_refund_id,v_entry->>'method',(v_entry->>'amount')::numeric,
      nullif(btrim(coalesce(v_entry->>'reference','')),''));
  end loop;

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
      'allocations',p_allocations,
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
      'allocations',p_allocations,
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
    'method', v_method,'allocations',p_allocations,
    'amount', v_sale.total,
    'status', 'refunded'
  );
end;
$function$
;
revoke all on function public.pos22_issue_promotion_approval(uuid,jsonb,text) from PUBLIC,anon;
grant execute on function public.pos22_issue_promotion_approval(uuid,jsonb,text) to authenticated;
commit;
