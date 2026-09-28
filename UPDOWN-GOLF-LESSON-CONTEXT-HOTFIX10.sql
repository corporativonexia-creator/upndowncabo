-- ============================================================================
-- UP AND DOWN · GOLF LESSON LEAD CONTEXT · HOTFIX 10
--
-- Permite personalizar WhatsApp después de refrescar la página usando:
--   lead_id + public_token
--
-- Devuelve SOLO:
--   name, skill_level, goal_category, goal_text
--
-- NO devuelve teléfono, UTM, afiliado ni otros datos del lead.
-- ============================================================================

begin;

create or replace function public.get_golf_lesson_lead_context(
  p_lead_id uuid,
  p_lead_token uuid
)
returns table(
  name text,
  skill_level text,
  goal_category text,
  goal_text text
)
language sql
security definer
set search_path = ''
stable
as $function$
  select
    l.name,
    l.skill_level,
    l.goal_category,
    l.goal_text
  from public.golf_lesson_leads l
  where l.id = p_lead_id
    and l.public_token = p_lead_token
  limit 1;
$function$;

revoke execute on function public.get_golf_lesson_lead_context(uuid,uuid)
from public;

grant execute on function public.get_golf_lesson_lead_context(uuid,uuid)
to anon, authenticated, service_role;

commit;

notify pgrst, 'reload schema';

-- VERIFICACIÓN
select
  has_function_privilege(
    'anon',
    'public.get_golf_lesson_lead_context(uuid,uuid)',
    'EXECUTE'
  ) as anon_can_execute,
  has_function_privilege(
    'authenticated',
    'public.get_golf_lesson_lead_context(uuid,uuid)',
    'EXECUTE'
  ) as authenticated_can_execute;
