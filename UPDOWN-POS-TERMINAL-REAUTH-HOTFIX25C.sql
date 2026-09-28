begin;

create or replace function public.admin_pos_reauthorize_terminal(
  p_terminal_id uuid
)
returns table(terminal_id uuid, activation_code text)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_code text;
  v_name text;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if exists(
    select 1 from public.pos_shifts
    where terminal_id=p_terminal_id and status='open'
  ) then
    raise exception 'TERMINAL_HAS_OPEN_SHIFT';
  end if;

  select name
  into v_name
  from public.pos_terminals
  where id=p_terminal_id
    and status='active'
  for update;

  if not found then
    raise exception 'TERMINAL_NOT_FOUND_OR_REVOKED';
  end if;

  v_code=upper(substr(encode(extensions.gen_random_bytes(8),'hex'),1,12));

  update public.pos_terminals
  set activation_code_hash=extensions.digest(v_code,'sha256'),
      activation_expires_at=now()+interval '20 minutes',
      device_token_hash=null,
      activated_at=null,
      last_seen_at=null
  where id=p_terminal_id;

  insert into public.pos_access_log(
    terminal_id,event_type,success,details
  )
  values(
    p_terminal_id,
    'terminal_reauthorization_requested',
    true,
    jsonb_build_object('terminal_name',v_name)
  );

  return query select p_terminal_id,v_code;
end;
$$;

revoke all on function public.admin_pos_reauthorize_terminal(uuid) from public;
grant execute on function public.admin_pos_reauthorize_terminal(uuid) to authenticated;

commit;

notify pgrst, 'reload schema';
