# UpNDown Web 2.0 — Etapa 9: auditoría y preparación para lanzamiento

**Fecha:** 2026-11-08  
**Alcance:** `/vista-previa` en `main`; `storefront-premium-v2` continúa pausada.  
**Restricciones:** no publicar la nueva portada ni activar pagos reales de Stripe; no modificar movimientos de POS ni existencias.

## Cambios de código aplicados

1. **Reparación incremental de texto:** `src/components/store/storefront-parity.tsx` ahora inspecciona exclusivamente nodos DOM alterados en `/vista-previa`. El comportamiento público previo se conserva.
2. **Carga de variantes visibles:** `public/updown-parity-runtime.js` consulta variantes solamente de los productos presentes en el catálogo visible, usando lotes de hasta 60 IDs y paginación estable. La consulta pública anterior se conserva.
3. **Productos relacionados:** `src/lib/storefront/get-related-products.ts` obtiene los lotes de variantes con concurrencia máxima de tres consultas, manteniendo el carrusel posterior a la ficha.
4. **Carrito mientras Stripe no está habilitado:** en `/vista-previa`, cuando los cobros están desactivados, el botón ofrece «Consultar pedido por WhatsApp» con artículos, cantidades y referencia del vendedor; no genera pagos ni modifica el carrito.
5. **Invalidación de caché:** se incrementó el identificador del runtime de la vista previa para cargar el nuevo código.

## Pruebas efectuadas

- Sintaxis JavaScript del runtime verificada.
- Prueba de consulta de variantes con datos sintéticos: 130 productos, 1,170 variantes visibles, 30 no visibles, múltiples páginas, error simulado y catálogo vacío.
- Prueba del enlace de consulta de carrito: teléfono correcto, cantidades y referencia incluidos, sin invocar Stripe.
- Compilación remota de Vercel comprobada en despliegues `READY`.
- Consultas de Supabase **solo de lectura** y comprobación de políticas RLS con `SET LOCAL ROLE anon` dentro de transacciones revertidas.
- Inventario observado: 162 productos activos; 92 visibles online y 70 no visibles. 303 variantes activas; 96 vinculadas a productos visibles y 207 a productos no visibles.
- Cero existencias negativas y cero precios no positivos en los productos visibles de la muestra consultada; cero existencias negativas y cero precios de variante negativos en las variantes activas.

**No realizado:** mediciones reales de Web Vitals/Lighthouse con sesión administrativa, pruebas manuales visuales Safari/iOS, pruebas integrales de checkout de Stripe y pruebas end-to-end de permisos de operadores POS.

## Hallazgo crítico — Seguridad de catálogo

**Confirmado mediante consulta bajo rol `anon`:** las políticas actuales permiten leer **70 productos no visibles online** y **207 variantes activas vinculadas a esos productos** mediante la API de Supabase.

- La política pública de `products` filtra `status='active'` pero no `online_visible=true`.
- La política pública de `product_variants` exige `is_active` y padre `status='active'`, pero tampoco exige `online_visible`.

Los productos no necesariamente aparecen en la página pública, pero la API permite consultarlos. **Bloqueador previo al lanzamiento público.** No se modificaron las políticas todavía: antes hay que verificar los roles de cajeros y administradores del POS y diseñar SELECT públicas restringidas sin cortar su acceso autorizado.

### Recomendación de corrección

1. Auditar permisos efectivos del POS, vendedores, visitantes y administradores sobre `products` y `product_variants`.
2. Diseñar políticas públicas que requieran `status='active' AND online_visible=true`, y políticas independientes para personal operativo autorizado.
3. Probar en una transacción los roles `anon`, `authenticated` (operadores) y administrador; verificar el POS y su catálogo de artículos físicos antes de aplicar cambios permanentes.
4. Aplicar la migración únicamente después de aprobar la matriz de accesos y disponer de reversión.

## Otros bloqueadores / pendientes

- **Compartir ficha de la vista previa:** las rutas `/vista-previa/producto/[productKey]` requieren administrador. Los destinatarios externos y robots sociales de WhatsApp no podrán abrirlas ni obtener miniaturas completas como si fueran públicas. Se requiere preparar la ruta pública canónica `/producto/[productKey]` en el lanzamiento.
- **Stripe:** la pasarela real V2 sigue deshabilitada deliberadamente; no simular que se puede cobrar. Se mantiene la alternativa de consulta por WhatsApp en la vista previa.
- **Regresiones visuales:** revisar dispositivos reales (Safari, Chrome, móvil vertical y horizontal), tarjetas de Servicios, galería/lista, búsqueda, carrito y enlaces compartidos antes de reemplazar la portada.
- **Rendimiento medido:** optimizaciones verificadas por código, pero sin afirmar una mejora concreta en segundos. Requiere instrumentación de TTFB/LCP e interacción tras autenticar.
- **Avisos automáticos de Supabase:** aparecen advertencias de optimización RLS e índices; requieren análisis por función/tabla, sin aplicar cambios masivos sobre el POS.

## Estado de publicación

- Los cambios de interfaz se limitan a `/vista-previa`.
- La portada de la tienda pública no se sustituye.
- No se modificaron existencias, ventas ni tablas de inventario.
- `storefront-premium-v2` no se tocó.
- **La etapa 9 no se considera lista para aprobar lanzamiento oficial mientras permanezcan los bloqueadores de seguridad y pruebas de cobro.**
