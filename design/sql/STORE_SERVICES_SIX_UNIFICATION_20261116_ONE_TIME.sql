-- One-time, authorized DML only. Backed up to design/backups/storefront_services_20261116_pre_unification.json.
-- This script intentionally fails if ANY of the seven records changed after the snapshot.
-- NO Vercel deployment, schema DDL, checkout, POS or inventory changes.
BEGIN;
SET LOCAL statement_timeout = '15000ms';
LOCK TABLE public.storefront_services IN SHARE ROW EXCLUSIVE MODE;
DO $preflight$
DECLARE live_keys text[];
BEGIN
  SELECT array_agg(key ORDER BY key) INTO live_keys FROM public.storefront_services;
  IF live_keys IS DISTINCT FROM ARRAY['27a30f4f-018e-460a-9b7d-b1dc1488143f', 'classes', 'ghin', 'maintenance', 'putter-restoration', 'repair', 'trade']::text[] THEN
    RAISE EXCEPTION 'SERVICES_CHANGED_SINCE_BACKUP: unexpected keys: %', live_keys;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.storefront_services AS actual
    JOIN (VALUES
    ('repair', '2026-10-04 10:02:30.667767+00'::timestamptz),
    ('trade', '2026-10-04 10:02:41.453372+00'::timestamptz),
    ('maintenance', '2026-10-04 10:02:50.89683+00'::timestamptz),
    ('classes', '2026-10-04 20:56:39.35859+00'::timestamptz),
    ('putter-restoration', '2026-10-04 10:03:18.270301+00'::timestamptz),
    ('ghin', '2026-10-04 10:03:32.138152+00'::timestamptz),
    ('27a30f4f-018e-460a-9b7d-b1dc1488143f', '2026-10-04 10:08:24.324545+00'::timestamptz)
    ) AS snapshot(key, updated_at) USING (key)
    WHERE actual.updated_at IS DISTINCT FROM snapshot.updated_at
  ) THEN
    RAISE EXCEPTION 'SERVICES_CHANGED_SINCE_BACKUP: timestamp mismatch';
  END IF;
END
$preflight$;

UPDATE public.storefront_services
SET title_es = 'Reparación y mantenimiento',
    title_en = 'Repair and maintenance',
    eyebrow_es = 'Cuidado y reparación de equipo',
    eyebrow_en = 'Equipment care and repair',
    description_es = 'Preparamos y cuidamos tu equipo de golf para la próxima ronda. Los trabajos están sujetos a evaluación, disponibilidad y cotización.',
    description_en = 'Care and service for your golf equipment. Work is subject to inspection, availability, and a quote.',
    items_es = '["Cambio de grips","Cambio de varilla","Limpieza profunda"]'::jsonb,
    items_en = '["Grip replacement","Shaft replacement","Deep cleaning"]'::jsonb,
    cta_label_es = 'Consultar reparación o mantenimiento',
    cta_label_en = 'Ask about repair or maintenance',
    cta_url_es = 'https://api.whatsapp.com/send/?phone=526243554700&text=Hola%20UP%20AND%20DOWN%2C%20quiero%20consultar%20una%20reparaci%C3%B3n%20o%20mantenimiento%20para%20mi%20equipo%20de%20golf.',
    cta_url_en = 'https://api.whatsapp.com/send/?phone=526243554700&text=Hi%20UP%20AND%20DOWN%2C%20I%20would%20like%20to%20ask%20about%20repair%20or%20maintenance%20for%20my%20golf%20equipment.',
    note_es = 'Revisamos cada pieza y confirmamos las opciones antes de iniciar cualquier trabajo.',
    note_en = 'We inspect each club and confirm the available options before starting.',
    sort_order = 1
WHERE key = 'repair';

UPDATE public.storefront_services
SET title_es = 'Intercambios y consignación',
    title_en = 'Trade-ins and consignment',
    eyebrow_es = 'Valoración presencial',
    eyebrow_en = 'In-store assessment',
    description_es = 'Podemos revisar tu equipo para explorar alternativas de intercambio o consignación, sujetas a evaluación y aceptación.',
    description_en = 'Bring your equipment for evaluation of potential trade-in or consignment options, subject to approval.',
    items_es = '["Intercambia tu equipo como parte de pago","Consignación de equipo sujeto a valoración","Condiciones acordadas antes de cualquier operación"]'::jsonb,
    items_en = '["Trade equipment toward a purchase","Consignment subject to evaluation","Terms agreed before proceeding"]'::jsonb,
    cta_label_es = 'Consultar intercambio o consignación',
    cta_label_en = 'Ask about trade-ins or consignment',
    cta_url_es = 'https://api.whatsapp.com/send/?phone=526243554700&text=Hola%20UP%20AND%20DOWN%2C%20quiero%20consultar%20sobre%20intercambio%20o%20consignaci%C3%B3n%20de%20equipo%20de%20golf%20y%20conocer%20las%20condiciones%20de%20valoraci%C3%B3n.',
    cta_url_en = 'https://api.whatsapp.com/send/?phone=526243554700&text=Hi%20UP%20AND%20DOWN%2C%20I%20would%20like%20to%20ask%20about%20a%20golf%20equipment%20trade-in%20or%20consignment%20and%20the%20evaluation%20terms.',
    note_es = 'La aceptación, valoración y condiciones se confirman directamente con el equipo de la tienda.',
    note_en = 'Acceptance, valuation, and terms are confirmed with the store.',
    sort_order = 2
WHERE key = 'trade';

UPDATE public.storefront_services
SET sort_order = 5
WHERE key = 'ghin';

UPDATE public.storefront_services
SET title_es = 'Restauración y personalización',
    title_en = 'Restoration and customization',
    eyebrow_es = 'VS GOLF · Putters y wedges',
    eyebrow_en = 'VS GOLF · Putters and wedges',
    sort_order = 6
WHERE key = '27a30f4f-018e-460a-9b7d-b1dc1488143f';

INSERT INTO public.storefront_services (
  key, sort_order, is_active, use_referral, title_es, title_en, eyebrow_es, eyebrow_en, description_es, description_en, items_es, items_en, cta_label_es, cta_label_en, cta_url_es, cta_url_en, note_es, note_en, image_url
) VALUES (
  'lie-loft-adjustment',
  3,
  true,
  false,
  'Ajuste de lie y loft',
  'Lie and loft adjustment',
  'PRÓXIMAMENTE',
  'COMING SOON',
  'Estamos preparando el servicio de ajuste de lie y loft para palos de golf.',
  'We are preparing a lie and loft adjustment service for golf clubs.',
  '["Servicio aún no disponible para solicitar o agendar"]'::jsonb,
  '["This service is not available to request or book yet"]'::jsonb,
  '',
  '',
  '',
  '',
  'Publicaremos más información cuando se encuentre disponible.',
  'More information will be available once the service launches.',
  NULL
);

DELETE FROM public.storefront_services WHERE key IN ('maintenance', 'putter-restoration');

DO $verify$
DECLARE final_keys text[];
DECLARE final_orders integer[];
BEGIN
  SELECT array_agg(key ORDER BY key), array_agg(sort_order ORDER BY sort_order)
  INTO final_keys, final_orders FROM public.storefront_services;
  IF final_keys IS DISTINCT FROM ARRAY['27a30f4f-018e-460a-9b7d-b1dc1488143f', 'classes', 'ghin', 'lie-loft-adjustment', 'repair', 'trade']::text[]
     OR final_orders IS DISTINCT FROM ARRAY[1,2,3,4,5,6]::integer[]
     OR (SELECT COUNT(*) FROM public.storefront_services WHERE is_active) <> 6
     OR (SELECT COUNT(*) FROM public.storefront_services WHERE key='lie-loft-adjustment' AND image_url IS NULL AND cta_label_es='' AND cta_label_en='' AND cta_url_es='' AND cta_url_en='') <> 1
  THEN RAISE EXCEPTION 'SERVICES_UNIFICATION_POSTCHECK_FAILED: keys %, orders %', final_keys, final_orders;
  END IF;
END
$verify$;
COMMIT;
