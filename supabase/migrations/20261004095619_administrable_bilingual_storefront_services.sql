create table public.storefront_services (
 key text primary key default gen_random_uuid()::text,
 title_es text not null check (length(trim(title_es)) > 0), title_en text not null default '',
 eyebrow_es text not null default '', eyebrow_en text not null default '',
 description_es text not null default '', description_en text not null default '',
 items_es jsonb not null default '[]'::jsonb check (jsonb_typeof(items_es) = 'array'),
 items_en jsonb not null default '[]'::jsonb check (jsonb_typeof(items_en) = 'array'),
 cta_label_es text not null default '', cta_label_en text not null default '',
 cta_url_es text not null default '', cta_url_en text not null default '',
 note_es text not null default '', note_en text not null default '',
 image_url text,
 use_referral boolean not null default true,
 is_active boolean not null default true,
 sort_order integer not null default 1 check (sort_order >= 1),
 updated_at timestamptz not null default now(),
 constraint safe_service_urls check (
  (cta_url_es = '' or cta_url_es ~ '^https?://' or cta_url_es ~ '^/[^/]' or cta_url_es ~ '^#[A-Za-z]') and
  (cta_url_en = '' or cta_url_en ~ '^https?://' or cta_url_en ~ '^/[^/]' or cta_url_en ~ '^#[A-Za-z]') and
  (image_url is null or image_url ~ '^https://')
 )
);
alter table public.storefront_services enable row level security;
grant select on public.storefront_services to anon, authenticated;
grant insert, update, delete on public.storefront_services to authenticated;
create policy "Public read visible services" on public.storefront_services for select to anon, authenticated using (is_active);
create policy "Admins manage services" on public.storefront_services for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create index storefront_services_visible_order on public.storefront_services (sort_order, key) where is_active;
insert into public.storefront_services (key, sort_order, use_referral, title_es, title_en, eyebrow_es, eyebrow_en, description_es, description_en, cta_label_es, cta_label_en, note_es, note_en, items_es, items_en, cta_url_es, cta_url_en) values ('repair', 1, true, 'Reparación de equipo', 'Equipment repair', 'Diagnóstico inicial sin costo', 'Complimentary initial assessment', 'Revisamos desgaste, daños y fallas para explicarte alternativas antes de realizar cualquier trabajo.', 'We inspect wear, damage and faults to explain your options before any work begins.', 'Solicitar información', 'Request information', 'El alcance y precio final se confirman después de revisar físicamente el equipo.', 'Scope and final pricing are confirmed after a physical inspection.', '["Revisión física del equipo.", "Diagnóstico inicial sin compromiso.", "Cotización previa."]'::jsonb, '["Physical equipment inspection.", "Initial assessment with no commitment.", "Quote before work begins."]'::jsonb, 'https://api.whatsapp.com/send/?phone=526243554700&text=Hola+UP+AND+DOWN%2C+quiero+solicitar+informaci%C3%B3n+sobre+reparaci%C3%B3n+de+equipo+de+golf.&type=phone_number&app_absent=0', 'https://api.whatsapp.com/send/?phone=526243554700&text=Hi+UP+AND+DOWN%2C+I+would+like+information+about+golf+equipment+repair.&type=phone_number&app_absent=0');
insert into public.storefront_services (key, sort_order, use_referral, title_es, title_en, eyebrow_es, eyebrow_en, description_es, description_en, cta_label_es, cta_label_en, note_es, note_en, items_es, items_en, cta_url_es, cta_url_en) values ('trade', 2, true, 'Intercambios con tienda', 'Trade-ins', 'Valoración presencial', 'In-store evaluation', 'Trae tu equipo para valorar marca, modelo, condición y demanda y saber si puede aplicar como parte de pago.', 'Bring your equipment for a brand, model, condition and demand assessment to see whether it qualifies for trade-in credit.', 'Valorar mi equipo', 'Evaluate my equipment', '', '', '["Valoración basada en condición real.", "Posible crédito en tienda.", "Aceptación sujeta a revisión."]'::jsonb, '["Assessment based on actual condition.", "Potential store credit.", "Acceptance subject to assessment."]'::jsonb, 'https://api.whatsapp.com/send/?phone=526243554700&text=Hola+UP+AND+DOWN%2C+quiero+llevar+mi+equipo+a+valoraci%C3%B3n+para+conocer+si+puede+aplicar+para+intercambio+en+tienda.&type=phone_number&app_absent=0', 'https://api.whatsapp.com/send/?phone=526243554700&text=Hi+UP+AND+DOWN%2C+I+would+like+to+bring+in+my+equipment+for+an+evaluation+to+see+whether+it+may+qualify+for+a+trade-in.&type=phone_number&app_absent=0');
insert into public.storefront_services (key, sort_order, use_referral, title_es, title_en, eyebrow_es, eyebrow_en, description_es, description_en, cta_label_es, cta_label_en, note_es, note_en, items_es, items_en, cta_url_es, cta_url_en) values ('maintenance', 3, true, 'Mantenimiento', 'Maintenance', 'Prevención y cuidado', 'Care & prevention', 'Mantén tu equipo listo para la siguiente ronda con limpieza, revisión de empuñaduras y ajustes básicos.', 'Keep your equipment ready for the next round with cleaning, grip checks and basic adjustments.', 'Consultar mantenimiento', 'Ask about maintenance', '', '', '["Limpieza de cabezas y varillas.", "Revisión de empuñaduras.", "Inspección de desgaste."]'::jsonb, '["Clubhead and shaft cleaning.", "Grip inspection.", "Wear inspection."]'::jsonb, 'https://api.whatsapp.com/send/?phone=526243554700&text=Hola+UP+AND+DOWN%2C+quiero+consultar+el+servicio+de+mantenimiento+para+mi+equipo+de+golf.&type=phone_number&app_absent=0', 'https://api.whatsapp.com/send/?phone=526243554700&text=Hi+UP+AND+DOWN%2C+I+would+like+information+about+maintenance+service+for+my+golf+equipment.&type=phone_number&app_absent=0');
insert into public.storefront_services (key, sort_order, use_referral, title_es, title_en, eyebrow_es, eyebrow_en, description_es, description_en, cta_label_es, cta_label_en, note_es, note_en, items_es, items_en, cta_url_es, cta_url_en) values ('classes', 4, false, 'Clases de golf', 'Golf lessons', 'Entrenamiento personalizado', 'Personalized training', '', '', '', '', '', '', '[]'::jsonb, '[]'::jsonb, '#udsGolfClasses', '#udsGolfClasses');
insert into public.storefront_services (key, sort_order, use_referral, title_es, title_en, eyebrow_es, eyebrow_en, description_es, description_en, cta_label_es, cta_label_en, note_es, note_en, items_es, items_en, cta_url_es, cta_url_en) values ('putter-restoration', 5, true, 'Restauración de palos de precisión', 'Putter restoration', 'Recupera una pieza especial', 'Restore a special piece', 'Evaluamos tu palo de precisión para orientarte sobre opciones de restauración, acabado y recuperación estética de acuerdo con su estado actual.', 'We assess your putter and guide you through restoration, finish and cosmetic options based on its condition.', 'Consultar restauración', 'Ask about restoration', 'La viabilidad del trabajo se confirma después de revisar la pieza.', 'Feasibility is confirmed after inspecting the piece.', '["Revisión previa del palo de precisión.", "Opciones según material y condición.", "Cotización antes de iniciar."]'::jsonb, '["Initial putter inspection.", "Options based on material and condition.", "Quote before work begins."]'::jsonb, 'https://api.whatsapp.com/send/?phone=526243554700&text=Hola+UP+AND+DOWN%2C+quiero+consultar+el+servicio+de+reparaci%C3%B3n+de+Putters+para+mi+equipo+de+golf.&type=phone_number&app_absent=0', 'https://api.whatsapp.com/send/?phone=526243554700&text=Hi+UP+AND+DOWN%2C+I+would+like+information+about+the+putter+restoration+service+for+my+golf+equipment.&type=phone_number&app_absent=0');
insert into public.storefront_services (key, sort_order, use_referral, title_es, title_en, eyebrow_es, eyebrow_en, description_es, description_en, cta_label_es, cta_label_en, note_es, note_en, items_es, items_en, cta_url_es, cta_url_en) values ('ghin', 6, false, 'GHIN', 'GHIN', 'Hándicap oficial', 'Official handicap', 'Obtén información para incorporarte a GHIN y llevar un seguimiento reconocido de tu índice de hándicap.', 'Get information about joining GHIN and maintaining a recognized Handicap Index.', 'Quiero información de GHIN', 'I want GHIN information', '', '', '["Información sobre el registro.", "Orientación para comenzar.", "Contacto directo con Carlos."]'::jsonb, '["Registration information.", "Guidance to get started.", "Direct contact with Carlos."]'::jsonb, 'https://api.whatsapp.com/send/?phone=526241299870&text=Hola+Carlos+%F0%9F%91%8B+Vengo+de+UP+AND+DOWN+%C2%B7+Coque.+Me+gustar%C3%ADa+recibir+informaci%C3%B3n+para+unirme+a+GHIN+y+conocer+c%C3%B3mo+funciona+el+registro.+Gracias.&type=phone_number&app_absent=0', 'https://api.whatsapp.com/send/?phone=526241299870&text=Hi+Carlos+%F0%9F%91%8B+I%E2%80%99m+coming+from+UP+AND+DOWN+%C2%B7+Coque.+I%E2%80%99d+like+information+about+joining+GHIN+and+how+registration+works.+Thank+you.&type=phone_number&app_absent=0');

-- Golf lessons keep their existing form, instructors and lead workflow. Only their image is editable.
create function public.protect_storefront_service() returns trigger language plpgsql set search_path = public as $$
begin
 if tg_op = 'DELETE' then
  if old.key = 'classes' then raise exception 'Clases de golf: solo se permite cambiar la imagen.'; end if;
  return old;
 end if;
 if new.key is distinct from old.key then raise exception 'La clave del servicio no puede cambiar.'; end if;
 if old.key = 'classes' and (to_jsonb(new) - 'image_url' - 'updated_at') is distinct from (to_jsonb(old) - 'image_url' - 'updated_at') then
  raise exception 'Clases de golf: solo se permite cambiar la imagen.';
 end if;
 new.updated_at := now();
 return new;
end $$;
revoke all on function public.protect_storefront_service() from public, anon, authenticated;
create trigger protect_storefront_service before update or delete on public.storefront_services for each row execute function public.protect_storefront_service();
update public.storefront_texts set es = 'Servicios', en = 'Services' where key in ('section.services','text.c46fb4d63009');
