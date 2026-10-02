create or replace function public.admin_pos_generate_shift_pin()
returns table(pin text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_pin text;
  v_expires_at timestamptz;
begin
  if not public.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  v_pin := lpad((floor(random() * 1000000))::int::text, 6, '0');

  -- Expira al final del dia calendario local de Los Cabos.
  -- Primero calculamos el fin del dia como timestamp local sin zona y
  -- despues lo interpretamos una sola vez en America/Mazatlan.
  v_expires_at := (
    date_trunc('day', now() at time zone 'America/Mazatlan')
    + interval '1 day'
    - interval '1 millisecond'
  ) at time zone 'America/Mazatlan';

  update public.pos_settings
  set shift_pin_hash = extensions.digest(convert_to(v_pin, 'UTF8'), 'sha256'),
      shift_pin_expires_at = v_expires_at,
      updated_by = auth.uid(),
      updated_at = now()
  where singleton = true;

  if not found then
    raise exception 'POS_SETTINGS_NOT_FOUND';
  end if;

  return query select v_pin, v_expires_at;
end;
$function$;
