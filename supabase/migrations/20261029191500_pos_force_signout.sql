-- Session revocation is separate from financial shift closing.
-- A privileged server RPC revokes all Auth sessions for the target POS employee.
create or replace function public.admin_pos_force_signout_service(
  p_admin_user_id uuid,
  p_employee_id uuid
) returns integer
language plpgsql security definer set search_path = ''
as $function$
declare
  v_auth_user_id uuid;
  v_count integer := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = p_admin_user_id and p.role = 'admin' and p.is_active = true
  ) then raise exception 'ADMIN_REQUIRED'; end if;
  select e.auth_user_id into v_auth_user_id
  from public.pos_employees e where e.id = p_employee_id;
  if v_auth_user_id is null then raise exception 'EMPLOYEE_NOT_FOUND'; end if;

  delete from auth.sessions s where s.user_id = v_auth_user_id;
  get diagnostics v_count = row_count;

  insert into public.pos_access_log(employee_id,event_type,success,details)
  values(p_employee_id,'employee_force_signed_out',true,
    jsonb_build_object('changed_by',p_admin_user_id,
      'sessions_revoked',v_count,'shift_unchanged',true));
  return v_count;
end;
$function$;
revoke all on function public.admin_pos_force_signout_service(uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_pos_force_signout_service(uuid,uuid) to service_role;

-- The POS revalidates its own JWT against the live Auth session table.
-- An old access token cannot authorize a POS screen after revocation.
create or replace function public.pos_is_session_active()
returns boolean
language sql security definer stable set search_path = ''
as $function$
  select auth.uid() is not null and exists (
    select 1 from auth.sessions s
    where s.user_id = auth.uid()
      and s.id::text = auth.jwt()->>'session_id'
  );
$function$;
revoke all on function public.pos_is_session_active() from public,anon;
grant execute on function public.pos_is_session_active() to authenticated,service_role;
