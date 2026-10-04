-- Applied to the shared Supabase database as golf_courses_city_filter.
alter table public.golf_courses add column if not exists city text;
comment on column public.golf_courses.city is 'Ciudad para filtrar campos de golf. Si está vacía, el sitio usa location_label.';
