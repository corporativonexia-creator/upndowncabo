begin;
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

  select coalesce(jsonb_agg(jsonb_build_object('id',pr.id,'refund_number',pr.refund_number,'sale_id',pr.sale_id,'sale_number',ps.sale_number,'method',pr.method,'amount',pr.amount,'reason',pr.reason,'created_at',pr.created_at) order by pr.created_at desc),'[]'::jsonb)
  into v_refunds from public.pos_refunds pr join public.pos_sales ps on ps.id=pr.sale_id where pr.shift_id=v_shift.id;

  select coalesce(jsonb_agg(jsonb_build_object('id',pcm.id,'movement_type',pcm.movement_type,'amount',pcm.amount,'reason',pcm.reason,'created_at',pcm.created_at) order by pcm.created_at desc),'[]'::jsonb)
  into v_cash_movements from public.pos_cash_movements pcm where pcm.shift_id=v_shift.id;

  select coalesce(sum(pp.amount),0) into v_cash_sales from public.pos_payments pp join public.pos_sales ps on ps.id=pp.sale_id where ps.shift_id=v_shift.id and ps.status in ('completed','refunded') and pp.method='cash';
  select coalesce(sum(pr.amount),0) into v_cash_refunds from public.pos_refunds pr where pr.shift_id=v_shift.id and pr.method='cash';
  select coalesce(sum(pcm.amount),0) into v_cash_in from public.pos_cash_movements pcm where pcm.shift_id=v_shift.id and pcm.movement_type='cash_in';
  select coalesce(sum(pcm.amount),0) into v_cash_out from public.pos_cash_movements pcm where pcm.shift_id=v_shift.id and pcm.movement_type='cash_out';
  v_cash_sales:=round(v_cash_sales,2); v_cash_refunds:=round(v_cash_refunds,2); v_cash_in:=round(v_cash_in,2); v_cash_out:=round(v_cash_out,2);
  v_expected_cash:=round(v_shift.opening_cash+v_cash_sales+v_cash_in-v_cash_out-v_cash_refunds,2);
  return jsonb_build_object('shift_id',v_shift.id,'opening_cash',v_shift.opening_cash,'cash_sales',v_cash_sales,'cash_refunds',v_cash_refunds,'cash_in',v_cash_in,'cash_out',v_cash_out,'expected_cash',v_expected_cash,'sales',v_sales,'refunds',v_refunds,'cash_movements',v_cash_movements);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.pos_lookup_sale(p_device_token text, p_sale_number bigint)
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
  v_items jsonb;
  v_payments jsonb;
begin
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
  limit 1;

  if not found then
    raise exception 'NO_OPEN_SHIFT';
  end if;

  select ps.*
  into v_sale
  from public.pos_sales ps
  where ps.sale_number = p_sale_number;

  if not found then
    raise exception 'SALE_NOT_FOUND';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'product_id', psi.product_id,
        'sku', psi.sku,
        'product_name', psi.product_name,
        'unit_price', psi.unit_price,
        'quantity', psi.quantity,
        'line_total', psi.line_total,
        'line_subtotal', psi.line_subtotal,
        'discount_amount', psi.discount_amount,
        'promotion_mode', psi.product_snapshot->>'promotion_mode',
        'promotion_value', psi.product_snapshot->>'promotion_value',
        'promotional_unit_price', psi.product_snapshot->>'promotion_unit_price'
      )
      order by psi.created_at
    ),
    '[]'::jsonb
  )
  into v_items
  from public.pos_sale_items psi
  where psi.sale_id = v_sale.id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'method', pp.method,
        'amount', pp.amount,
        'reference', pp.reference
      )
      order by pp.created_at
    ),
    '[]'::jsonb
  )
  into v_payments
  from public.pos_payments pp
  where pp.sale_id = v_sale.id;

  return jsonb_build_object(
    'id', v_sale.id,
    'sale_number', v_sale.sale_number,
    'status', v_sale.status,
    'currency', v_sale.currency,
    'subtotal', v_sale.subtotal,
    'discount_amount', v_sale.discount_amount,
    'total', v_sale.total,
    'created_at', v_sale.created_at,
    'shift_id', v_sale.shift_id,
    'items', v_items,
    'payments', v_payments
  );
end;
$function$
;

commit;