-- ============================================================================
-- UP AND DOWN · INSTRUCTOR AVAILABILITY + ADMIN CONTENT FIX · HOTFIX 19
-- Adds availability separate from visibility.
-- Existing instructors remain active by default.
-- ============================================================================

begin;

alter table public.golf_instructors
  add column if not exists is_active boolean not null default true;

update public.golf_instructors
set is_active = true
where is_active is null;

commit;

notify pgrst, 'reload schema';

select
  slug,
  name,
  is_visible,
  is_active,
  sort_order
from public.golf_instructors
order by sort_order, name;
