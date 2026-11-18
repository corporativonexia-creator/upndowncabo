# UP AND DOWN Cabo · INTEGRACION-INVENTARIO-LOTE1

**Revisión:** 17-nov-2026, GitHub `main` vs `offline-premium-white-20261114`.
**Base `main`:** `44e3f10bc8cf32d0b468ea6f406d4b4171a79d4b`.
**Fuente Premium White:** `19b44e25070f5da875a47008bc438c4e766087f9`.
**Diferencia:** 89 commits adelante / 1 atrás / 23 archivos diferentes.
**Decisión:** inventario de Lote 1. **Nada de este listado se ha copiado todavía a la candidata**. Las clasificaciones son indicaciones para Lote 2, no autorización de publicación.

## A. Archivos técnicos que SÍ conviene incorporar selectivamente (16)

| # | Archivo fuente | Decisión de Lote 2 | Condición / riesgo |
|---|---|---|---|
| 1 | `public/assets/updown-product-placeholder.svg` | **Importar** | Preservar imagen canónica actual del usuario, completa y sin recortar; priorizar fotografías reales. |
| 2 | `public/updown-parity-runtime.js` | **Revisar diff, integrar por funciones** | Maneja catálogo, navegación, imágenes y servicios; no reemplazar un futuro runtime con código viejo ni afectar carrito, precios o checkout. |
| 3 | `public/updown-preview-services-stage7.js` | **Importar/reducir** | Stage 7 solo debe cambiar presentación, nunca título/servicio/CTA de Supabase; decidir si aún es necesario tras consolidar UI. |
| 4 | `src/app/globals.css` | **Integrar fragmento mínimo** | Estilo del fallback canónico en pública y preview; evitar arrastrar otros overrides no relacionados. |
| 5 | `src/app/producto/[productKey]/page.tsx` | **Importar cambios puntuales** | Publicar diseño Premium White de ficha independiente sin quitar metadatos OG/Twitter/JSON-LD ni imponer acceso admin. Mantener barrera general. |
| 6 | `src/app/vista-previa/page.tsx` | **Integrar preview** | Mantener `requireRole("admin")`; preview no sustituye todavía la ruta pública. |
| 7 | `src/app/vista-previa/premium-white.css` | **Integrar y modularizar** | CSS muy extenso (~1.088 líneas), principalmente acotado a `.uds-preview`; diseñar extensión explícita a storefront público, evitando duplicación. |
| 8 | `src/app/vista-previa/preview-desktop-search-focus.tsx` | **Integrar** | Manejo del filtro sticky y compensación de altura; comprobar observers/listeners y desplazamiento en desktop. |
| 9 | `src/app/vista-previa/preview-filter-auto-collapse.tsx` | **Integrar** | Cierre automático móvil sin interferir con filtros, foco ni handlers de navegación. |
| 10 | `src/app/vista-previa/preview-local-product-navigation.tsx` | **Integrar solo a preview** | Evita ir al dominio remoto al abrir productos relacionados/variantes; no reescribir enlaces para compartir públicamente. |
| 11 | `src/app/vista-previa/producto/[productKey]/page.tsx` | **Integrar** | Proteger con admin y compartir hoja de estilo con ficha pública. |
| 12 | `src/components/store/premium-product-detail.css` | **Importar** | Hoja compartida entre ficha privada y pública. Sin colisiones con CSS global. |
| 13 | `src/components/store/product-detail.tsx` | **Integrar cambio puntual** | Enlace público canónico con referencia vendedor; preservar carrito/variante/fotos/precio. |
| 14 | `src/components/store/responsive/store-search.tsx` | **Integrar cambio puntual** | Usa placeholder de producto y no el de categorías; conservar búsqueda en tiempo real. |
| 15 | `src/components/store/storefront-parity.tsx` | **Revisar diff, integrar por funciones** | Cache-busting y scripts de servicios, sin regresiones de DOM ni comportamiento público/preview. |
| 16 | `tests/premium-white-contracts.cjs` | **Importar y actualizar tests** | 18 pruebas de contrato definidas y una TODO E2E; no son prueba de build/compra real. Revalidar en nueva arquitectura. |

**Importante:** `src/app/page.tsx` no figura entre los 23 archivos cambiados; la página pública usa `<StorefrontParity />`. El diseño blanco solo del modo preview no se activará en pública por copiar CSS. Debe desarrollarse una vía compartida de estilos y componentes en Lote 2. No abrir la tienda todavía.

## B. Archivos que NO deben pasar tal cual a la candidata (7)

| # | Archivo de la rama experimental | Decisión | Motivo |
|---|---|---|---|
| 17 | `design/PREMIUM_WHITE_AUDITORIA_REGRESION_20261115.md` | **No importar** | Resumir resultados pertinentes en el registro maestro; contiene estados ya superados. |
| 18 | `design/README-PREMIUM-WHITE-LOCAL.md` | **No importar completo** | Changelog de vista previa, antiguo y muy extenso; extraer solo decisiones vigentes sin duplicar este registro. |
| 19 | `design/SERVICES_UNIFICATION_RESULT_20261116.md` | **No importar** | Informe histórico de DML aplicado; mantener fuera de la candidata pública. |
| 20 | `design/UPNDOWN_PREMIUM_WHITE_LOCAL.html` | **Excluir** | Demostración HTML separada, no runtime real de la tienda. |
| 21 | `design/backups/storefront_services_20261116_pre_unification.json` | **PROHIBIDO importar** | Respaldo de datos ya modificados; repositorio actualmente público. Tratar exposición histórica en revisión de privacidad independiente. |
| 22 | `design/sql/STORE_SERVICES_SIX_UNIFICATION_20261116_ONE_TIME.sql` | **PROHIBIDO importar/ejecutar** | Script DML de ejecución única que ya modificó Supabase; ejecutarlo de nuevo puede fallar o duplicar operaciones. |
| 23 | `vercel.json` de Premium White | **PROHIBIDO importar** | Archivo de bypass de compilación con `ignoreCommand` experimental. Distinto de la barrera temporal de Vercel en la candidata; ningún `vercel.json` de desarrollo debe acabar en `main`. |

**Regla crítica:** el `vercel.json` EXISTENTE en esta rama de integración tiene `git.deploymentEnabled=false` y solo es un seguro antidespliegue. Se debe **excluir del eventual PR/merge** mediante un proceso autorizado y controlado, sin borrar la protección por adelantado mientras se hacen commits.

## C. Desarrollos recientes adicionales — para lotes posteriores separados

| Rama / SHA revisados | Diferencia frente a main | Módulo y selección preliminar | Gate |
|---|---|---|---|
| `fix/pos-reception-cut-code39-20261117` `623ab861...` | 13 adelante / 0 atrás; 6 archivos | Folio `SR-`, Code39, alimentación/corte, reconocimiento por escáner y PDF de recepción | Test POS + validación física de impresora/lector; PR separado. |
| `feat/inventory-category-print-totals-20261117` `dca4d5ef...` | 3 adelante / 0 atrás; 3 archivos | Subtotales impresos por categoría, valor a precio de venta, MXN/USD | Test de reportes, precios faltantes, sin mezclar monedas; PR separado. |
| `feature/captura-fotos-inventario` `72187bb7...` | 1 adelante / 0 atrás; 1 archivo | `public/updown-admin-legacy-runtime.js`, alta y galería de fotos | Auditar realmente si cubre escáner y diez imágenes; no asumir completitud. |
| `fix/sku-unique-admin-20261115` `1eeb6637...` | 1 adelante / 0 atrás; 1 archivo | Mismo archivo de runtime admin pero distinto commit; SKU/slug únicos | Consolidar cambios por función, sin reemplazo de archivo entero. |
| `perf/storefront-incremental-dom-20261114` `e657be3b...` | 6 adelante / 1 atrás; 6 archivos | Optimización de MutationObserver y E2E responsivo | Reusar tests si son aplicables; benchmark antes de integrar código. |

**Excluidas de merge automático:** `feat/storefront-premium-v2` y otras ramas antiguas divergentes. Cualquier mejora residual debe pasar por diff y prueba propia. No usar `merge --no-ff` de estas ramas en la candidata.

## D. Protección de main y dependencias

- El `main` actual contiene un commit funcional de POS que no existía en el origen de Premium White. **Nunca sustituir la base de `main` por el HEAD de la rama experimental.**
- Proyecto Vercel `upndowncabo` con despliegue automático por push de commits. **El primer commit de la candidata desactiva sus auto-deploys.**
- Política de servicios: seis registros vivos ya aprobados en Supabase; no ejecutar DML ni modificar Clases.
- Mantener `src/proxy.ts` con `UNDER_CONSTRUCTION = true`.
- Rutas públicas `/producto/[productKey]` deben ser compartibles cuando se autorice el lanzamiento, sin acceso administrativo, y conservar la referencia comercial.
- No importar datos internos en un repo actualmente público.

## E. Procedimiento quirúrgico para el próximo lote

1. Comparar nuevamente SHA de `main` y fuente. Si han cambiado, actualizar este inventario antes de integrar.
2. Incorporar los 16 archivos **por dependencias funcionales** (no por orden alfabético), sin sobrescribir runtime comercial completo cuando baste un parche.
3. Diseñar implementación pública de Premium White evitando duplicar todos los estilos de preview.
4. Preservar el fichero local de protección de Vercel y verificar **0 deployments** en cada etapa.
5. Ejecutar las pruebas posibles y registrar los límites reales; guardar conclusiones aquí y en `INTEGRACION-ESTADO.md`.
6. No empezar los PRs de POS/inventario hasta terminar al menos la candidata web.

## F. Avance efectivo del Lote 2A (17-nov-2026)

**Código visual integrado en candidata:** 7 de los 16 archivos fuente, sin importar en bloque la rama Premium White.

| Archivo | Estado al cierre de 2A |
|---|---|
| `public/assets/updown-product-placeholder.svg` | **Integrado**, asset canónico exacto, sin re-dibujar. |
| `src/app/globals.css` | **Integrado parcialmente**, únicamente +504 caracteres de CSS scoped al placeholder de producto. |
| `src/app/vista-previa/premium-white.css` | **Integrado**, hojas de estilo de portada y menú responsive privado, sin lógica JS. |
| `src/components/store/premium-product-detail.css` | **Integrado**, hoja compartida de ficha. |
| `src/app/vista-previa/page.tsx` | **Integrado parcialmente**, solo import CSS; helpers funcionales pendientes. |
| `src/app/producto/[productKey]/page.tsx` | **Integrado parcialmente**, solo wrapper y estilo; no se tocó SEO ni ficha. |
| `src/app/vista-previa/producto/[productKey]/page.tsx` | **Integrado parcialmente**, solo wrapper y estilo; helper de localhost pendiente. |

**Test nuevo en candidata:** `tests/integration-lot2a-style.cjs` — 6 contratos estáticos aprobados. Esta prueba verifica barrera de despliegue temporal y no debe trasladarse sin adaptar a `main`.

**Todavía pendientes:** `public/updown-parity-runtime.js`, `public/updown-preview-services-stage7.js`, `src/app/vista-previa/preview-desktop-search-focus.tsx`, `src/app/vista-previa/preview-filter-auto-collapse.tsx`, `src/app/vista-previa/preview-local-product-navigation.tsx`, `src/components/store/product-detail.tsx`, `src/components/store/responsive/store-search.tsx`, `src/components/store/storefront-parity.tsx`, `tests/premium-white-contracts.cjs`; los archivos de página importados parcialmente también requerirán los helpers funcionales en 2B.

Los siete archivos clasificados como **excluir** en la sección B siguen excluidos.

**Bloqueo importante:** el SVG verde ahora está listo, pero el runtime vigente de `main` aún no asigna esa imagen a tarjetas sin foto; **no declarar completa esa función hasta integrar y probar su wiring en 2B**. Asimismo, la portada pública Premium White es parte de 2C, NO de 2A.

**Control de cambios:** no se alteraron POS, inventario, datos Supabase ni `main`. `vercel.json` con bloqueo temporal permanece en la rama candidata. Para SHA de commits, resultados y límites de pruebas consultar `INTEGRACION-ESTADO.md`.
