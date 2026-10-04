-- Preserve standard golf category names in both storefront languages.
INSERT INTO public.storefront_texts (key,source_text,es,en) VALUES
('text.6118b92a6aff','Hierros','Irons','Irons'),
('category.putters','Restauraciones de Putters','Restauración de Putters','Putter restoration'),
('category.drivers','Drivers','Drivers','Drivers'),
('category.wedges','Wedges','Wedges','Wedges'),
('category.precision','Putters','Putters','Putters'),
('category.label.1','Maderas','Fairway Woods','Fairway Woods'),
('category.label.2','Híbridos','Hybrids','Hybrids'),
('category.label.6','Bolsas','Golf Bags','Golf Bags'),
('category.label.7','Carritos','Golf Carts','Golf Carts'),
('category.label.8','Zapatos','Golf Shoes','Golf Shoes'),
('category.label.9','Guantes','Gloves','Gloves'),
('category.label.10','Pelotas','Golf Balls','Golf Balls'),
('category.label.11','Accesorios','Accessories','Accessories'),
('category.label.12','Ropa','Apparel','Apparel'),
('category.label.13','Equipos completos','Complete Sets','Complete Sets'),
('category.label.14','Tees','Tees','Tees')
ON CONFLICT (key) DO UPDATE SET source_text=EXCLUDED.source_text, es=EXCLUDED.es, en=EXCLUDED.en, updated_at=now();
