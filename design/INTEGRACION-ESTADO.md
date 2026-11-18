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
