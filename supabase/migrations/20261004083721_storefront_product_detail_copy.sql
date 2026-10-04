INSERT INTO public.storefront_texts (key,source_text,es,en) VALUES
('product.more','Ver más','Ver más','Read more'),
('product.less','Ver menos','Ver menos','Read less'),
('product.expandImage','Ampliar foto','Ampliar foto','Expand photo'),
('product.closeImage','Cerrar imagen','Cerrar imagen','Close image')
ON CONFLICT (key) DO UPDATE SET source_text=EXCLUDED.source_text,es=EXCLUDED.es,en=EXCLUDED.en,updated_at=now();
