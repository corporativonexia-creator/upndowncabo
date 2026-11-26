create or replace function public.pos_reception_update_multi_line(
  p_device_token text,p_reception_id uuid,p_revision int,p_line_index int,p_price_cents bigint,p_status text
) returns jsonb language plpgsql security definer set search_path=''
as $line$
declare a jsonb; r public.pos_service_receptions%rowtype; old_line jsonb; new_line jsonb; employee_role text;
begin
  a:=public.pos_reception_access(p_device_token);
  select role into employee_role from public.pos_employees where id=(a->>'employee_id')::uuid and status='active';
  select * into r from public.pos_service_receptions where id=p_reception_id for update;
  if not found or r.order_lines is null or r.status<>'received' then raise exception 'MULTISERVICE_NOT_EDITABLE'; end if;
  if p_revision is distinct from r.order_revision then raise exception 'MULTISERVICE_STALE_REVISION'; end if;
  if p_line_index is null or p_line_index<0 or p_line_index>=jsonb_array_length(r.order_lines)
    or p_status is null or p_status not in ('pending','approved','in_progress','finished','cancelled')
    or (p_price_cents is not null and (p_price_cents<1 or p_price_cents>9999999900))
    then raise exception 'MULTISERVICE_LINE_INVALID'; end if;
  old_line:=r.order_lines->p_line_index;
  if old_line->>'status'='cancelled' then raise exception 'MULTISERVICE_LINE_CANCELLED'; end if;
  if (p_price_cents is distinct from (old_line->>'price_cents')::bigint or
    p_status in ('approved','cancelled') and p_status<>old_line->>'status')
    and coalesce(employee_role,'') not in ('pos_admin','supervisor') then raise exception 'MULTISERVICE_MANAGER_REQUIRED'; end if;
  if p_status in ('approved','in_progress','finished') and p_price_cents is null then raise exception 'MULTISERVICE_PRICE_REQUIRED'; end if;
  if p_status<>'cancelled' and p_price_cents is distinct from (old_line->>'price_cents')::bigint and p_status not in ('pending','approved')
    then raise exception 'MULTISERVICE_REAPPROVAL_REQUIRED'; end if;
  if (p_status='in_progress' and old_line->>'status' not in ('approved','in_progress','finished'))
    or (p_status='finished' and old_line->>'status' not in ('approved','in_progress','finished'))
    then raise exception 'MULTISERVICE_APPROVAL_REQUIRED'; end if;
  if p_price_cents is not null and p_price_cents::numeric*(old_line->>'quantity')::int>9999999900 then raise exception 'MULTISERVICE_AMOUNT_LIMIT'; end if;
  new_line:=old_line||jsonb_build_object('price_cents',p_price_cents,'status',p_status);
  update public.pos_service_receptions set order_lines=jsonb_set(order_lines,array[p_line_index::text],new_line),
    order_revision=order_revision+1,order_events=order_events||jsonb_build_array(jsonb_build_object('event','line_updated','at',now(),
    'employee_id',a->>'employee_id','index',p_line_index,'before',old_line,'after',new_line))
    where id=r.id returning * into r;
  return to_jsonb(r)-'order_request'-'order_events';
end;
$line$;
revoke all on function public.pos_reception_update_multi_line(text,uuid,int,int,bigint,text) from public,anon,authenticated;
grant execute on function public.pos_reception_update_multi_line(text,uuid,int,int,bigint,text) to authenticated;


-- Append a new service to an existing equipment. No sale or stock movement.
