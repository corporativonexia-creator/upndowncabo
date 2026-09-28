-- ============================================================================
-- UP AND DOWN · POS SECURITY FOUNDATION V1 · HOTFIX 25
-- Empleados · Terminales autorizadas · PIN · Turnos · Auditoría
-- NO crea ventas todavía. NO toca Stripe.
-- ============================================================================

begin;

create extension if not exists pgcrypto;

create table if not exists public.pos_employees (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete restrict,
  employee_number text not null unique,
  full_name text not null,
  role text not null default 'cashier'
    check (role in ('cashier','supervisor','pos_admin')),
  status text not null default 'active'
    check (status in ('active','suspended','terminated')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz,
  suspended_at timestamptz,
  terminated_at timestamptz
);

create table if not exists public.pos_terminals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active'
    check (status in ('active','revoked')),
  activation_code_hash bytea,
  activation_expires_at timestamptz,
  device_token_hash bytea,
  activated_at timestamptz,
  last_seen_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists public.pos_settings (
  singleton boolean primary key default true check (singleton),
  shift_pin_hash bytea,
  shift_pin_expires_at timestamptz,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

insert into public.pos_settings(singleton)
values(true)
on conflict(singleton) do nothing;

create table if not exists public.pos_shifts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.pos_employees(id) on delete restrict,
  terminal_id uuid not null references public.pos_terminals(id) on delete restrict,
  status text not null default 'open' check (status in ('open','closed')),
  opening_cash numeric(12,2) not null default 0 check (opening_cash >= 0),
  closing_cash numeric(12,2),
  expected_cash numeric(12,2),
  difference numeric(12,2),
  notes text,
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

create unique index if not exists pos_one_open_shift_per_employee
on public.pos_shifts(employee_id)
where status='open';

create unique index if not exists pos_one_open_shift_per_terminal
on public.pos_shifts(terminal_id)
where status='open';

create table if not exists public.pos_access_log (
  id bigint generated always as identity primary key,
  employee_id uuid references public.pos_employees(id) on delete set null,
  terminal_id uuid references public.pos_terminals(id) on delete set null,
  event_type text not null,
  success boolean not null default true,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.pos_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at=now();
  return new;
end;
$$;

drop trigger if exists trg_pos_employees_updated_at on public.pos_employees;
create trigger trg_pos_employees_updated_at
before update on public.pos_employees
for each row execute function public.pos_touch_updated_at();

alter table public.pos_employees enable row level security;
alter table public.pos_terminals enable row level security;
alter table public.pos_settings enable row level security;
alter table public.pos_shifts enable row level security;
alter table public.pos_access_log enable row level security;

drop policy if exists pos_employees_admin_select on public.pos_employees;
create policy pos_employees_admin_select
on public.pos_employees for select
to authenticated
using (public.is_admin());

drop policy if exists pos_employees_self_select on public.pos_employees;
create policy pos_employees_self_select
on public.pos_employees for select
to authenticated
using (auth_user_id=auth.uid());

drop policy if exists pos_terminals_admin_select on public.pos_terminals;
create policy pos_terminals_admin_select
on public.pos_terminals for select
to authenticated
using (public.is_admin());

drop policy if exists pos_shifts_admin_select on public.pos_shifts;
create policy pos_shifts_admin_select
on public.pos_shifts for select
to authenticated
using (public.is_admin());

drop policy if exists pos_shifts_self_select on public.pos_shifts;
create policy pos_shifts_self_select
on public.pos_shifts for select
to authenticated
using (
  employee_id in (
    select e.id from public.pos_employees e where e.auth_user_id=auth.uid()
  )
);

drop policy if exists pos_access_log_admin_select on public.pos_access_log;
create policy pos_access_log_admin_select
on public.pos_access_log for select
to authenticated
using (public.is_admin());

create or replace function public.admin_pos_create_terminal(p_name text)
returns table(terminal_id uuid, activation_code text)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_code text;
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if nullif(btrim(p_name),'') is null then
    raise exception 'TERMINAL_NAME_REQUIRED';
  end if;

  v_code=upper(substr(encode(gen_random_bytes(8),'hex'),1,12));

  insert into public.pos_terminals(
    name,status,activation_code_hash,activation_expires_at,created_by
  )
  values(
    btrim(p_name),'active',
    digest(v_code,'sha256'),
    now()+interval '20 minutes',
    auth.uid()
  )
  returning id into v_id;

  return query select v_id,v_code;
end;
$$;

create or replace function public.admin_pos_revoke_terminal(p_terminal_id uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;

  if exists(
    select 1 from public.pos_shifts
    where terminal_id=p_terminal_id and status='open'
  ) then
    raise exception 'TERMINAL_HAS_OPEN_SHIFT';
  end if;

  update public.pos_terminals
  set status='revoked',revoked_at=now(),device_token_hash=null
  where id=p_terminal_id;

  return found;
end;
$$;

create or replace function public.admin_pos_set_shift_pin(
  p_pin text,
  p_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_pin !~ '^[0-9]{6}$' then raise exception 'PIN_MUST_BE_6_DIGITS'; end if;
  if p_expires_at<=now() then raise exception 'PIN_EXPIRY_INVALID'; end if;

  update public.pos_settings
  set shift_pin_hash=digest(p_pin,'sha256'),
      shift_pin_expires_at=p_expires_at,
      updated_by=auth.uid(),
      updated_at=now()
  where singleton=true;

  return true;
end;
$$;

create or replace function public.pos_activate_terminal(
  p_activation_code text,
  p_device_token text
)
returns table(terminal_id uuid, terminal_name text)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_terminal public.pos_terminals%rowtype;
begin
  if length(coalesce(p_device_token,''))<32 then
    raise exception 'INVALID_DEVICE_TOKEN';
  end if;

  select *
  into v_terminal
  from public.pos_terminals
  where status='active'
    and activation_code_hash=digest(upper(btrim(p_activation_code)),'sha256')
    and activation_expires_at>now()
    and activated_at is null
  for update;

  if not found then
    raise exception 'INVALID_OR_EXPIRED_ACTIVATION_CODE';
  end if;

  update public.pos_terminals
  set device_token_hash=digest(p_device_token,'sha256'),
      activated_at=now(),
      activation_code_hash=null,
      activation_expires_at=null,
      last_seen_at=now()
  where id=v_terminal.id;

  insert into public.pos_access_log(terminal_id,event_type,success)
  values(v_terminal.id,'terminal_activated',true);

  return query select v_terminal.id,v_terminal.name;
end;
$$;

create or replace function public.pos_get_my_access(p_device_token text)
returns table(
  employee_id uuid,
  employee_number text,
  full_name text,
  employee_role text,
  employee_status text,
  terminal_id uuid,
  terminal_name text,
  terminal_authorized boolean,
  open_shift_id uuid,
  open_shift_started_at timestamptz,
  opening_cash numeric
)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_employee public.pos_employees%rowtype;
  v_terminal public.pos_terminals%rowtype;
  v_shift public.pos_shifts%rowtype;
begin
  select * into v_employee
  from public.pos_employees
  where auth_user_id=auth.uid();

  if not found then raise exception 'POS_EMPLOYEE_NOT_FOUND'; end if;
  if v_employee.status<>'active' then raise exception 'POS_EMPLOYEE_NOT_ACTIVE'; end if;

  select * into v_terminal
  from public.pos_terminals
  where status='active'
    and device_token_hash=digest(coalesce(p_device_token,''),'sha256');

  if not found then
    return query
    select v_employee.id,v_employee.employee_number,v_employee.full_name,
           v_employee.role,v_employee.status,
           null::uuid,null::text,false,
           null::uuid,null::timestamptz,null::numeric;
    return;
  end if;

  update public.pos_terminals set last_seen_at=now() where id=v_terminal.id;
  update public.pos_employees set last_login_at=now() where id=v_employee.id;

  select * into v_shift
  from public.pos_shifts
  where employee_id=v_employee.id and terminal_id=v_terminal.id and status='open'
  order by opened_at desc
  limit 1;

  insert into public.pos_access_log(employee_id,terminal_id,event_type,success)
  values(v_employee.id,v_terminal.id,'access_validated',true);

  return query
  select v_employee.id,v_employee.employee_number,v_employee.full_name,
         v_employee.role,v_employee.status,
         v_terminal.id,v_terminal.name,true,
         v_shift.id,v_shift.opened_at,v_shift.opening_cash;
end;
$$;

create or replace function public.pos_open_shift(
  p_device_token text,
  p_pin text,
  p_opening_cash numeric
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_employee public.pos_employees%rowtype;
  v_terminal public.pos_terminals%rowtype;
  v_settings public.pos_settings%rowtype;
  v_shift_id uuid;
begin
  select * into v_employee from public.pos_employees where auth_user_id=auth.uid();
  if not found or v_employee.status<>'active' then raise exception 'EMPLOYEE_NOT_ACTIVE'; end if;

  select * into v_terminal
  from public.pos_terminals
  where status='active' and device_token_hash=digest(coalesce(p_device_token,''),'sha256');
  if not found then raise exception 'TERMINAL_NOT_AUTHORIZED'; end if;

  select * into v_settings from public.pos_settings where singleton=true;
  if v_settings.shift_pin_hash is null or v_settings.shift_pin_expires_at<=now() then
    raise exception 'SHIFT_PIN_EXPIRED';
  end if;
  if digest(coalesce(p_pin,''),'sha256')<>v_settings.shift_pin_hash then
    raise exception 'INVALID_SHIFT_PIN';
  end if;
  if coalesce(p_opening_cash,0)<0 then raise exception 'INVALID_OPENING_CASH'; end if;

  insert into public.pos_shifts(employee_id,terminal_id,opening_cash)
  values(v_employee.id,v_terminal.id,round(coalesce(p_opening_cash,0),2))
  returning id into v_shift_id;

  insert into public.pos_access_log(employee_id,terminal_id,event_type,success,details)
  values(v_employee.id,v_terminal.id,'shift_opened',true,jsonb_build_object('shift_id',v_shift_id));

  return v_shift_id;
end;
$$;

create or replace function public.pos_close_shift(
  p_device_token text,
  p_closing_cash numeric,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_employee public.pos_employees%rowtype;
  v_terminal public.pos_terminals%rowtype;
  v_shift public.pos_shifts%rowtype;
begin
  select * into v_employee from public.pos_employees where auth_user_id=auth.uid();
  if not found then raise exception 'EMPLOYEE_NOT_FOUND'; end if;

  select * into v_terminal
  from public.pos_terminals
  where status='active' and device_token_hash=digest(coalesce(p_device_token,''),'sha256');
  if not found then raise exception 'TERMINAL_NOT_AUTHORIZED'; end if;

  select * into v_shift
  from public.pos_shifts
  where employee_id=v_employee.id and terminal_id=v_terminal.id and status='open'
  for update;

  if not found then raise exception 'OPEN_SHIFT_NOT_FOUND'; end if;
  if coalesce(p_closing_cash,0)<0 then raise exception 'INVALID_CLOSING_CASH'; end if;

  update public.pos_shifts
  set status='closed',
      closing_cash=round(coalesce(p_closing_cash,0),2),
      expected_cash=opening_cash,
      difference=round(coalesce(p_closing_cash,0)-opening_cash,2),
      notes=nullif(btrim(coalesce(p_notes,'')),''),
      closed_at=now()
  where id=v_shift.id;

  insert into public.pos_access_log(employee_id,terminal_id,event_type,success,details)
  values(v_employee.id,v_terminal.id,'shift_closed',true,jsonb_build_object('shift_id',v_shift.id));

  return v_shift.id;
end;
$$;

revoke all on function public.admin_pos_create_terminal(text) from public;
revoke all on function public.admin_pos_revoke_terminal(uuid) from public;
revoke all on function public.admin_pos_set_shift_pin(text,timestamptz) from public;
revoke all on function public.pos_activate_terminal(text,text) from public;
revoke all on function public.pos_get_my_access(text) from public;
revoke all on function public.pos_open_shift(text,text,numeric) from public;
revoke all on function public.pos_close_shift(text,numeric,text) from public;

grant execute on function public.admin_pos_create_terminal(text) to authenticated;
grant execute on function public.admin_pos_revoke_terminal(uuid) to authenticated;
grant execute on function public.admin_pos_set_shift_pin(text,timestamptz) to authenticated;
grant execute on function public.pos_activate_terminal(text,text) to anon,authenticated;
grant execute on function public.pos_get_my_access(text) to authenticated;
grant execute on function public.pos_open_shift(text,text,numeric) to authenticated;
grant execute on function public.pos_close_shift(text,numeric,text) to authenticated;

commit;

notify pgrst, 'reload schema';
