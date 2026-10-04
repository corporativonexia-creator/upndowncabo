INSERT INTO public.storefront_texts (key,source_text,es,en) VALUES
('card.details','Ver detalles','Ver detalles','View details'),
('collection.viewAll','Ver colección completa →','Ver colección completa →','View full collection →')
ON CONFLICT (key) DO UPDATE SET source_text=EXCLUDED.source_text,es=EXCLUDED.es,en=EXCLUDED.en,updated_at=now();
