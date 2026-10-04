INSERT INTO public.storefront_texts (key,source_text,es,en) VALUES
('section.categories','Encuentra lo que buscas','Encuentra lo que buscas','Find what you need'),
('section.new','Novedades y ofertas','Novedades y ofertas','New arrivals & offers'),
('section.catalog','Colección completa','Colección completa','Complete collection'),
('section.services','Servicios UP AND DOWN','Servicios UP AND DOWN','UP AND DOWN Services'),
('section.courses','Golf en Los Cabos','Golf en Los Cabos','Golf in Los Cabos'),
('section.about','Quiénes somos','Quiénes somos','About us'),
('about.services','Servicios →','Servicios →','Services →'),
('footer.tagline','Golf, equipo y experiencia local en Los Cabos.','Golf, equipo y experiencia local en Los Cabos.','Golf, equipment and local expertise in Los Cabos.'),
('footer.explore','Explorar','Explorar','Explore'),
('footer.contact','Contacto','Contacto','Contact'),
('footer.new','Novedades y ofertas','Novedades y ofertas','New arrivals & offers'),
('footer.products','Todos los productos','Todos los productos','All products'),
('footer.courses','Campos de golf','Campos de golf','Golf courses'),
('footer.services','Servicios','Servicios','Services'),
('footer.copyright','© 2026 UP AND DOWN · TIENDA DE GOLF EN CABO · COQUE.','© 2026 UP AND DOWN · TIENDA DE GOLF EN CABO · COQUE.','© 2026 UP AND DOWN · CABO GOLF SHOP BY COQUE.')
ON CONFLICT (key) DO UPDATE SET source_text=EXCLUDED.source_text,es=EXCLUDED.es,en=EXCLUDED.en,updated_at=now();
