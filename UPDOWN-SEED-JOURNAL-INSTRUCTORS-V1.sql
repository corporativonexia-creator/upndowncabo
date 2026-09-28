-- ============================================================================
-- UP AND DOWN · SEED EDITORIAL CONTENT · V1
-- Restaura los 3 artículos originales de Cabo Journal
-- y registra a Rodrigo Uribe Guevara + Mario Navarro como profesores.
--
-- Seguro de volver a ejecutar: usa ON CONFLICT (slug) DO NOTHING.
-- No modifica registros que ya hayas editado desde Admin.
-- ============================================================================

begin;

insert into public.journal_articles (
  slug, eyebrow, title, summary, body, image_url,
  is_visible, is_priority, sort_order, published_at
)
values
(
  'como-elegir-el-campo-ideal-para-tu-ronda',
  'Destino · Los Cabos',
  'Cómo elegir el campo ideal para tu ronda.',
  'Mar, desierto, viento y diferentes niveles de dificultad: cada campo de Los Cabos ofrece una experiencia distinta.',
  E'Antes de elegir un campo, piensa primero en la experiencia que buscas. Una ronda panorámica no siempre es la más indulgente, y un trazado técnico puede ser excelente para un jugador experimentado, pero frustrante para quien apenas está retomando el juego.\n\nExperiencia\nConsulta dificultad, tipo de terreno y ritmo estimado de juego.\n\nClima\nEn Los Cabos, el viento y la hora de salida pueden cambiar completamente la ronda.\n\nLogística\nRevisa ubicación, acceso, código de vestimenta y políticas del club.\n\nLa recomendación de Coque\nPara una primera visita, prioriza una combinación equilibrada de paisaje, accesibilidad y nivel de dificultad. Cuando ya conozcas cómo juegas con el viento y la firmeza del terreno local, será más fácil buscar retos técnicos específicos.\n\nLos horarios, condiciones de acceso y disponibilidad pueden cambiar. UP AND DOWN funciona únicamente como directorio informativo; confirma siempre los detalles directamente con el campo.',
  'https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?auto=format&fit=crop&w=1400&q=88',
  true, true, 10, now()
),
(
  'como-elegir-un-driver-sin-comprar-solo-distancia',
  'Equipment guide',
  'Cómo elegir un driver sin comprar solo distancia.',
  'La cabeza más nueva o el loft más bajo no garantizan mejores salidas. El objetivo real es encontrar consistencia.',
  E'Un buen driver debe ayudarte a repetir un patrón de vuelo útil, no solamente producir un golpe espectacular de vez en cuando. Loft, flexibilidad de la varilla, longitud, peso y distribución de masa trabajan juntos.\n\nLoft\nMás loft puede facilitar el lanzamiento y reducir la pérdida de distancia por golpes bajos.\n\nVarilla\nEl flex correcto debe acompañar tu velocidad y tempo, no tu ego. El ego rara vez encuentra fairway.\n\nPerdón\nUna cabeza estable conserva más velocidad cuando el impacto no ocurre en el centro.\n\nPrioriza dispersión\nCompara la distancia promedio y la dispersión, no únicamente el golpe más largo. Diez metros menos dentro del fairway suelen valer más que veinte metros adicionales desde una posición complicada.\n\nCuando sea posible, prueba distintas configuraciones antes de decidir. La selección correcta debe sentirse repetible y cómoda durante toda la ronda.',
  'https://images.unsplash.com/photo-1535131749006-b7f58c99034b?auto=format&fit=crop&w=1400&q=88',
  true, true, 20, now()
),
(
  'que-llevar-para-jugar-bajo-el-clima-de-los-cabos',
  'Cabo essentials',
  'Qué llevar para jugar bajo el clima de Los Cabos.',
  'Sol intenso, viento y cambios de temperatura entre la mañana y la tarde exigen una bolsa bien planeada.',
  E'Prepararte para el entorno ayuda tanto como elegir el palo correcto. Además de tu equipo habitual, considera protección solar, hidratación, capas ligeras y accesorios que mantengan el agarre estable.\n\nProtección\nGorra, lentes, bloqueador y manga ligera para exposición prolongada.\n\nAgarre\nGuante adicional y toalla seca para mantener control cuando aumenta el calor.\n\nHidratación\nAgua y electrolitos antes de sentir sed; el clima seco puede engañar.\n\nMenos peso, mejor selección\nNo necesitas llenar todos los bolsillos. Lleva solamente lo que resuelva una necesidad real durante la ronda y revisa previamente si el campo ofrece agua, práctica, restaurante o tienda.\n\nEn salidas tempranas puede sentirse fresco, mientras que al mediodía la radiación aumenta considerablemente. Una capa ligera y transpirable suele ser la mejor solución.',
  'https://images.unsplash.com/photo-1593111774240-d529f12cf4bb?auto=format&fit=crop&w=1400&q=88',
  true, false, 30, now()
)
on conflict (slug) do nothing;

insert into public.golf_instructors (
  slug, name, short_bio, image_url, phone, whatsapp_phone,
  specialties, is_visible, sort_order
)
values
(
  'rodrigo-uribe',
  'Rodrigo Uribe Guevara',
  'Rodrigo es profesional e instructor de golf con más de 22 años de experiencia en Los Cabos. Comenzó a jugar desde los seis años y fortaleció su formación en Barcelona y Coastal Carolina University. Ha colaborado con reconocidos campos como Cabo del Sol, Cabo Real, Diamante, Costa Palmas y Querencia, combinando experiencia técnica, conocimiento del juego y atención personalizada.',
  '/assets/instructors/rodrigo-uribe.jpg',
  '+526241222731',
  '+526241222731',
  array['Técnica de swing','Consistencia','Estrategia de campo'],
  true,
  10
),
(
  'mario-navarro',
  'Mario Navarro',
  'Mario cuenta con más de 44 años de experiencia en el golf como jugador, profesional e instructor. Fue Campeón Amateur de Nuevo México en 1999, compitió en México y Estados Unidos, y dirigió la Selección Nacional de Golf de Guatemala. Su formación con reconocidos entrenadores y su amplia experiencia internacional le permiten adaptar la enseñanza a golfistas de cualquier edad o nivel, ayudándolos a mejorar su técnica, estrategia y confianza en el campo.',
  '/assets/instructors/mario-navarro.jpg',
  '+526241105711',
  '+526241105711',
  array['Técnica','Estrategia','Confianza en campo'],
  true,
  20
)
on conflict (slug) do nothing;

commit;

notify pgrst, 'reload schema';

-- VERIFICACIÓN
select slug,title,is_visible,is_priority,sort_order
from public.journal_articles
where slug in (
  'como-elegir-el-campo-ideal-para-tu-ronda',
  'como-elegir-un-driver-sin-comprar-solo-distancia',
  'que-llevar-para-jugar-bajo-el-clima-de-los-cabos'
)
order by sort_order;

select slug,name,is_visible,sort_order,whatsapp_phone
from public.golf_instructors
where slug in ('rodrigo-uribe','mario-navarro')
order by sort_order;
