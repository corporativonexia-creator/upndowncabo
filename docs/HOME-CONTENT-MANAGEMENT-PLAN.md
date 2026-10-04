# UP AND DOWN · Content Management Plan (next Admin phase)

This file records the Home UX V2 requirements approved before the Admin panel update.
No database schema is changed by the Home UX V2 patch.

## Golf courses
Admin must support:
- name
- location_label
- description
- image_url
- map_url
- official_url
- is_visible (show / no show)
- sort_order
- updated_at

The Home should render only `is_visible = true`.

## Golf instructors / teachers
Admin must support:
- name
- short_bio
- image_url
- specialties
- booking_url or booking reference
- is_visible (show / no show)
- sort_order
- updated_at

Teachers belong to the Classes service experience.

## Cabo Journal
Admin must support:
- title
- slug
- eyebrow/category
- summary
- body/content
- image_url
- is_visible
- is_priority
- sort_order
- published_at
- updated_at

Home behavior:
- show only active/visible articles
- priority articles first
- initial compact set (3)
- "Ver más artículos" reveals the remaining cards

## Notes
- HOME UX V2 includes data hooks for managed visibility.
- Current static course and journal content remains visible until the Admin/DB phase replaces it with Supabase content.

## Pendientes UX aprobados - 3 de octubre de 2026

Prioridad actual: video del hero en móvil. El header móvil propio, búsqueda, carrito y menú ya están funcionales; conservarlos. No reintroducir el banner ni observers agresivos. Mantener la presentación móvil independiente de escritorio.

### P0 - Hero video
- Ajustar el video móvil a todo el ancho y su proporción natural, sin deformación ni recorte; copy debajo para mostrar la escena completa.
- Validar en 360, 390, 430, 768 y 1023 px, horizontal y escritorio desde 1024 px.
- Confirmar autoplay muted + playsInline, loop, poster y ausencia de overflow horizontal.
- Revisar calidad del MP4 fuente. Mejorar encuadre por CSS no recupera detalle de un archivo comprimido.
- Si se desea un hero vertical inmersivo posteriormente, preparar un video vertical específico con golfista y paisaje balanceados.

### P1 - Limpieza visual y compra
- Mejorar contraste del menú y logo de escritorio, respetando el header móvil ya resuelto.
- Portada nítida con CTA principal y acceso discreto a asesoría.
- Simplificar búsqueda y filtros; filtros técnicos contextuales, borrar solo si hay activos.
- Uniformar fotografías de categorías con el equipo correspondiente, escala y fondo consistentes.
- Uniformar tarjetas de producto: encuadre, proporciones, iluminación, nombre, precio, condición y datos relevantes por categoría.
- Novedades: priorizar disponibles, evitar agotados destacados y repetición innecesaria del catálogo completo.
- Reducir sombras, transparencias y espacios excesivos; conservar márgenes consistentes.
- Unificar etiquetas por idioma ES/EN y corregir codificación de mensajes GHIN.
- Servicios: fotografías reales, descripciones breves y CTA específico por servicio.
- Home compacta: tres campos y tres artículos con acceso al resto.

### P2 - Valor diferencial UpNDown
- Selector "Encuentra equipo para tu juego": nivel, objetivo y presupuesto; resultados con inventario real y asesoría de Coque.
- Seminuevos transparentes: fotos de cara, suela, varilla y grip; estado y especificaciones completas.
- Selección "Listo para jugar en Cabo": productos disponibles para la ronda y clima local.
- Orden propuesto del inicio: portada, categorías, novedades, ayuda para elegir, servicios, campos/Journal, contacto/confianza.
- Conservar verde profundo, arena, estilo editorial, identidad de Los Cabos y asesoría cercana. Referencias como TaylorMade sirven para estudiar jerarquía, no para copiar textos, imágenes o composición.

### Deuda técnica y restricciones
- Limpiar instancias duplicadas de GoTrueClient después del video.
- Stripe permanece pendiente hasta que Aldo confirme acceso a la cuenta del cliente; no activar checkout público.
