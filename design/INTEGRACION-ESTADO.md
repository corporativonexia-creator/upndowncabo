# UP AND DOWN Cabo · INTEGRACION-ESTADO

**Registro maestro para ChatGPT y Work — Lotes 1, 2A, 2B y 2C**
**Fecha de referencia:** 17 de noviembre de 2026
**Repositorio:** `corporativonexia-creator/upndowncabo`
**Rama candidata:** `integracion/premium-white-candidata-20261117`
**Base exacta de main:** `44e3f10bc8cf32d0b468ea6f406d4b4171a79d4b`
**Rama de origen Premium White:** `offline-premium-white-20261114`, commit `19b44e25070f5da875a47008bc438c4e766087f9`
**Estado general:** Lotes 1, 2A, 2B y 2C integrados en candidata protegida. Pendiente Lote 3: build/TypeScript/lint/QA real; sin permiso de merge o deploy.

## 1. Propósito y límites

Consolidar selectivamente funcionalidades vigentes de Premium White y, en lotes posteriores independientes, mejoras operativas. **No realizar merge automático.** Preservar desde el `main` actual todos los desarrollos de POS, recepción, inventario, tienda y seguridad. No hay consentimiento para desplegar ni para abrir la tienda.

Operaciones autorizadas únicamente en este lote: nueva rama desde el SHA exacto de `main`, análisis de conflictos y preparación de inventario y registro maestro. **No modificar `main`, el proyecto Supabase, las ventas ni el POS.**

## 2. Seguridad de Git y despliegues — INNEGOCIABLE

- El proyecto Vercel conectado a GitHub crea previews automáticamente cuando se suben commits a ramas no productivas; esto está confirmado en su historial.
- Esta rama candidata se creó desde `main` y su primer commit, `5ce5eaf2f5481bf02e16f74631dfc56e50bbcf3b`, instaló `vercel.json` con `{"git":{"deploymentEnabled":false}}`.
- La configuración aplica **solo en la candidata** (no está presente en `main`) e impide despliegues automáticos conforme a la configuración documentada de Vercel.
- Vercel se consultó tras crear rama y primer commit: **cero deployments encontrados para esta rama**; volver a verificar después de cada lote.
- **PROHIBIDO incorporar `vercel.json` de esta candidata a `main`.** Antes de cualquier eventual merge, coordinar el retiro de esta salvaguarda con autorización explícita para manejar los triggers de preview/producción. Nunca eliminarla silenciosamente mediante un push en esta rama.
- No realizar `git push` a `main`, no abrir PR ni ejecutar deployment sin autorización posterior.
- **Repositorio GitHub actualmente público.** NO copiar ni crear nuevos respaldos de bases de datos, datos de clientes, tokens, SQL con datos, .env o información interna. El respaldo histórico existente en la rama experimental NO se transfiere a la candidata. La visibilidad del repositorio y la información ya publicada ameritan una revisión de seguridad separada.

## 3. Línea base y inventario

- `main`: SHA `44e3f10bc8cf32d0b468ea6f406d4b4171a79d4b`.
- `offline-premium-white-20261114`: **89 commits por delante, 1 por detrás, 23 archivos distintos** respecto a `main`.
- Esos 89 commits no son una lista de 89 tareas de merge. Debe prevalecer el **diff final selectivo** y compatibilidad con `main`.
- Inventario individual y decisión preliminar: [INTEGRACION-INVENTARIO-LOTE1.md](./INTEGRACION-INVENTARIO-LOTE1.md).

**Frontera entre lotes:** en Lote 1 no se importa ningún componente, stylesheet, runtime, script de servicios ni POS. Todo el contenido funcional candidato sigue pendiente de análisis y de cherry-pick selectivo en Lote 2.

## 4. Estado de aprobación funcional

**Aceptado visual/funcionalmente por administrador:** fondo blanco Premium White, filtro móvil y autocierre, noticias móviles una por fila, fichas independientes, navegación de productos dentro de localhost, búsqueda enfocada en escritorio.

**Implementado en rama fuente, pendiente de pruebas finales locales:** escala más grande de logo sin subir altura del menú; placeholder verde basado en imagen canónica; seis servicios DB-driven y accesos del menú; enlaces de compartir a `/producto/[productKey]`; ajustes responsive en varios anchos.

**Hecho previamente en Supabase, sin que deba repetirse:** seis servicios activos unificados. NO ejecutar `STORE_SERVICES_SIX_UNIFICATION_20261116_ONE_TIME.sql` ni importar respaldos históricos. Operar en lectura para validar.

**Barrera de lanzamiento:** conservar `UNDER_CONSTRUCTION = true` hasta autorización separada.

## 5. Riesgos antes de integrar a main

1. **P0 publicación accidental:** cualquier push a `main` puede desplegar producción. No escribir allí.
2. **P0 configuración de deploy:** no mover `vercel.json` de esta candidata ni el `ignoreCommand` experimental de Premium White a `main`.
3. **P1 portada pública:** la mayoría del CSS Premium White usa el selector `.uds-preview`; `src/app/page.tsx` mantiene `<StorefrontParity />`. Un merge sin adaptación dejaría una experiencia híbrida.
4. **P1 inventario/POS:** las ramas de taller y reportes operativos están separadas. Conservar el código actual en `main`; no fusionar ramas antiguas en bloque.
5. **P1 pruebas:** contratos estáticos no sustituyen compilación `next build`, TypeScript, lint, QA de carrito, variantes, móvil/escritorio ni lector/impresora real.
6. **P1 datos públicos:** el repositorio es público; respaldos privados y scripts de DML usados no deben trasladarse a la candidata.
7. **P2 código duplicado:** evitar duplicación de CSS, listeners React y modificaciones divergentes entre vista privada/pública.

## 6. Lotes, responsables y puertas de decisión

| Lote | Alcance | Responsable propuesto | Entrada | Salida / Gate |
|---|---|---|---|---|
| 1 | Base limpia, Vercel protegido, 23 archivos inventariados, registro maestro | ChatGPT | `main` vigente | **Hecho**; verificar que no hubo deploy |
| 2A | Integración selectiva Premium White + portada pública, sin tocar POS | ChatGPT | Inventario de Lote 1 | Código completo en candidata, sin `main`, no deploy |
| 2B | Búsqueda y filtros, Galería/Lista, navegación a fichas, compartir, 6 servicios Supabase | ChatGPT | Lote 2A | **Integrado en candidata; controles estáticos PASS** |
| 2C | Presentación Premium White compartida en portada pública + preview, Próximamente intacto | ChatGPT | Lote 2B | **Integrado y auditado estáticamente; QA real pendiente** |
| 3 | `npm ci`, build, TypeScript, ESLint y suite QA | Work | Lote 2A/2B | Evidencia real de pruebas, commits puntuales en candidata |
| 4 | Impresión de taller, inventario categoría, SKU/fotos: solo ramas pertinentes | ChatGPT | Rama principal y pruebas separadas | PRs **separados**, seguridad POS |
| 5 | Browser UX E2E + regresión | Work | Candidata verificable | Matriz de pruebas y defectos reproducibles |
| 6 | Revisión final y propuesta PR | ChatGPT + autorización administrador | Sin P0/P1 | GO/NO GO y SHA exacto aprobado |

Cada lote debe actualizar únicamente este registro maestro (resumen, SHA, pruebas reales, bloqueos y siguiente paso). **No volver a revisar todo el historial al iniciar Work**: leer este documento y el inventario, luego inspeccionar solo el código del lote.

## 7. Registro de ejecución — Lote 1

- [x] Inspeccionado SHA de `main` y comparación real con Premium White.
- [x] Verificado proyecto conectado a Vercel y autodespliegues por pushes.
- [x] Creada rama candidata desde `main` sin cherry-picks.
- [x] Añadida prohibición de autodespliegue en `vercel.json` **solo en candidata**.
- [x] Verificado cero despliegues detectados tras el primer commit.
- [x] Inventariados 23 archivos de Premium White y otras ramas activas.
- [x] Preparado este registro maestro sin datos internos ni secretos.
- [ ] Lote 2: incorporar únicamente las mejoras aprobadas.
- [ ] Lote 3: build y navegador.
- [ ] Autorizar separadamente eventual PR/merge/deploy.

## 8. Instrucciones para Work

- Trabajar únicamente sobre `integracion/premium-white-candidata-20261117`.
- Leer primero este registro y `INTEGRACION-INVENTARIO-LOTE1.md`.
- No hacer checkout de ramas antiguas para mezclarlas en bloque.
- No modificar `vercel.json` en esta candidata hasta autorización de estrategia de despliegue.
- No crear PR ni hacer merge a `main` ni desplegar.
- Usar mocks/fixtures para pruebas; nunca modificar datos comerciales.
- Reportar SHA final, pruebas realmente ejecutadas, fallas, bloqueos y riesgos.

## 9. Registro de ejecución — Lote 2A (17-nov-2026)

**Estado:** COMPLETADO EN RAMA CANDIDATA — **SIN PUBLICACIÓN**, **SIN CAMBIOS EN MAIN**. Implementación limitada a presentación y recursos: NO se fusionaron runtime comercial, scripts de servicios, filtros, carrito, POS ni inventario.

### Archivos integrados (7)

1. `src/app/vista-previa/premium-white.css`: importado SIN alteraciones desde rama Premium White, 44,076 caracteres (estilos blanco premium, tipografías, tarjetas, header responsive, logotipo de mayor presencia).
2. `src/components/store/premium-product-detail.css`: añadido, hoja de ficha premium compartida, 6,791 caracteres.
3. `public/assets/updown-product-placeholder.svg`: reemplazado por la imagen verde aterciopelada canónica aprobada del usuario, embebida WebP 600×400, firma FNV-1a `3030130964` de la cadena Base64.
4. `src/app/globals.css`: añadido ÚNICAMENTE el fragmento de 504 caracteres para presentar íntegra la imagen de respaldo cuando exista `.is-product-placeholder`; toda la porción anterior de main se conservó byte por byte.
5. `src/app/vista-previa/page.tsx`: agregado solo import de `premium-white.css` junto a `preview-header.css`. Mantiene `requireRole("admin")`.
6. `src/app/producto/[productKey]/page.tsx`: agregado import de estilo premium y wrapper visual `.ud-premium-product-skin`. Conserva metadatos, JSON-LD, `ProductDetail` y `RelatedProductsServer`, además de `UNDER_CONSTRUCTION` en el proxy.
7. `src/app/vista-previa/producto/[productKey]/page.tsx`: agregado el mismo estilo y wrapper visual, sin modificar autorización admin ni código de selección/carrito.

**Nuevo contrato de auditoría, SOLO para la candidata:** `tests/integration-lot2a-style.cjs`. Ejecutadas sus **6 pruebas estáticas** de forma aislada con el contenido exacto de GitHub: **6 PASS, 0 FAIL**. Esto NO es una prueba de compilación, navegador ni conexión real de Supabase. `node --test tests/integration-lot2a-style.cjs` deberá ejecutarse en Work con el repositorio en disco. El contrato contiene una aserción de seguridad sobre el `vercel.json` temporal y debe excluirse o adaptarse antes de cualquier PR a `main`.

### Verificaciones y protección

- El SVG de portada no se recreó: se copió el arte canónico con el mismo hash.
- El logotipo vectorial original del encabezado permanece sin reescrituras; se aumenta visualmente mediante el CSS aprovado.
- No se copiaron los archivos históricos de backup/SQL ni la maqueta HTML separada.
- No se tocaron: `public/updown-parity-runtime.js`, `public/updown-preview-services-stage7.js`, `src/components/store/storefront-parity.tsx`, `src/components/store/product-detail.tsx`, `src/components/store/responsive/store-search.tsx`, POS, inventario ni Supabase.
- `vercel.json` de la candidata sigue teniendo `git.deploymentEnabled=false`. La comprobación de Vercel tras las escrituras visuales mostró **0 despliegues** asociados a esta rama.
- No se alteró la puerta de lanzamiento `UNDER_CONSTRUCTION = true`.

### Dependencias expresamente pendientes de Lote 2B/2C

- El fondo verde está incorporado como asset; las tarjetas del catálogo sin foto recibirán su clase `.is-product-placeholder` y URL de respaldo al integrar el cambio del runtime en 2B. El estilo presente **no finge que esa conexión ya se haya realizado**.
- Las mejoras de búsqueda, filtro móvil, navegación local y la sincronización funcional de servicios **todavía no están incorporadas a la candidata**. Integrarlas por función en Lote 2B.
- La portada pública todavía usa la UX vigente de `main`. Extender la presentación Premium White a la ruta pública en Lote 2C, sin abrir «Próximamente».
- Las pruebas completas de `next build`, TypeScript, ESLint, navegador y regresión comercial permanecen pendientes para Work, tras completar los lotes 2B/2C.

**Gate de 2A:** sí para continuar con Lote 2B en esta candidata protegida. **NO** para merge a main o despliegue público.

## 10. Registro de ejecución — Lote 2B (17-nov-2026)

**Estado: INTEGRADO EN CANDIDATA, sin publicar.** Revisión selectiva de `offline-premium-white-20261114`, aplicada solo a `integracion/premium-white-candidata-20261117`. La portada pública sigue pendiente de Lote 2C. NO se mezcló una rama completa por git merge, y NO se editaron POS, inventario administrativo, Stripe ni checkout.

### Cambios funcionales verificados en código
- **Buscador inteligente:** búsqueda en tiempo real existente conservada, mejoras de enfoque/escritorio mediante `preview-desktop-search-focus.tsx`, resultados con imagen de respaldo de producto en `store-search.tsx`; sin modificar el origen de datos.
- **Filtros:** filtros de categoría/condición/marca/mano/flex/loft y orden existentes preservados; `preview-filter-auto-collapse.tsx` cierra el panel móvil después de aplicar/limpiar, sin sustituir handlers.
- **Galería/Lista:** control, persistencia de vista y paginación del runtime preservados; la presentación Premium White de 2A los estiliza en preview.
- **Fichas independientes:** `preview-local-product-navigation.tsx` enruta los clics y prefetch a la ruta privada local `/vista-previa/producto/...` incluso al inspeccionar en localhost; navegación a variantes y relacionados protegida por `requireRole("admin")`.
- **Compartir:** en `public/updown-parity-runtime.js` y `product-detail.tsx` los enlaces destinados a WhatsApp/copiar son canónicos `https://upndowncabo.com/producto/...`, mantienen IDs de producto/variante y referencia de vendedor. La navegación interna de preview permanece privada. **No levantar la barrera pública** por este cambio.
- **Servicios administrables:** `updown-preview-services-stage7.js` ahora es únicamente presentación. No reescribe texto/títulos/CTAs del administrador. Menú móvil construye atajos desde `window.__UPDOWN_SERVICES__`, alimentado por `public.storefront_services` (filtro `is_active`, orden `sort_order`). `storefront-parity.tsx` actualiza versiones cacheadas para evitar runtime obsoleto.
- **Imagen faltante:** portada y miniaturas muestran el asset canónico del Lote 2A cuando no hay fotografía válida, sin reemplazar imágenes reales.
- **Seguridad comercial:** se contrastaron y conservaron idénticas las funciones `storefrontPricing`, `reconcilePreviewCart` (precios/existencias por variante) y `stockCopy` frente a la base de candidata. No se modificó esquema/datos de Supabase, ni cantidades de venta.

### Archivos cambiados (10 funcionales + 1 suite)
1. `src/app/vista-previa/preview-desktop-search-focus.tsx` — nuevo
2. `src/app/vista-previa/preview-filter-auto-collapse.tsx` — nuevo
3. `src/app/vista-previa/preview-local-product-navigation.tsx` — nuevo
4. `src/app/vista-previa/page.tsx` — actualizado
5. `src/app/vista-previa/producto/[productKey]/page.tsx` — actualizado
6. `public/updown-parity-runtime.js` — integrado con cambios funcionales auditados
7. `public/updown-preview-services-stage7.js` — simplificado a presentación DB-led
8. `src/components/store/product-detail.tsx` — enlace canónico al compartir
9. `src/components/store/responsive/store-search.tsx` — fallback de producto
10. `src/components/store/storefront-parity.tsx` — cache-busting de scripts
11. `tests/premium-white-contracts.cjs` — nueva suite 18 contratos + 1 TODO E2E

### Evidencia y límites
- Consulta **solo lectura** a proyecto Supabase `upanddown`: `public.storefront_services` contiene **6 registros activos de 6**, sin escritura ni re-ejecución de SQL de unificación.
- Comprobaciones ad hoc realizadas sobre el contenido real de GitHub: **28 PASS / 0 FAIL** (17 controles funcionales/seguridad y 11 controles visuales/administración). Scripts comerciales parseados con constructor JS: **2 PASS**.
- Se añadió la suite `tests/premium-white-contracts.cjs` con **18 tests y un TODO navegador**. **No se ejecutó `node --test` ni `npm ci`, `next build`, TypeScript, ESLint o Playwright en un checkout local**; esas pruebas continúan pendientes de Work/Lote 3. No presentar el chequeo textual como E2E.
- Verificado el `vercel.json` exclusivo de candidata: `git.deploymentEnabled=false`. Vercel: **0 deployments de esta rama** en consulta posterior a commits funcionales (volver a verificar tras el registro).
- `main` se mantuvo en `44e3f10bc8cf32d0b468ea6f406d4b4171a79d4b`. Sin pull request, merge, despliegue ni cambio a `UNDER_CONSTRUCTION=true`.

**Siguiente puerta:** Lote 2C, extender Premium White a la tienda pública manteniendo el bloqueo de lanzamiento. Después, ejecutar build y QA con Work y aprobar cualquier PR/despliegue de forma independiente.

## 11. Registro de ejecución — Lote 2C (17-nov-2026)

**Estado: IMPLEMENTADO EN RAMA CANDIDATA — SIN PUBLICACIÓN.** El diseño Premium White de /vista-previa se aplica ahora a la portada pública desde el mismo CSS. No se convierte la tienda pública en un preview admin: el modo operativo comercial, filtros/datos y control de autorización siguen separados.

**Línea base:** commit `1f6b682efe0e10521e7bcc3bd5f592e012f77016` (cierre Lote 2B). **Commit de Lote 2C antes de este registro:** `7ec321b374e58d113f989d698cad10e0e178c90e` (ajustar referencia al SHA final del registro).

### Cambios quirúrgicos
1. `src/app/vista-previa/preview-header.css` y `src/app/vista-previa/premium-white.css`: selectors scope-gated `#updown-store:is(.uds-preview,.uds-premium-white)`; el segundo modificador es **solo visual**. El encabezado móvil fuera de la raíz también usa `:is(.uds-preview-mobile-header,.uds-premium-white-mobile-header)`. Se preserva la paleta canónica, dimensiones de iconos/logotipo y reglas responsive; no se copian estilos globales abiertos al POS/admin.
2. `src/components/store/storefront-parity.tsx`: agrega `uds-premium-white` a la raíz común, manteniendo `uds-preview` **solo** para `previewMode=true`. Usa el mismo markup Premium con acceso visual VS Golf en el header en ambas rutas, conserva el runtime comercial público y su vista `previewMode=false`. Carga el script de presentación Stage 7 para ambas rutas, pero **Stage 8 de ubicación sigue cargándose solo en preview**.
3. `src/app/page.tsx`: importa las dos hojas compartidas y reutiliza auxiliares de enfoque/buscador y autocierre de filtros. Mantiene `<StorefrontParity />` **sin** `previewMode` ni `requireRole`, detrás de la barrera general.
4. `src/components/store/responsive/mobile-header.tsx`: clase visual `uds-premium-white-mobile-header` sobre el encabezado canónico; no sustituye handlers ni rutas.
5. `src/app/vista-previa/preview-desktop-search-focus.tsx` y `preview-filter-auto-collapse.tsx`: buscan la nueva clase visual compartida, conservando listeners y limpieza.
6. `public/updown-preview-services-stage7.js`: acepta la clase visual en ambas rutas; **no** modifica registros ni reescribe título, bullets, imagen, estado, CTA, costo o URL de `storefront_services`.
7. `tests/integration-lot2a-style.cjs` y `tests/premium-white-contracts.cjs`: contratos de selectores/servicios actualizados para el nuevo alcance visual; `tests/integration-lot2c-shared-skin.cjs` nuevo, con **7 contratos**.

### Auditoría
- Los 7 contratos del Lote 2C pasaron con un **harness de aserciones en memoria** alimentado con el contenido exacto de archivos GitHub: **7 PASS/0 FAIL**. **No equivale** a ejecutar `node --test` con Node ni a compilar Next.js. El constructor de pruebas no realizó solicitudes públicas ni mutaciones.
- CSS (ambos archivos): llaves balanceadas, selectores compartidos `:is()` y scope móvil verificados.
- Comparación del commit Lote 2B al cierre de código 2C: **11 archivos cambiados**, únicamente estilos, presentación, home y tests; **sin modificación de `public/updown-parity-runtime.js`**, POS, inventario, tabla de productos ni datos Supabase.
- `src/proxy.ts` permanece con `UNDER_CONSTRUCTION = true`. `vercel.json` temporal de candidata permanece con `git.deploymentEnabled=false`.
- Consulta Vercel: **0 despliegues** de esta rama después de cambios y tests, verificación anterior a este registro; repetir al cerrar el commit documental.
- `main` sigue en `44e3f10bc8cf32d0b468ea6f406d4b4171a79d4b`. Sin PR, merge, checkout de ramas antiguas ni despliegue.

### Frontera funcional y pendientes reales
- Esta fase es de **paridad VISUAL** donde el DOM compartido lo permite. La vista previa conserva funcionalidades exclusivas ligadas a `PREVIEW_CATALOG` (vista Galería/Lista y sus controles de paginación, navegación interna admin, filtros de preview). **No** se activó `PREVIEW_CATALOG` en público para no modificar checkout, stock ni otras reglas comerciales. Confirmar la paridad de controles de catálogo pública/privada como gate específico de lanzamiento; no afirmar todavía funcionalidad pública idéntica.
- El componente móvil VS Golf conserva su comportamiento existente por ruta aunque el aspecto esté unificado. Validar acciones y accesibilidad desde navegador real.
- **PENDIENTE:** `npm ci`, `node --test` (Lote 2A/2B/2C), TypeScript, ESLint, `next build`, Playwright escritorio/móvil y pruebas reales de buscador, galería/lista, filtros, servicios, variantes, carrito y ficha. Reservado a Lote 3 y Lote 5.
- Antes de eventual PR a `main`, retirar o excluir explícitamente `vercel.json` **sin desproteger prematuramente la candidata**; esa operación requiere autorización de release separada.

**Siguiente puerta:** autorizar Lote 3 para pruebas de compilación y regresión offline, sin deploy ni operaciones sobre la base.

## 12. Lote 3 · Preauditoría y traspaso a Work (17-nov-2026)

**Fase previa COMPLETADA; QA ejecutable en Work PENDIENTE.** Se verificó que la candidata conserva `UNDER_CONSTRUCTION=true`, `git.deploymentEnabled=false`, y no registra despliegues. El entorno local disponible aquí no tiene resolución DNS a GitHub, ni Next/React instalados: **no fue posible ejecutar `npm ci`, TypeScript, ESLint, `next build` ni navegador E2E**. No declarar éxito de compilación.

Se ejecutaron **las 6 aserciones del contrato Lote 2A** en un harness JS V8 con archivos extraídos de GitHub: **6 PASS/0 FAIL** (no el proceso de Node), y se conservaron los **7 PASS de controles de Lote 2C**. En Lote 2B se contaba con **28 verificaciones estáticas**; la suite formal de **18 contratos + 1 TODO** continúa por ejecutar en Node con Work.

**Handoff exacto:** [LOTE3-QA-WORK-20261117.md](./LOTE3-QA-WORK-20261117.md). Este runbook incluye comandos y matriz de QA con fixtures/mocks sin datos de producción, guardas, P1 pendiente de Galería/Lista en público, criterios de GO/NO GO y actualización del registro maestro. Work es ahora la siguiente etapa; el usuario debe iniciar Work con el enlace/documento y rama exacta. Ni main ni Vercel ni Supabase se tocaron en esta preauditoría.

## 13. Lote 3 · QA ejecutado en Work (17-nov-2026)

**Decisión: NO-GO para avanzar con la candidata como validada comercialmente.** El build pasa y el paginador móvil público quedó restaurado. La paridad Galería/Lista y la localización de la ficha siguen abiertas.

- Rama local exclusiva: `integracion/premium-white-candidata-20261117`.
- SHA de entrada, checkout limpio: `59928d3b1ec70ce5263a18992e0a2c1a4681833a`.
- SHA final de código probado: `35b27cd50a409000d92c11a7be56ee15003519bf`. El HEAD de entrega añade únicamente esta entrada documental. Su SHA se obtiene con `git rev-parse HEAD`.
- El HEAD remoto de la candidata sigue en el SHA de entrada. Los commits de QA se conservaron localmente.

### Comandos y resultados

| Comando, en orden de ejecución | Checkout inicial | Código final |
| --- | --- | --- |
| `npm ci` | PASS, 405 paquetes instalados | Mismo lockfile y dependencias |
| `node --test tests/integration-lot2a-style.cjs tests/premium-white-contracts.cjs tests/integration-lot2c-shared-skin.cjs` | PASS, 31 contratos, 0 fallos, 1 TODO | PASS, 31 contratos, 0 fallos, mismo TODO de la suite |
| `npm run check:admin-scripts` | PASS, sintaxis de 10 scripts | PASS, 10 scripts |
| `npx tsc --noEmit` | FAIL, TS2769 en alta y baja del listener de ficha privada | PASS |
| `npm run lint` | PASS, 0 errores y 9 advertencias | PASS, 0 errores y las mismas 9 advertencias |
| `npm run build` | FAIL, compiló y falló en el typecheck por el mismo TS2769 | PASS, Next.js 16.3.3, incluido prebuild |

### Correcciones comprobadas

1. `8bc1d9f019257d26721596b02596dc1c0cc8394a` · `src/app/vista-previa/preview-local-product-navigation.tsx`. `querySelector` infería `Element` y sus overloads de eventos rechazaban el listener `MouseEvent`. Se tipó el `div` real de la ficha. Pasaron TypeScript, build, contratos y navegación local entre producto, variante y relacionados.
2. `35b27cd50a409000d92c11a7be56ee15003519bf` · `src/app/vista-previa/preview-header.css` y `tests/integration-lot2c-shared-skin.cjs`. El selector compartido del Lote 2C ocultaba `#udsMobileCatalogPager58` incluso en público. El runtime mostraba solo cuatro tarjetas en móvil y el visitante no podía avanzar. La regla quedó limitada a `.uds-preview` y se añadió la aserción al contrato existente. Se repitieron los comandos afectados y el flujo en Chromium.

### Matriz comercial ejecutada

Chromium local con servidor Next compilado, catálogo de 32 artículos, variante de $475 MXN con stock de dos y seis servicios activos simulados. La portada pública se probó sirviendo el HTML compilado mediante otro servidor de fixtures en loopback. La aplicación sirvió `/proximamente` en su origen normal durante todo el QA. Las imágenes externas se simularon y las fuentes remotas quedaron fuera de la prueba. Resultado final de navegador: 30 PASS, 1 FAIL y 0 excepciones de página capturadas.

| Prueba | Resultado |
| --- | --- |
| Premium White y responsive privado | PASS a 320, 390, 760, 1024 y 1440 px para SVG de encabezado visible, categorías y tarjetas, CSS tipográfico y ancho sin desbordamiento |
| Buscador inteligente privado | PASS para coincidencia en vivo, foco en escritorio, buscador móvil, navegación a ficha local e imagen canónica de respaldo |
| Filtros privados | PASS a 390 y 1440 px para categoría, marca, condición, mano, flex, loft, orden, aplicar y limpiar. Autocierre comprobado a 390 px |
| Galería/Lista y paginación privada | PASS en los cinco anchos. Móvil 4/8/16/32/64 y escritorio 12/24/48/96 |
| Catálogo público compilado | PASS para la diferencia entre canales en los cinco anchos. El paginador público muestra cuatro tarjetas y permite avanzar a 320, 390 y 760 px. A 1024 y 1440 px se muestran las 32 tarjetas de prueba. El selector Galería/Lista sigue ausente |
| Ficha y compartir | PASS para ficha de producto, variante, dos fotos navegables y relacionado en localhost. Copia y destino de WhatsApp comprobados con URL pública, ID de variante y `ref=QA2026`. Apertura de WhatsApp interceptada |
| Servicios privados | PASS para seis tarjetas activas y su orden. Cinco reprodujeron título, foto, descripción y CTA del fixture. Clases conservó su formulario y título local, y tomó su foto del fixture |
| Carrito privado | PASS para agregar, tope de dos unidades, precio unitario de $475 MXN, disminuir y eliminar |
| Idioma | PASS para cambio ES/EN del catálogo privado en los cinco anchos. FAIL en la ficha: con EN guardado, continúa mostrando «Envío no incluido» |
| Seguridad | PASS para barrera pública con `ref` intacto y redirecciones anónimas desde `/admin`, `/vista-previa` y ficha privada. También se verificaron `/admin/inventario` y `/admin-afiliados` por HTTP. El acceso con administrador simulado habilitó la vista privada |

### Pendientes y protección

- **P1 — Galería/Lista pública.** La raíz pública lleva `.uds-premium-white` y el modo privado se mantiene desactivado. Su runtime usa el paginador móvil legado y no instala el selector de vista ni el paginador avanzado. `PREVIEW_CATALOG` controla también carga de productos/variantes, navegación y el comportamiento del botón de pedido sin checkout. Para compartir los controles, separar el estado de vista y paginación de esa bandera, usar la misma colección ya filtrada de cada canal y sustituir el paginador legado únicamente donde el nuevo esté activo. Repetir pruebas de ambos canales con fixtures antes de aprobarlo.
- **P1 — Ficha en inglés.** Al guardar EN en el catálogo y abrir la ficha privada, la etiqueta de envío permanece en español. `src/components/store/product-detail.tsx` contiene etiquetas y acciones en español y aún no consume el idioma del catálogo. Validar la ficha bilingüe como conjunto.
- **P2 — Servicio Clases.** El runtime excluye deliberadamente el título, la descripción y el CTA de la fila `classes` del render administrable para preservar el flujo de reserva. Alinear los campos editables que deban respetarse con el flujo de clases antes de cambiar su contrato.
- **P0 operativo — Publicación accidental.** `main` sigue en `44e3f10bc8cf32d0b468ea6f406d4b4171a79d4b`. El endpoint de rama GitHub devolvió `protected=false` para `main`. La consulta de reglas administrativas devolvió 403. No hubo escritura en `main` ni cambios de configuración.
- **Vercel:** 0 despliegues para la candidata, consultados por proyecto y rama. `git.deploymentEnabled=false` y `UNDER_CONSTRUCTION=true` comprobados. **Supabase:** solo fixtures locales. Sin migraciones, datos reales, pedidos, pagos ni cambios de POS, inventario, recepción o impresión.

## 14. Lote 3B — Cierre de correcciones comerciales

**Resultado técnico y comercial probado:** los dos P1 del Lote 3 quedan cerrados en el entorno de QA. **NO-GO de lanzamiento** por el riesgo P0 operativo de `main` sin protección de rama reportada por GitHub. La tienda continúa cerrada al público.

- Rama exclusiva: `integracion/premium-white-candidata-20261117`.
- SHA remoto de partida: `59928d3b1ec70ce5263a18992e0a2c1a4681833a`. HEAD local inicial limpio: `6a808a8c6380e621665cf349ed7f0f4e4fdddaca`.
- Correcciones recuperadas y verificadas en el checkout local: `8bc1d9f019257d26721596b02596dc1c0cc8394a` (tipado de navegación) y `35b27cd50a409000d92c11a7be56ee15003519bf` (CSS del paginador anterior). Ambas estaban ausentes del remoto de partida.
- SHA final de código validado localmente: `5f84cc82d163098cc942a061fafb9ace03955e2c`. El siguiente commit de cierre añade esta entrada documental.

### Commits y archivos del Lote 3B

| Commit local | Archivos | Corrección |
| --- | --- | --- |
| `39d0f7b31c5afc3118a5841c01353b9f692f05e6` | `public/updown-parity-runtime.js`, `src/components/store/storefront-parity.tsx`, `tests/premium-white-contracts.cjs` | Estado de vista y paginación compartido, con preferencias por canal. Los filtros y el orden se mantienen al alternar la vista. Cambiar la consulta reinicia la página. El paginador legado se omite en Premium White. Las tarjetas públicas abren la ficha canónica en su origen actual. Las consultas públicas y privadas, el cálculo comercial y los pedidos conservan sus guardas existentes. |
| `5f84cc82d163098cc942a061fafb9ace03955e2c` | `src/components/store/product-detail.tsx`, `related-products-rail.tsx`, `use-storefront-language.ts`, páginas pública y privada `producto/[productKey]/page.tsx` | La ficha y los relacionados leen ES/EN guardado tras hidratar. Se localizan envío, botones, disponibilidad, galería, mensajes, acciones de compartir y enlaces de consulta. Los campos originales del producto, SKU, marca, precio, moneda y referencias se conservan. La ruta de regreso retiene la vista de la colección. |

### Pruebas ejecutadas

| Prueba | Resultado |
| --- | --- |
| `npm ci` | PASS, 405 paquetes |
| Tres suites `node --test` de los lotes 2A, 2B y 2C | PASS, 31 contratos, 0 fallos y 1 TODO preexistente |
| `npm run check:admin-scripts` | PASS, sintaxis de 10 scripts |
| `npx tsc --noEmit` | PASS |
| `npm run lint` | PASS, 0 errores y 9 advertencias preexistentes |
| `npm run build` | PASS, Next.js 16.3.3, incluido prebuild |
| Chromium en loopback con fixtures | 32 PASS, 0 FAIL, 0 excepciones de página |

A **320, 390, 760, 1024 y 1440 px** se probó Galería/Lista y paginación de ambos canales, con opciones 4/8/16/32/64 en móvil y 12/24/48/96 en escritorio. En público se comprobó persistencia tras recargar, orden, contador, búsqueda con filtro activo y ausencia de doble paginador. El servidor auxiliar sirvió el HTML público compilado. El clic público apuntó a `/producto/…` y encontró la barrera activa. La ficha compartida se probó desde la ruta privada con administrador simulado.

A 390 y 1440 px se cambió el idioma en el catálogo y se verificó su persistencia al abrir la ficha, recargar y acceder directamente. También se comprobó la galería, relacionados, acciones localizadas, enlace canónico y referencia `QA2026`. La variante simulada conservó $475 MXN y el tope de dos unidades. Se comprobó agregar, disminuir y eliminar. Se verificaron seis tarjetas de servicio, foto configurada de Clases y apertura de su formulario. El QA no envió solicitudes de reserva ni pedidos.

### Pendientes y estado operativo

- **P2 Clases.** Se conserva el flujo y su DOM de reserva. El CTA configurable puede apuntar fuera del formulario y desviar el registro. Sigue pendiente acordar qué acción puede sustituir ese CTA y qué elementos dependen de la visibilidad. La foto y el orden siguen administrables mediante la configuración existente.
- **P0 operativo, separado del QA funcional.** GitHub reportó `protected=false` para `main` en `44e3f10bc8cf32d0b468ea6f406d4b4171a79d4b`. Las reglas de `main` quedan fuera del lote. No hubo PR, merge ni escritura a esa rama.
- **Vercel y Supabase.** La verificación previa de Vercel devolvió cero despliegues en la candidata. `git.deploymentEnabled=false` está presente en el SHA remoto inicial y en el árbol validado, y `UNDER_CONSTRUCTION=true` sigue activo. QA exclusivamente local con fixtures. Sin cambios de Supabase, POS, inventario, impresión, recepción o pagos.

## 15. P2 Clases y protección de main — corrección quirúrgica en candidata (17-nov-2026)

**Alcance autorizado:** limitar cambios a la administración de Clases, visibilidad DB y contratos. No hay autorización de merge, PR ni release. Línea base: candidata remota `83f465f433b2add0994abcccb82724f2fa5bf14a`. Todo el código de Lote 3B previo, incluidos precio, carrito, variantes y fichas, permanece fuera del diff funcional de este ajuste.

### Corrección del servicio Clases — solo candidata
- `src/components/admin/services-admin.tsx`: habilita **fotografía (opcional en cada guardado), índice de aparición e indicador visible/oculto** en el registro `classes`. El formulario administrativo continúa **sin campos editables de título/eyebrow/descripción/lista/CTA/notas/WhatsApp** para Clases. El guardado `classes` modifica exclusivamente `sort_order`, `is_active` y, si se carga foto, `image_url`; los demás campos DB y flujo comercial no se cambian.
- `public/updown-parity-runtime.js`: la carga de `storefront_services` solo consulta servicios activos y ordenados. Ahora retira del DOM incluso la tarjeta `classes` si no figura activa, **sin reemplazar ni recrear** su nodo original de formulario y sus escuchas de registro/instructores. Se oculta el enlace Clases del encabezado desktop cuando su servicio está inactivo; el menú móvil nativo se alimenta de `__UPDOWN_SERVICES__` activos.
- **Regla protegida:** el formulario `udsClassLeadForm`, consentimiento, guardado del prospecto, registro con instructor y botones de ese flujo NO se modifican. La tarjeta `classes` no consume el `cta_url` genérico de la tabla: un enlace arbitrario del administrador no puede desviar el registro. La edición editorial profunda del servicio y cualquier CTA alternativo quedan FUERA DE ALCANCE hasta decisión comercial separada.
- `tests/premium-white-contracts.cjs`: añadidos **3 contratos** que fijan los permisos de Clases, el filtro de visibilidad y la continuidad del formulario. Total esperado de las tres suites Lote 2A/2B/2C: **34 pruebas regulares + 1 TODO** (antes 31 + 1 TODO).

### Auditoría realizada aquí
- Los 3 contratos nuevos se ejecutaron en **harness JS V8 contra archivos realmente leídos desde GitHub**: **3 PASS / 0 FAIL**.
- `public/updown-parity-runtime.js` pasó análisis de sintaxis JS con `new Function`. Esto NO es `node --test`, `tsc`, `next build` ni E2E.
- **P2 funcional:** requiere fixture E2E en Work de Clases activo/inactivo, orden, foto, encabezado y menú móvil, formulario de registro y persistencia de los demás servicios. No marcar GO hasta estas pruebas.

### Seguridad de rama principal — BLOQUEO DE RELEASE
- Lectura GitHub actual: `main` en `44e3f10bc8cf32d0b468ea6f406d4b4171a79d4b`; `protected=false`, rulesets `[]`. La lectura del detalle de protección devolvió HTTP 403, integración sin permiso administrativo. **NO se ha activado protección**; este conector no expone acciones para cambiarla.
- Configuración recomendada por administrador de GitHub ANTES de cualquier PR/merge: `Settings → Branches → Add classic branch protection rule` para `main`; exigir PR, impedir force push y borrado, limitar bypass; exigir revisión/aprobación solo si existe revisor adicional disponible, y requerir checks una vez que estén establecidos en CI. Verificar luego que GitHub reporte `protected=true`. Si no hay revisor adicional, no establecer un requisito que paralice el único mantenedor; optar por PR obligatorio y controles automáticos disponibles.
- **No quitar** el `vercel.json` de la candidata ni desactivar `UNDER_CONSTRUCTION=true`. Nunca mezclar este `vercel.json` temporal con `main`. La configuración de auto-deploy y el plan de release son decisiones separadas.

**Siguiente fase:** Work debe ejecutar las tres suites formales y Chromium aislado con datos simulados para `classes` activo/inactivo, admin de foto/índice/visibilidad, reserva, menú responsive y seis servicios. Revalidar `main` y 0 deploys. La protección de `main` debe quedar confirmada por el administrador antes de integrar cualquier rama. **Estado: implementación estática lista para QA; NO-GO de publicación.**

## 16. QA de Clases en Work (17-nov-2026)

**Resultado: NO-GO de lanzamiento.** El registro y los controles de Clases funcionan en el fixture. El seguimiento del primer clic de instructor queda abierto. SHA de código probado: `ad06a1c5cdf5fcd942d7a2a1a7a1bbe0ef6d4e79`. El cierre solo modifica este documento.

| Prueba | Resultado |
| --- | --- |
| `npm ci` | PASS |
| `node --test tests/integration-lot2a-style.cjs tests/premium-white-contracts.cjs tests/integration-lot2c-shared-skin.cjs` | 34 PASS, 0 FAIL y 1 TODO existente |
| `npx tsc --noEmit`, `npm run lint`, `npm run build` | PASS. ESLint: 0 errores, 9 advertencias |
| Chromium, matriz completa aislada | 38 PASS, 2 FAIL, 0 excepciones. Matriz comercial a 320, 390, 760, 1024 y 1440 px. Clases en ambos canales a 390 y 1440 px |
| Chromium, repetición enfocada de Galería/Lista privada a 1440 px | 4/4 PASS tras completar la carga de servicios, más 2 comprobaciones de barreras PASS |

- **PASS · Clases activo, inactivo y reactivado.** En público y privado el acceso desktop y el menú móvil nativo respetaron la visibilidad. Los otros cinco servicios siguieron visibles. En el admin el guardado sin foto envió solo orden y visibilidad. Reactivar con una foto simulada envió esos dos campos y la URL de foto. Tras recargar, la tarjeta mostró la foto de reemplazo y pasó a la primera posición.
- **PASS · Formulario y consentimiento.** Chromium comparó la identidad del formulario capturado antes de cargar la configuración con el nodo visible después de cargarla. Inactivo, el nodo original quedó desconectado. El CTA externo simulado en la fila de Clases no apareció ni sustituyó el formulario. Sin consentimiento no hubo solicitud. Al autorizar, se creó un único registro de fixture con la referencia de vendedor y se mostraron los instructores. El instructor inactivo no ofreció enlace. La recarga restauró el contexto y permitió registrar interés sin crear otro lead.
- **FAIL · Primer clic de instructor en la misma sesión.** Tras una inscripción nueva, la tarjeta de instructor mostraba un enlace con el nombre del alumno, pero el clic no llamó a `record_golf_instructor_interest` (0 solicitudes frente a 1 esperada). Después de recargar sí llamó al RPC simulado. `mcUpdateInstructorLinks()` captura el acceso al instalar los listeners, antes de que exista el lead. Su implementación coincide con la de `83f465f`. El clic externo se interceptó y no abrió WhatsApp.
- **FAIL intermitente · Galería/Lista privada a 1440 px.** En una de las matrices completas, el primer clic de Lista dejó la galería activa. Pasó en la primera matriz aislada y en cuatro repeticiones con la carga de servicios terminada. Queda sin causa confirmada. El resto de la regresión revalidó búsqueda, filtros, paginación, ES/EN, fotos, variantes, precio, límite de stock, carrito y enlace con referencia.
- **Aislamiento.** La primera ejecución intentó cargar una imagen estática externa mediante el optimizador de Next y agotó el tiempo de espera. La revisión automática rechazó consultar esa ejecución. Los resultados reportados provienen de una repetición con el optimizador interceptado en Chromium y conexiones HTTP y sockets de Next restringidos a loopback. Los registros, consentimientos, imágenes y eventos usados como evidencia pertenecen exclusivamente al fixture.
- **Guarda operativa.** `UNDER_CONSTRUCTION=true` y `git.deploymentEnabled=false` verificados. La ruta pública real en la prueba conservó «Próximamente». Vercel devolvió 0 despliegues para la candidata. `main` sigue en `44e3f10bc8cf32d0b468ea6f406d4b4171a79d4b` con `protected=false`. Sin cambios en Supabase, POS, main, sin PR ni merge.

## 17. Cierre focalizado de dos FAIL — clases-isolated.log (17-nov-2026)

**Evidencia de entrada:** registro Chromium local `clases-isolated.log` entregado por administrador. Matriz Work reportó **38 PASS / 2 FAIL / 0 PAGE ERRORS**. El Lote 3B anterior permanecía validado y los cambios de Clases P2 conservaron foto, orden, visibilidad y formulario. Ambos fallos son independientes:

1. **P1: primer clic de instructor inmediatamente después de registrar nuevo alumno.** En el fixture no se llamó al RPC `record_golf_instructor_interest` (esperado 1, real 0); después de recargar sí registraba. Se confirmó en código que `mcUpdateInstructorLinks()` capturaba el acceso a la instalación del `onclick`, antes de que existiera el primer lead.
2. **P2 intermitente: Galería/Lista privada a 1440px.** Un primer clic quedó en `uds-preview-gallery` cuando el test esperaba `uds-preview-list`. El informe de Work registra repetición enfocada 4/4 PASS tras cargar servicios, sin causa reproducible confirmada. **No se modificó la paginación, DOM ni filtros para evitar cambios especulativos.** Work debe instrumentar estado de readiness y el control `#udsPreviewViewList` y volver a reproducir con arranques fríos aislados.

### Corrección quirúrgica aplicada aquí — candidata exclusivamente
- **`public/updown-parity-runtime.js`**, commit `17946d94b8c6b9dc9347bf1d219c78e9fea1bac9`: se reemplaza el listener estático asociado a tarjetas ya existentes por **un solo listener delegado sobre el nodo canónico `#udsTeachers`**. Este lee `udsGolfLessonLeadId` y `udsGolfLessonLeadToken` en el instante del clic. Maneja instructores renderizados asincrónicamente sin capturar acceso nulo. El render administrado `mcUpdateInstructorLinks()` sigue configurando únicamente URLs de WhatsApp; se retiró `link.onclick` que capturaba un acceso obsoleto y podía duplicar registros. El segundo alumno de la misma sesión se atribuye al lead activo sin modificar el propietario persistente del dispositivo.
- **`tests/premium-white-contracts.cjs`**, commit `43f564686f8df9900a96aba99c327a9c2188695b`: 2 contratos adicionales, uno de **comportamiento ejecutable** que extrae y simula el listener real, verificando cero registros sin lead, uno tras primera inscripción, uno por segundo alumno y ninguno sin identificador de instructor; otro que garantiza que el render administrado no instala un `onclick` obsoleto. **2 PASS / 0 FAIL** en un harness V8 de archivos reales de GitHub, **no** `node --test` ni navegador real. La sintaxis general del runtime JS también fue verificada al actualizarlo.
- **Total esperado en Work:** 36 contratos regulares y un TODO (antes 34 + 1 TODO). Sin modificación de esquema, datos de Supabase, POS, precio, venta, carrito, rutas o pagos.

### QA restante — asignado a Work, no a este entorno
1. `node --test tests/integration-lot2a-style.cjs tests/premium-white-contracts.cjs tests/integration-lot2c-shared-skin.cjs`: 36 PASS + 1 TODO esperado; `npx tsc --noEmit`, `npm run lint`, `npm run build`.
2. Con backend mock y Chromium aislado, repetir **primer alumno → consentimiento → alta exitosa → clic inmediato en instructor activo → RPC exactamente una vez**; también segundo alumno sin recarga → segundo RPC con su propia identificación, y recarga → restaurar propietario original y registrar clic sin duplicar alta. Interceptar WhatsApp y conservar formulario original.
3. Repetir Galería/Lista privada a 1440px en arranque frío, sin asumir éxito por un reintento. Esperar controles montados + carga de catálogo completa; instrumentar target, `aria-pressed`, `#udsGrid.className` y carga/rehidratación si reaparece. No cambiar runtime de paginación sin causa reproducida. Verificar Galería/Lista pública sin regresión.
4. Mantener **cero deploys en Vercel**, `git.deploymentEnabled=false`, `UNDER_CONSTRUCTION=true`, `main` sin cambios y Supabase fixture-only. Entregar resultado GO/NO-GO antes de considerar release.

**Barrera independiente:** `main` sigue sin protección nativa (GitHub `protected=false`), requiere habilitación administrativa, no autorizada aquí. **NO-GO de producción** hasta corregir/validar el primer clic, resolver la intermitencia y proteger/revisar el release gate.

## 18. Lote 3C — Validación final de regresiones

**GO funcional en fixtures.** El primer clic de instructor queda validado. Galería/Lista a 1440 px no reprodujo la intermitencia en 12 arranques fríos y sigue como observación abierta, sin causa confirmada. El SHA inicial y final de código probado es `882975d0988f493042a52b7f525f65ac5272c02f`. El commit de cierre añade únicamente esta sección.

| Verificación ejecutada | Resultado |
| --- | --- |
| `npm ci` | PASS, 405 paquetes |
| `node --test tests/integration-lot2a-style.cjs tests/premium-white-contracts.cjs tests/integration-lot2c-shared-skin.cjs` | 36 PASS, 0 FAIL, 1 TODO preexistente |
| `npm run check:admin-scripts` | PASS, 10 scripts |
| `npx tsc --noEmit`, `npm run lint`, `npm run build` | PASS. ESLint: 0 errores y 9 advertencias. Next.js 16.3.3 |
| Chromium, matriz completa | 52 PASS, 1 fallo de lectura del fixture, 0 excepciones de página |
| Chromium, repetición focalizada de foto/reactivación | 5 PASS, 0 FAIL, 0 excepciones de página |

- **P1 instructor.** Cuatro flujos completos en Chromium: privada ES a 1440 px, privada EN a 390 px, pública ES a 390 px y pública EN a 1440 px. Cada flujo exigió consentimiento. El clic inmediatamente después de la primera alta, sin recarga, produjo exactamente un RPC con ID, token y slug del primer alumno e instructor. El segundo alumno obtuvo un ID y un token distintos, y su clic se atribuyó exclusivamente a ese segundo alumno. La recarga restauró el propietario original del dispositivo y produjo un tercer evento con las credenciales del primer alumno, sin generar otra alta. Resultado agregado: ocho altas y doce registros de interés simulados, sin duplicados. El instructor inactivo no mostró enlace y se canceló la navegación de WhatsApp.
- **P2 Galería/Lista a 1440 px.** Doce arrancadas sin preferencias: cuatro con catálogo antes de servicios, cuatro con servicios prioritarios y cuatro con espera explícita de servicios. En ocho se hizo clic en Lista en cuanto apareció el control. En dos de esos clics el catálogo todavía reportó `loading`. Los doce clics llegaron a `udsPreviewViewList` y activaron Lista. En cada ronda hubo tres alternancias Galería/Lista y recarga con persistencia. Dos rondas comprobaron además página 2, búsqueda que retorna a página 1 y filtro de marca. La matriz general comprobó el catálogo público y privado de 320 a 1440 px. Queda pendiente observar si vuelve a ocurrir en condiciones distintas.
- **Clases y regresión comercial.** Foto, orden, visibilidad, ocultación/reactivación, nodo original del formulario, consentimiento y los otros cinco servicios comprobados en ambos canales a 390 y 1440 px. La primera lectura de evidencia de foto en `/__events` devolvió `ECONNRESET` tras guardar. La repetición focalizada comprobó la carga simulada, el PATCH limitado a los tres campos y la foto y orden visibles en ambos canales. El resto de la matriz validó filtros, búsqueda, paginación, fichas ES/EN, referencia, precio por variante y carrito con tope de stock.
- **Alcance y barreras.** Sin commits correctivos nuevos: se validaron `17946d94` y `43f56468`, que ya estaban en el SHA inicial. Build y servidor Next restringidos a sockets HTTP en loopback, imágenes interceptadas en Chromium y fixtures separados para registros, admin y catálogo. Sin operaciones en Supabase real ni cambios en POS, inventarios o pagos. `UNDER_CONSTRUCTION=true` y `git.deploymentEnabled=false` comprobados. Vercel reportó 0 despliegues de la candidata. `main` sigue en `44e3f10bc8cf32d0b468ea6f406d4b4171a79d4b` con `protected=false`. La protección de `main` sigue siendo un riesgo de lanzamiento independiente.

## 19. Lote 6 · Preintegración quirúrgica y manifiesto de release (18-nov-2026)

**Estado: PREAUDITORÍA COMPLETA, NO-GO para merge/PR/despliegue.** Documento detallado: [LOTE6-PREINTEGRACION-20261118.md](./LOTE6-PREINTEGRACION-20261118.md). La candidata validada por Work en 3C estaba en `b588a4ce404baae26851cf659477e9ecd826175e`, con `main` en `44e3f10bc8cf32d0b468ea6f406d4b4171a79d4b`, 55 commits adelante, 0 detrás y **28 archivos de diff**.

- **Selección exacta:** 21 archivos de aplicación/arte y 3 suites de pruebas candidatos para transferencia selectiva; excluir 3 documentos históricos y el `vercel.json` de candidata. No mover este informe nuevo a producción.
- **Hallazgo puntual corregido aquí en candidata:** en `src/components/admin/services-admin.tsx` el resumen de servicio tenía caracteres de template JSX renderizados literalmente: `<span>\`\${...}\`</span>`. Se sustituyó por interpolación real `<span>{\`\${...}\`}</span>`. Commit `75d57ed3b354d8dbaf313a30e190c9240ff7e28a`.
- **Contrato de prevención añadido:** `tests/premium-white-contracts.cjs` ahora comprueba que el resumen del admin es una interpolación JSX y no texto literal. Commit `58773a1109d3c83a1ed83bbfa0b6e79fa776d046`. El contrato aislado ejecutado con el código real de GitHub pasó 1/1; la suite completa **37 PASS + 1 TODO** queda pendiente de Work después de este cambio. El resultado 3C (**36 PASS + 1 TODO**) corresponde al SHA anterior.
- **Riesgo de release crítico:** las suites `integration-lot2a-style.cjs` y `integration-lot2c-shared-skin.cjs` verifican la presencia de `vercel.json` temporal. Al preparar el checkout **local, sin push** de release, deberán adaptarse para comprobar la **ausencia** de esa salvaguarda en la rama propuesta sin perder los tests de `UNDER_CONSTRUCTION=true`. Nunca retirar `vercel.json` de esta candidata antes de una estrategia explícita.
- **Seguridad comprobada:** `src/proxy.ts` idéntico en main y candidata; bloqueo `UNDER_CONSTRUCTION=true`; `main` sin protección (`protected=false`, rulesets vacíos); cero despliegues Vercel de la candidata al iniciar la auditoría. No hubo mutaciones de Supabase, POS, inventario, pagos ni checkout.
- **Siguiente gate:** QA focalizado de la interpolación administrativa en Work; habilitar protección de `main` por administrador; acordar política de despliegues de release. **No abrir PR, fusionar o publicar sin nueva autorización separada.**

## 20. QA focalizado posterior a preintegración (18-nov-2026)

**PASS del ajuste JSX en Servicios.** SHA de código probado: `a19c67f11c9b7d1b839e3b9a981a25f316129eef`. El commit de cierre solo documenta el resultado.

- **Contratos:** 37 PASS, 0 FAIL y 1 TODO preexistente en las tres suites. `npx tsc --noEmit`, `npm run lint` y `npm run build` pasaron. ESLint reportó 0 errores y 9 advertencias.
- **Chromium con fixtures:** 4 PASS, 0 FAIL y 0 excepciones de página. Las siete filas simuladas mostraron Visible/Oculto e Índice, y únicamente Clases mostró Registro protegido. Se comprobó que otros servicios conservaran sus campos editoriales.
- **Controles de Clases:** el formulario siguió limitado a foto, índice y visibilidad. El guardado sin foto ocultó Clases y actualizó el índice a 9, sin enviar un campo de imagen. La reactivación cargó una imagen simulada y cambió el índice a 1. El rótulo cambió al guardar y la recarga conservó imagen, orden y visibilidad, con los campos protegidos ausentes.
- **Alcance:** QA exclusivo del panel administrativo con backend simulado en loopback. Sin regresiones detectadas en ese alcance. Las barreras de la candidata siguen vigentes. Sin PR, merge, despliegue ni modificaciones de main, Supabase real, POS, pagos o Próximamente. El dictamen de release de la sección 19 sigue vigente.

## 21. Lote 7 — ensamblaje local de release sin push (18-nov-2026)

**Hito:** preparada herramienta local en `scripts/prepare-release-local.py`; instrucciones en [LOTE7-RELEASE-LOCAL-20261118.md](./LOTE7-RELEASE-LOCAL-20261118.md). **Aún NO se ha ejecutado sobre un checkout real de producción.**

- SHA de código fuente congelado: `f59ca078cee500cdfe0550bbf3a6a22c9586e7a3`; SHA base `main`: `44e3f10bc8cf32d0b468ea6f406d4b4171a79d4b`.
- El ensamblador crea un worktree detached únicamente local desde `main` y transfiere **21 archivos de aplicación y 3 suites**. No copia `vercel.json`, expedientes de candidata ni los propios scripts de preparación. Verifica `UNDER_CONSTRUCTION=true`, los SHA, la ausencia de cambios posteriores de código, la identidad de `origin` y que el diff sea exactamente las 24 rutas seleccionadas.
- Adaptaciones locales de pruebas Lote 2A/2C: reemplazan el requisito de `git.deploymentEnabled=false` **exclusivo de la candidata** por la ausencia del `vercel.json` temporal, conservando la aserción de «Próximamente».
- Se probó el ensamblador en un repositorio Git sintético de prueba con remote bare local: worktree 24/24 rutas esperadas, exclusión de `vercel.json`, gate intacto y 2/2 contratos adaptados PASS. La utilidad pasó `python3 -m py_compile`. Estos resultados **no sustituyen** el QA/compilación del checkout real en Work.
- No hubo push, PR, merge, release branch remota, despliegues intencionales ni alteración de Supabase/POS/checkout. **Siguiente actor: Work**, ejecución del ensamblador en checkout real limpio, pruebas formales y Chromium con fixtures; entregar resultado local sin push.
- Para avanzar a deploy técnico, aún se requiere protección nativa de `main`, política Vercel de PRs/ramas y autorización explícita de integración. La apertura pública requiere autorización posterior independiente y pruebas controladas de cobro.

**Dictamen:** GO para ensamblaje local aislado en Work; NO-GO para push/PR/merge/deploy.

## 22. Lote 7 — QA de release local ensamblado (18-nov-2026)

**Estado: ENSAMBLAJE Y BUILD PASS; QA BROWSER 53 PASS / 1 FAIL; NO-GO para PR, merge o deploy.** Evidencia en archivos aportados por el administrador: `lote7-assembly.log`, `lote7-diff-exacto(1).txt`, `lote7-release.diff`, `lote7-contracts.log`, `lote7-admin.log`, `lote7-tsc.log`, `lote7-lint.log`, `lote7-build.log`, `lote7-browser.log`, `lote7-seo.log` y `lote7-ci.log`. Los archivos adjuntos **no se han importado al repositorio público** (pueden contener rutas y registros internos).

- **Release local real de Work:** worktree temporal detached `/tmp/upndown-release-local-0alnher5`, base `main` `44e3f10bc8cf32d0b468ea6f406d4b4171a79d4b`, código congelado de candidata `f59ca078cee500cdfe0550bbf3a6a22c9586e7a3`. Diff exacto: 21 archivos de aplicación y 3 suites adaptadas; sin `vercel.json` temporal. `npm ci`: 405 paquetes instalados.
- **Contratos y build:** 37 PASS, 0 FAIL, 1 TODO preexistente; 10 scripts administrativos con sintaxis OK; `tsc --noEmit` PASS según salida; lint sin errores y 9 advertencias; `next build` PASS, 19 páginas estáticas, rutas dinámicas y proxy compilados. SEO: 2 comprobaciones PASS.
- **Chromium en fixtures:** 53 registros PASS, 1 FAIL, 0 `PAGE ERRORS`. Responsive 320, 390, 760 y 1024 PASS; 1440 skin y ES/EN PASS, pero **la prueba privada `1440 list, gallery, page size and second page` FALLÓ**: tras intentar Lista, `#udsGrid` conservó `uds-grid uds-preview-gallery` en vez de `uds-preview-list` durante 5 s. Catálogo público 320–1440 PASS; filtros, ficha de variantes, carrito y stock, servicios y Clases (incluido primer clic y segundo alumno en canales privado/público) PASS.
- **Prueba adicional:** 12/12 arranques fríos a 1440 PASS (`catalog-first`, `services-first`, `settled`); la intermitencia **vuelve a reproducirse únicamente en la matriz completa**. Los 12 casos PASS no anulan el FAIL de la matriz. NO clasificar este comportamiento como corregido.
- **Hipótesis técnica, NO demostrada:** `StorefrontParity` reinicia `updown-parity-runtime.js` cuando cambia `deviceMode`; `installPreviewCatalogControls()` crea botones y registra callbacks directamente y retorna si `#udsPreviewCatalogTools` ya existe. Podría perderse la atribución del evento en una reinicialización/race de DOM o producirse un clic antes de readiness. Falta instrumentar en Chromium el **mismo recorrido de pruebas acumuladas** y distinguir evento no recibido, nodo reemplazado, callback perdido o re-render a Galería posterior.
- **Seguimiento obligatorio antes de PR:** reproducir transición de viewport móvil → escritorio con la matriz y estados de servicios, registrar `isConnected`, identidad de nodo, contador de cargas del script, evento click capturado, `aria-pressed`, `localStorage`, URL y `#udsGrid.className` antes e inmediatamente después. Realizar **únicamente** una corrección mínima si hay causa verificable; luego repetir contratos, tsc, lint, build y la prueba focalizada de transición+catálogo público/privado. Si Work concluye que es un bug del *test* (por espera insuficiente), aportar evidencia del evento y de la inicialización antes de modificar el código.
- **Barreras reconfirmadas en GitHub/Vercel:** al registrar: `main` `44e3f10...` sin cambios y `protected=false`, candidata `e07a65b...` con `UNDER_CONSTRUCTION=true`, `git.deploymentEnabled=false` y **0 despliegues de candidata**. El worktree no se subió ni desplegó. No hubo cambios en POS, Supabase real, inventarios ni pagos.

**Dictamen:** GO para QA quirúrgico de la única incidencia; NO-GO para crear PR o despliegue, hasta cerrar la intermitencia y la protección de `main`. La apertura comercial pública sigue sujeta a una autorización independiente.

## 23. Lote 7B — Corrección quirúrgica del ciclo de vida Galería/Lista (18-nov-2026)

**Estado: PARCHE EN CANDIDATA, QA E2E POST-PARCHE PENDIENTE.** Este registro no declara resuelto el fallo en Chromium hasta comprobar la matriz completa. Continuidad del Lote 7: sección 22 y [LOTE7-RELEASE-LOCAL-20261118.md](./LOTE7-RELEASE-LOCAL-20261118.md), sección 4.

- **Diagnóstico de Work recuperado:** al cambiar viewport 760 → 1024 → 1440 sin recargar, una ejecución anterior de `updown-parity-runtime.js` continuó conectada a `updown:copy-ready`. Sus callbacks de render/instalación de controles podían tocar el DOM de una nueva ejecución, enlazar botones con estado obsoleto, y causar que el clic Lista quedara anulado por el estado Galería. La investigación reportó 2/5 reproducciones iniciales y 4/4 al instrumentar la pila; los arranques fríos 1440 pasaron. **La evidencia detallada de Work no se importó a este repositorio; debe conservarse como artefacto de QA.**
- **Parche específico:** `public/updown-parity-runtime.js`, commit `810c38508a0846e04a8933276fbe795c18894613`. Se introdujo `parityLifetime` vinculado a la raíz conectada, se invalida al evento `updown:storefront-dispose`, y `renderProducts()` no muta el catálogo cuando su instancia no es actual. `installPreviewCatalogControls()` identifica el propietario de toolbar/pager y reemplaza los controles obsoletos en lugar de reutilizar sus listeners. Se retiran el listener de traducciones `copy-ready` y el media-query `change` de la instancia desmontada.
- **Contratos nuevos:** `tests/premium-white-contracts.cjs`, commit `7bae91bddfd19b705919db83c6d4ac71f0740543`. Dos pruebas: invalidación de instancia tras remontaje, desconexión de raíz y dispose; ownership de controles, guard de render y limpieza de listeners. **2/2 PASS** al ejecutarlas aisladamente con el código recuperado de GitHub en un harness JS V8. La suite completa esperada pasa de 37 a **39 PASS + 1 TODO**, todavía NO comprobada mediante Node en checkout real.
- **Ensamblaje local actualizado:** `scripts/prepare-release-local.py` fija `SOURCE_SHA=7bae91bddfd19b705919db83c6d4ac71f0740543`, `MAIN_SHA=44e3f10bc8cf32d0b468ea6f406d4b4171a79d4b`. Work debe crear worktree nuevo y verificar de nuevo las 24 rutas exactas; no reutilizar el viejo release que contenía el runtime defectuoso.
- **Gate siguiente:** QA de Work en nuevo checkout, `npm ci`, 39 contratos + TODO, admin scripts, `tsc`, lint, build y Chromium en **transición 760 → 1024 → 1440 con respuesta pendiente y matriz acumulada**, más Galería/Lista a 1440 fría, catálogo público, Clases y carrito. Registrar eventos, clase, preferencia, URL y listener owner; no sustituir la matriz por arranques fríos.
- **Seguridad:** prohibido fusionar a `main`, crear PR, desplegar, alterar POS, Supabase real, pagos, inventarios o `UNDER_CONSTRUCTION=true` en esta fase. `vercel.json` temporal permanece exclusivamente en la candidata. **Protección de main sigue pendiente**, igual que controles Vercel para una futura rama de release.

**Dictamen:** GO para validación focalizada del parche y de release local; NO-GO para PR/merge/despliegue hasta cierre Chromium y protección de `main`.
