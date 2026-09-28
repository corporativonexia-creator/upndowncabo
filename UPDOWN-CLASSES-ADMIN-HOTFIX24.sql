-- ============================================================================
-- UP AND DOWN · CLASES ADMIN + INSTRUCTORES DINÁMICOS · HOTFIX 24
-- Permite que cualquier profesor administrado pueda ser seleccionado.
-- Conserva los leads y eventos existentes.
-- ============================================================================

begin;

-- Las restricciones originales estaban fijadas a Rodrigo/Mario.
alter table public.golf_lesson_leads
  drop constraint if exists golf_lesson_leads_selected_instructor_check;

alter table public.golf_lesson_events
  drop constraint if exists golf_lesson_events_instructor_slug_check;

-- Índices ya existentes siguen siendo válidos.

create or replace function public.record_golf_instructor_interest(
  p_lead_id uuid,
  p_lead_token uuid,
  p_instructor_slug text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_exists boolean;
  v_instructor_exists boolean;
begin
  select exists(
    select 1
    from public.golf_instructors i
    where i.slug = btrim(coalesce(p_instructor_slug,''))
      and i.is_visible = true
      and coalesce(i.is_active,true) = true
  ) into v_instructor_exists;

  if not v_instructor_exists then
    raise exception 'INVALID_OR_INACTIVE_INSTRUCTOR';
  end if;

  select exists(
    select 1
    from public.golf_lesson_leads l
    where l.id = p_lead_id
      and l.public_token = p_lead_token
  ) into v_exists;

  if not v_exists then
    raise exception 'INVALID_LEAD_TOKEN';
  end if;

  update public.golf_lesson_leads
     set selected_instructor=btrim(p_instructor_slug),
         selected_at=now(),
         updated_at=now()
   where id=p_lead_id
     and public_token=p_lead_token;

  insert into public.golf_lesson_events(lead_id,event_type,instructor_slug)
  values(p_lead_id,'instructor_interest',btrim(p_instructor_slug));

  return true;
end;
$function$;

revoke execute on function public.record_golf_instructor_interest(uuid,uuid,text)
from public;

grant execute on function public.record_golf_instructor_interest(uuid,uuid,text)
to anon, authenticated, service_role;

commit;

notify pgrst, 'reload schema';

select
  l.id,
  l.name,
  l.status,
  l.selected_instructor,
  l.created_at
from public.golf_lesson_leads l
order by l.created_at desc
limit 20;
