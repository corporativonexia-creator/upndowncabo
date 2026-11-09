begin;
create table if not exists public.pos21_refund_allocations (
  id uuid primary key default gen_random_uuid(),
  refund_id uuid not null references public.pos_refunds(id) on delete restrict,
  method text not null check(method in ('cash','card_terminal','transfer','other')),
  amount numeric(12,2) not null check(amount>0),
  reference text,
  created_at timestamptz not null default now(),
  unique(refund_id,method)
);
create index if not exists pos21_refund_allocations_refund_idx on public.pos21_refund_allocations(refund_id);
alter table public.pos21_refund_allocations enable row level security;
revoke all on public.pos21_refund_allocations from public,anon,authenticated;
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
$function$;
CREATE OR REPLACE FUNCTION public.pos_close_shift(p_device_token text, p_closing_cash numeric, p_notes text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_employee public.pos_employees%rowtype;
  v_terminal public.pos_terminals%rowtype;
  v_shift public.pos_shifts%rowtype;
  v_cash_sales numeric(12,2) := 0;
  v_cash_refunds numeric(12,2) := 0;
  v_cash_in numeric(12,2) := 0;
  v_cash_out numeric(12,2) := 0;
  v_expected numeric(12,2) := 0;
  v_difference numeric(12,2) := 0;
begin
  select e.*
  into v_employee
  from public.pos_employees e
  where e.auth_user_id = auth.uid();

  if not found or v_employee.status <> 'active' then
    raise exception 'EMPLOYEE_NOT_ACTIVE';
  end if;

  select t.*
  into v_terminal
  from public.pos_terminals t
  where t.status = 'active'
    and t.device_token_hash =
      extensions.digest(convert_to(coalesce(p_device_token,''),'UTF8'),'sha256');

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

  if p_closing_cash is null or p_closing_cash < 0 then
    raise exception 'INVALID_CLOSING_CASH';
  end if;

  select coalesce(sum(pp.amount),0)
  into v_cash_sales
  from public.pos_payments pp
  join public.pos_sales ps on ps.id = pp.sale_id
  where ps.shift_id = v_shift.id
    and ps.status in ('completed','refunded')
    and pp.method = 'cash';

  select coalesce(sum(case when exists(
       select 1 from public.pos21_refund_allocations ra where ra.refund_id=pr.id)
     then coalesce((select sum(ra.amount) from public.pos21_refund_allocations ra
             where ra.refund_id=pr.id and ra.method='cash'),0)
     else case when pr.method='cash' then pr.amount else 0 end end),0)
  into v_cash_refunds from public.pos_refunds pr where pr.shift_id=v_shift.id;

  select coalesce(sum(pcm.amount),0)
  into v_cash_in
  from public.pos_cash_movements pcm
  where pcm.shift_id = v_shift.id
    and pcm.movement_type = 'cash_in';

  select coalesce(sum(pcm.amount),0)
  into v_cash_out
  from public.pos_cash_movements pcm
  where pcm.shift_id = v_shift.id
    and pcm.movement_type = 'cash_out';

  v_cash_sales := round(v_cash_sales,2);
  v_cash_refunds := round(v_cash_refunds,2);
  v_cash_in := round(v_cash_in,2);
  v_cash_out := round(v_cash_out,2);

  v_expected := round(
    v_shift.opening_cash + v_cash_sales + v_cash_in - v_cash_out - v_cash_refunds,
    2
  );

  v_difference := round(p_closing_cash - v_expected,2);

  update public.pos_shifts s
  set
    status = 'closed',
    closing_cash = round(p_closing_cash,2),
    expected_cash = v_expected,
    difference = v_difference,
    notes = nullif(btrim(coalesce(p_notes,'')),''),
    closed_at = now()
  where s.id = v_shift.id;

  insert into public.pos_access_log(
    employee_id,
    terminal_id,
    event_type,
    success,
    details
  )
  values(
    v_employee.id,
    v_terminal.id,
    'shift_closed',
    true,
    jsonb_build_object(
      'shift_id', v_shift.id,
      'opening_cash', v_shift.opening_cash,
      'cash_sales', v_cash_sales,
      'cash_refunds', v_cash_refunds,
      'cash_in', v_cash_in,
      'cash_out', v_cash_out,
      'expected_cash', v_expected,
      'closing_cash', round(p_closing_cash,2),
      'difference', v_difference
    )
  );

  return jsonb_build_object(
    'ok', true,
    'shift_id', v_shift.id,
    'opening_cash', v_shift.opening_cash,
    'cash_sales', v_cash_sales,
    'cash_refunds', v_cash_refunds,
    'cash_in', v_cash_in,
    'cash_out', v_cash_out,
    'expected_cash', v_expected,
    'closing_cash', round(p_closing_cash,2),
    'difference', v_difference
  );
end;
$function$;
CREATE OR REPLACE FUNCTION public.pos_get_current_shift_sales(p_device_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_employee public.pos_employees%rowtype;
  v_terminal public.pos_terminals%rowtype;
  v_shift public.pos_shifts%rowtype;
  v_sales jsonb;
  v_refunds jsonb;
  v_cash_movements jsonb;
  v_cash_sales numeric(12,2) := 0;
  v_cash_refunds numeric(12,2) := 0;
  v_cash_in numeric(12,2) := 0;
  v_cash_out numeric(12,2) := 0;
  v_expected_cash numeric(12,2) := 0;
begin
  select e.* into v_employee from public.pos_employees e where e.auth_user_id = auth.uid() and e.status = 'active';
  if not found then raise exception 'POS_EMPLOYEE_NOT_ACTIVE'; end if;
  select t.* into v_terminal from public.pos_terminals t where t.status = 'active' and t.device_token_hash = extensions.digest(convert_to(coalesce(p_device_token,''),'UTF8'),'sha256');
  if not found then raise exception 'TERMINAL_NOT_AUTHORIZED'; end if;
  select s.* into v_shift from public.pos_shifts s where s.employee_id = v_employee.id and s.terminal_id = v_terminal.id and s.status = 'open' order by s.opened_at desc limit 1;
  if not found then raise exception 'NO_OPEN_SHIFT'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', ps.id,'sale_number',ps.sale_number,'status',ps.status,'currency',ps.currency,
    'subtotal',ps.subtotal,'discount_amount',ps.discount_amount,'total',ps.total,'created_at',ps.created_at,
    'void_reason',ps.void_reason,'refund_reason',ps.refund_reason,
    'items',(select coalesce(jsonb_agg(jsonb_build_object(
      'product_id',psi.product_id,'sku',psi.sku,'product_name',psi.product_name,
      'unit_price',psi.unit_price,'quantity',psi.quantity,'line_total',psi.line_total,
      'line_subtotal',psi.line_subtotal,'discount_amount',psi.discount_amount,
      'promotion_mode',psi.product_snapshot->>'promotion_mode',
      'promotion_value',psi.product_snapshot->>'promotion_value',
      'promotional_unit_price',psi.product_snapshot->>'promotion_unit_price',
      'category_name',coalesce(c.name,'OTROS')
    ) order by psi.created_at),'[]'::jsonb)
      from public.pos_sale_items psi
      left join public.products p on p.id=psi.product_id
      left join public.categories c on c.id=p.category_id
      where psi.sale_id=ps.id),
    'payments',(select coalesce(jsonb_agg(jsonb_build_object('method',pp.method,'amount',pp.amount,'reference',pp.reference) order by pp.created_at),'[]'::jsonb) from public.pos_payments pp where pp.sale_id=ps.id)
  ) order by ps.created_at desc),'[]'::jsonb) into v_sales from public.pos_sales ps where ps.shift_id=v_shift.id;

  select coalesce(jsonb_agg(jsonb_build_object('id',pr.id,'refund_number',pr.refund_number,'sale_id',pr.sale_id,'sale_number',ps.sale_number,'method',pr.method,'amount',pr.amount,'reason',pr.reason,'created_at',pr.created_at,
 'allocations',coalesce((select jsonb_agg(jsonb_build_object('method',ra.method,'amount',ra.amount,'reference',ra.reference)
   order by ra.method) from public.pos21_refund_allocations ra where ra.refund_id=pr.id),'[]'::jsonb)) order by pr.created_at desc),'[]'::jsonb)
  into v_refunds from public.pos_refunds pr join public.pos_sales ps on ps.id=pr.sale_id where pr.shift_id=v_shift.id;

  select coalesce(jsonb_agg(jsonb_build_object('id',pcm.id,'movement_type',pcm.movement_type,'amount',pcm.amount,'reason',pcm.reason,'created_at',pcm.created_at) order by pcm.created_at desc),'[]'::jsonb)
  into v_cash_movements from public.pos_cash_movements pcm where pcm.shift_id=v_shift.id;

  select coalesce(sum(pp.amount),0) into v_cash_sales from public.pos_payments pp join public.pos_sales ps on ps.id=pp.sale_id where ps.shift_id=v_shift.id and ps.status in ('completed','refunded') and pp.method='cash';
 select coalesce(sum(case when exists( select 1 from public.pos21_refund_allocations ra where ra.refund_id=pr.id) then coalesce((select sum(ra.amount) from public.pos21_refund_allocations ra where ra.refund_id=pr.id and ra.method='cash'),0) else case when pr.method='cash' then pr.amount else 0 end end),0) into v_cash_refunds from public.pos_refunds pr where pr.shift_id=v_shift.id;
  select coalesce(sum(pcm.amount),0) into v_cash_in from public.pos_cash_movements pcm where pcm.shift_id=v_shift.id and pcm.movement_type='cash_in';
  select coalesce(sum(pcm.amount),0) into v_cash_out from public.pos_cash_movements pcm where pcm.shift_id=v_shift.id and pcm.movement_type='cash_out';
  v_cash_sales:=round(v_cash_sales,2); v_cash_refunds:=round(v_cash_refunds,2); v_cash_in:=round(v_cash_in,2); v_cash_out:=round(v_cash_out,2);
  v_expected_cash:=round(v_shift.opening_cash+v_cash_sales+v_cash_in-v_cash_out-v_cash_refunds,2);
  return jsonb_build_object('shift_id',v_shift.id,'opening_cash',v_shift.opening_cash,'cash_sales',v_cash_sales,'cash_refunds',v_cash_refunds,'cash_in',v_cash_in,'cash_out',v_cash_out,'expected_cash',v_expected_cash,'sales',v_sales,'refunds',v_refunds,'cash_movements',v_cash_movements);
end;
$function$;
revoke all on function public.pos_refund_sale_v21(text,uuid,jsonb,text) from public,anon;
grant execute on function public.pos_refund_sale_v21(text,uuid,jsonb,text) to authenticated;
commit;