-- Unify live Stripe orders with the POS sales report; no mutations to orders, inventory or shifts.
CREATE OR REPLACE FUNCTION public.admin_pos_sale_detail(p_sale_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  select jsonb_build_object(
    'sale', jsonb_build_object(
      'id', ps.id,
      'sale_number', ps.sale_number,
      'shift_id', ps.shift_id,
      'shift_opened_at', sh.opened_at,
      'shift_closed_at', sh.closed_at,
      'employee_id', ps.employee_id,
      'employee_number', pe.employee_number,
      'employee_name', pe.full_name,
      'employee_role', pe.role,
      'terminal_id', ps.terminal_id,
      'terminal_name', pt.name,
      'status', ps.status,
      'currency', ps.currency,
      'subtotal', ps.subtotal,
      'discount_amount', ps.discount_amount,
      'total', ps.total,
      'created_at', ps.created_at,
      'void_reason', ps.void_reason,
      'refunded_at', ps.refunded_at,
      'refund_reason', ps.refund_reason
    ),
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', psi.id,
          'product_id', psi.product_id,
          'product_name', psi.product_name,
          'sku', psi.sku,
          'quantity', psi.quantity,
          'unit_price', psi.unit_price,
          'line_total', psi.line_total
        )
        order by psi.created_at, psi.id
      )
      from public.pos_sale_items psi
      where psi.sale_id = ps.id
    ), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', pp.id,
          'method', pp.method,
          'amount', pp.amount,
          'reference', pp.reference,
          'created_at', pp.created_at
        )
        order by pp.created_at, pp.id
      )
      from public.pos_payments pp
      where pp.sale_id = ps.id
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', pse.id,
          'event_type', pse.event_type,
          'employee_id', pse.employee_id,
          'details', pse.details,
          'created_at', pse.created_at
        )
        order by pse.created_at, pse.id
      )
      from public.pos_sale_events pse
      where pse.sale_id = ps.id
    ), '[]'::jsonb),
    'refunds', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', pr.id,
          'amount', pr.amount,
          'method', pr.method,
          'reason', pr.reason,
          'created_at', pr.created_at
        )
        order by pr.created_at, pr.id
      )
      from public.pos_refunds pr
      where pr.sale_id = ps.id
    ), '[]'::jsonb)
  )
  into v_result
  from public.pos_sales ps
  left join public.pos_employees pe on pe.id = ps.employee_id
  left join public.pos_terminals pt on pt.id = ps.terminal_id
  left join public.pos_shifts sh on sh.id = ps.shift_id
  where ps.id = p_sale_id;

  if v_result is null then
    select jsonb_build_object(
      'sale', jsonb_build_object(
        'id',o.id, 'sale_number','WEB-' || lpad(o.order_number::text,greatest(6,length(o.order_number::text)),'0'),
        'channel','online', 'employee_name',coalesce(nullif(o.seller_ref,''),'Sistema'),
        'terminal_name','Tienda en línea','status','completed','currency',o.currency,
        'subtotal',o.subtotal,'discount_amount',0,'total',o.total,'created_at',o.created_at,
        'customer_name',o.customer_name,'customer_email',o.customer_email,'order_status',o.order_status
      ),
      'items',coalesce((select jsonb_agg(jsonb_build_object(
        'id',i.id,'product_id',i.product_id,'variant_id',i.variant_id,'product_name',i.product_name,
        'sku',i.sku,'quantity',i.quantity,'unit_price',i.unit_price,'line_total',i.line_total
      ) order by i.created_at,i.id) from public.order_items i where i.order_id=o.id),'[]'::jsonb),
      'payments',jsonb_build_array(jsonb_build_object('method','stripe','amount',o.total,
        'reference',o.stripe_payment_intent_id,'created_at',o.created_at)),
      'events',coalesce((select jsonb_agg(jsonb_build_object('event_type','payment_recorded','created_at',e.processed_at)
        order by e.processed_at) from public.stripe_webhook_events e where e.order_id=o.id
        and e.processing_status='completed' and e.event_type in ('checkout.session.completed','checkout.session.async_payment_succeeded')),'[]'::jsonb),
      'refunds','[]'::jsonb
    ) into v_result from public.orders o
    where o.id=p_sale_id and o.payment_status='paid' and left(o.stripe_checkout_session_id,8)='cs_live_';
  end if;

  if v_result is null then
    raise exception 'SALE_NOT_FOUND';
  end if;

  return jsonb_build_object('ok', true, 'data', v_result);
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_pos_sales_summary(p_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_employee_id uuid DEFAULT NULL::uuid, p_terminal_id uuid DEFAULT NULL::uuid, p_status text DEFAULT NULL::text, p_payment_method text DEFAULT NULL::text, p_limit integer DEFAULT 300)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_limit integer;
  v_sales jsonb;
  v_metrics jsonb;
  v_online_sales jsonb;
  v_online_count bigint;
  v_online_total numeric;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  v_limit := greatest(1, least(coalesce(p_limit,300),1000));

  with filtered_sales as (
    select distinct
      ps.id,
      ps.sale_number,
      ps.shift_id,
      ps.employee_id,
      ps.terminal_id,
      ps.status,
      ps.currency,
      ps.subtotal,
      ps.discount_amount,
      ps.total,
      ps.created_at,
      pe.employee_number,
      pe.full_name as employee_name,
      pe.role as employee_role,
      pt.name as terminal_name
    from public.pos_sales ps
    left join public.pos_employees pe
      on pe.id = ps.employee_id
    left join public.pos_terminals pt
      on pt.id = ps.terminal_id
    where
      (p_from is null or ps.created_at >= p_from)
      and (p_to is null or ps.created_at <= p_to)
      and (p_employee_id is null or ps.employee_id = p_employee_id)
      and (p_terminal_id is null or ps.terminal_id = p_terminal_id)
      and (
        p_status is null
        or p_status = ''
        or p_status = 'all'
        or ps.status = p_status
      )
      and (
        p_payment_method is null
        or p_payment_method = ''
        or p_payment_method = 'all'
        or exists (
          select 1
          from public.pos_payments pp
          where pp.sale_id = ps.id
            and pp.method = p_payment_method
        )
      )
  ),
  sales_with_payment as (
    select
      fs.*,
      coalesce(
        (
          select string_agg(distinct pp.method, ' + ' order by pp.method)
          from public.pos_payments pp
          where pp.sale_id = fs.id
        ),
        ''
      ) as payment_methods
    from filtered_sales fs
  ),
  limited_sales as (
    select *
    from sales_with_payment
    order by created_at desc
    limit v_limit
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', ls.id,
        'sale_number', ls.sale_number,
        'shift_id', ls.shift_id,
        'employee_id', ls.employee_id,
        'employee_number', ls.employee_number,
        'employee_name', ls.employee_name,
        'employee_role', ls.employee_role,
        'terminal_id', ls.terminal_id,
        'terminal_name', ls.terminal_name,
        'status', ls.status,
        'currency', ls.currency,
        'subtotal', ls.subtotal,
        'discount_amount', ls.discount_amount,
        'total', ls.total,
        'payment_methods', ls.payment_methods,
        'created_at', ls.created_at
      )
      order by ls.created_at desc
    ),
    '[]'::jsonb
  )
  into v_sales
  from limited_sales ls;

  with sale_scope as (
    select distinct ps.*
    from public.pos_sales ps
    where
      (p_from is null or ps.created_at >= p_from)
      and (p_to is null or ps.created_at <= p_to)
      and (p_employee_id is null or ps.employee_id = p_employee_id)
      and (p_terminal_id is null or ps.terminal_id = p_terminal_id)
      and (
        p_status is null
        or p_status = ''
        or p_status = 'all'
        or ps.status = p_status
      )
      and (
        p_payment_method is null
        or p_payment_method = ''
        or p_payment_method = 'all'
        or exists (
          select 1
          from public.pos_payments pp
          where pp.sale_id = ps.id
            and pp.method = p_payment_method
        )
      )
  ),
  payment_scope as (
    select pp.*
    from public.pos_payments pp
    join sale_scope ss on ss.id = pp.sale_id
  ),
  refund_scope as (
    select pr.*
    from public.pos_refunds pr
    where
      (p_from is null or pr.created_at >= p_from)
      and (p_to is null or pr.created_at <= p_to)
      and (p_employee_id is null or pr.employee_id = p_employee_id)
      and (p_terminal_id is null or pr.terminal_id = p_terminal_id)
  ),
  cash_scope as (
    select pcm.*
    from public.pos_cash_movements pcm
    where
      (p_from is null or pcm.created_at >= p_from)
      and (p_to is null or pcm.created_at <= p_to)
      and (p_employee_id is null or pcm.employee_id = p_employee_id)
      and (p_terminal_id is null or pcm.terminal_id = p_terminal_id)
  ),
  shift_scope as (
    select ps.*
    from public.pos_shifts ps
    where
      (p_from is null or ps.opened_at >= p_from)
      and (p_to is null or ps.opened_at <= p_to)
      and (p_employee_id is null or ps.employee_id = p_employee_id)
      and (p_terminal_id is null or ps.terminal_id = p_terminal_id)
  )
  select jsonb_build_object(
    'sales_count',
      (select count(*) from sale_scope where status in ('completed','refunded')),
    'gross_sales',
      coalesce((select sum(total) from sale_scope where status in ('completed','refunded')),0),
    'completed_sales',
      (select count(*) from sale_scope where status = 'completed'),
    'voided_sales',
      (select count(*) from sale_scope where status = 'voided'),
    'refunded_sales',
      (select count(*) from sale_scope where status = 'refunded'),

    'cash_payments',
      coalesce((select sum(amount) from payment_scope where method = 'cash'),0),
    'card_terminal_payments',
      coalesce((select sum(amount) from payment_scope where method = 'card_terminal'),0),
    'transfer_payments',
      coalesce((select sum(amount) from payment_scope where method = 'transfer'),0),
    'other_payments',
      coalesce((select sum(amount) from payment_scope where method = 'other'),0),

    'refunds_total',
      coalesce((select sum(amount) from refund_scope),0),
    'cash_refunds',
      coalesce((select sum(amount) from refund_scope where method = 'cash'),0),

    'cash_in',
      coalesce((select sum(amount) from cash_scope where movement_type = 'cash_in'),0),
    'cash_out',
      coalesce((select sum(amount) from cash_scope where movement_type = 'cash_out'),0),

    'closed_shifts',
      (select count(*) from shift_scope where status = 'closed'),
    'open_shifts',
      (select count(*) from shift_scope where status = 'open'),
    'closing_difference_total',
      coalesce((select sum(difference) from shift_scope where status = 'closed'),0)
  )
  into v_metrics;

  -- Online sales are read directly from original paid live orders, never posted to a POS shift.
  with online_scope as (
    select o.*
    from public.orders o
    where o.payment_status = 'paid'
      and left(o.stripe_checkout_session_id, 8) = 'cs_live_'
      and (p_from is null or o.created_at >= p_from)
      and (p_to is null or o.created_at <= p_to)
      and p_employee_id is null and p_terminal_id is null
      and coalesce(nullif(p_status,''),'all') in ('all','completed')
      and coalesce(nullif(p_payment_method,''),'all') in ('all','stripe')
  ), limited_online as (
    select * from online_scope order by created_at desc, id desc limit v_limit
  )
  select
    coalesce((select jsonb_agg(jsonb_build_object(
      'id', o.id, 'sale_number', 'WEB-' || lpad(o.order_number::text,greatest(6,length(o.order_number::text)),'0'),
      'shift_id', null, 'employee_id', null, 'employee_number', null,
      'employee_name', coalesce(nullif(o.seller_ref,''),'Sistema'), 'employee_role', 'En línea',
      'terminal_id', null, 'terminal_name', 'Tienda en línea', 'status', 'completed',
      'currency', o.currency, 'subtotal', o.subtotal, 'discount_amount', 0,
      'total', o.total, 'payment_methods', 'stripe', 'created_at', o.created_at, 'channel', 'online'
    ) order by o.created_at desc, o.id desc) from limited_online o),'[]'::jsonb),
    (select count(*) from online_scope),
    coalesce((select sum(total) from online_scope),0)
  into v_online_sales, v_online_count, v_online_total;

  select coalesce(jsonb_agg(x.row order by (x.row->>'created_at')::timestamptz desc, x.row->>'id'),'[]'::jsonb)
  into v_sales
  from (
    select value as row from jsonb_array_elements(v_sales || v_online_sales)
    order by (value->>'created_at')::timestamptz desc, value->>'id'
    limit v_limit
  ) x;

  v_metrics := v_metrics || jsonb_build_object(
    'pos_sales_count', (v_metrics->>'sales_count')::bigint,
    'pos_gross_sales', (v_metrics->>'gross_sales')::numeric,
    'online_sales_count', v_online_count,
    'stripe_payments', v_online_total,
    'sales_count', (v_metrics->>'sales_count')::bigint + v_online_count,
    'completed_sales', (v_metrics->>'completed_sales')::bigint + v_online_count,
    'gross_sales', (v_metrics->>'gross_sales')::numeric + v_online_total
  );

  return jsonb_build_object(
    'ok', true,
    'metrics', v_metrics,
    'sales', v_sales
  );
end;
$function$;
