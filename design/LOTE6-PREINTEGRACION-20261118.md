# UP AND DOWN Cabo · Preintegración quirúrgica · Lote 6 (preparación)

**Fecha:** 18-nov-2026. **Estado:** PREAUDITORÍA completada, **NO-GO para PR/merge/despliegue**.  
**Repositorio:** `corporativonexia-creator/upndowncabo`.  
**Rama de análisis:** `integracion/premium-white-candidata-20261117`.  
**HEAD de QA de Work:** `b588a4ce404baae26851cf659477e9ecd826175e`.  
**HEAD con corrección visual administrativa posterior:** `58773a1109d3c83a1ed83bbfa0b6e79fa776d046` (requiere nueva comprobación con Work).  
**Base de `main`:** `44e3f10bc8cf32d0b468ea6f406d4b4171a79d4b`.  
**Comparación antes de la corrección administrativa:** 55 commits adelante, 0 detrás, 28 archivos distintos; corresponde a **21 archivos de aplicación, 3 suites de pruebas, 3 documentos y 1 salvaguarda temporal de despliegue**.

## 1. Dictamen de seguridad

- `src/proxy.ts` es **idéntico byte por byte** en las dos ramas; `const UNDER_CONSTRUCTION = true` sigue vigente.
- La candidata tiene `vercel.json` con `git.deploymentEnabled=false` y no presenta despliegues en la consulta Vercel. `main` no tiene ese archivo.
- GitHub reporta `main` con `protected=false`; consulta de reglas de repositorio devolvió `[]` y la API de protección específica devolvió HTTP 403 por permisos del conector. **Ninguna protección fue activada.**
- No se encontraron archivos de POS, inventario, recepción, pagos, Stripe, migraciones, .env, SQL ni respaldos entre los 28 archivos modificados. No significa que el checkout real esté validado; la cobertura del Lote 3C fue con fixtures.
- **PROHIBIDO** ejecutar `git merge`, `git push main`, crear PR, modificar Supabase, quitar la barrera pública o desplegar como parte de esta auditoría.

## 2. Manifiesto de transferencia selectiva

### 2.1. Aplicación y arte — 21 archivos `CANDIDATOS PARA INCLUIR`

| # | Archivo | Motivo / control posterior |
|---|---|---|
| 1 | `public/assets/updown-product-placeholder.svg` | Arte canónico para fichas sin fotografía; mantener hash y prioridad de imágenes reales |
| 2 | `public/updown-parity-runtime.js` | Catálogo, vista Lista/Galería, paginación, navegación, servicios, enlace canónico y atribución de Clases; cambio sensible: revisar regresión comercial |
| 3 | `public/updown-preview-services-stage7.js` | Presentación compartida únicamente; no reintroducir textos o CTAs codificados ni reemplazar DOM de Clases |
| 4 | `src/app/globals.css` | Únicamente fragmento de fallback de imagen; se preserva el CSS original de main |
| 5 | `src/app/page.tsx` | Presentación Premium White pública, sin previewMode y aún tras la barrera |
| 6 | `src/app/producto/[productKey]/page.tsx` | Ficha premium pública; conservar metadatos y JSON-LD |
| 7 | `src/app/vista-previa/page.tsx` | Foco, filtros y navegación privados; conservar requireRole('admin') |
| 8 | `src/app/vista-previa/premium-white.css` | CSS scope-gated para diseño canónico, responsive y tarjetas |
| 9 | `src/app/vista-previa/preview-desktop-search-focus.tsx` | Mediciones, observadores y foco escritorio con cleanup |
| 10 | `src/app/vista-previa/preview-filter-auto-collapse.tsx` | Autocierre móvil de filtros; no cambia datos ni handlers originales |
| 11 | `src/app/vista-previa/preview-header.css` | Encabezado y paginador adaptados para modo público/privado; mantener fix público |
| 12 | `src/app/vista-previa/preview-local-product-navigation.tsx` | Solo preview, conserva enlaces locales y canonical share URL |
| 13 | `src/app/vista-previa/producto/[productKey]/page.tsx` | Ficha privada protegida y estilo compartido |
| 14 | `src/components/admin/services-admin.tsx` | Clases: foto/orden/visibilidad sin liberar CTA o formulario. Incluye corrección visual de etiqueta administrativa pendiente de QA de Work |
| 15 | `src/components/store/premium-product-detail.css` | CSS de ficha acotado al wrapper |
| 16 | `src/components/store/product-detail.tsx` | Traducción ES/EN y compartir canónico; no variar precios/stock |
| 17 | `src/components/store/related-products-rail.tsx` | Carrusel relacionado ES/EN |
| 18 | `src/components/store/responsive/mobile-header.tsx` | Clase visual premium sin cambiar callbacks |
| 19 | `src/components/store/responsive/store-search.tsx` | Fallback de miniatura canónico |
| 20 | `src/components/store/storefront-parity.tsx` | Clase premium visual y script Stage7 compartido; respetar previewMode privado |
| 21 | `src/components/store/use-storefront-language.ts` | Persistencia bilingüe de ficha y relacionados |

**Reglas:** no copiar ramas antiguas en bloque; mantener `<StorefrontParity />` público **sin** `previewMode`; la vista privada mantiene `requireRole("admin")`. Mantener precio, stock, variante, carrito, cookies, referencias y proveedores de datos del main vigente. Los cambios en `renderCart` y `addToCart` se limitaron al uso de la fotografía/fallback; `storefrontPricing`, `stockCopy` y `expandPublicVariants` compararon iguales frente a main. `reconcilePreviewCart` debe volver a verificarse en pruebas de carrito.

### 2.2. Contratos — 3 suites `INCLUIR, 2 CON AJUSTE ANTES DE RELEASE`

| Archivo | Tratamiento |
|---|---|
| `tests/integration-lot2a-style.cjs` | TRANSFERIR CON ADAPTACIÓN: en release sustituir aserción de existencia de vercel.json bloqueante por aserción de ausencia de configuración temporal |
| `tests/integration-lot2c-shared-skin.cjs` | TRANSFERIR CON ADAPTACIÓN: misma aserción de vercel.json; mantener prueba de UNDER_CONSTRUCTION mientras corresponda |
| `tests/premium-white-contracts.cjs` | TRANSFERIR: incluye regresión de atribución de instructor y nuevo control del resumen del admin |

Las suites `integration-lot2a-style.cjs` e `integration-lot2c-shared-skin.cjs` **exigen actualmente** `JSON.parse(read("vercel.json")).git.deploymentEnabled === false`, y fallarán si se excluye correctamente el archivo de la futura rama de release. **En la rama local de release**, modificar esos contratos para verificar que **no se ha importado** la salvaguarda temporal, manteniendo pruebas del proxy y de autorización. No relajar ni borrar todos los tests para obtener PASS. **No cambiar estos contratos en la candidata**, donde deben seguir asegurando su bloqueo.

**Expectativa de QA actual de la candidata, tras la corrección visual:** 37 contratos regulares + 1 TODO (36 + 1 TODO fueron realmente ejecutados en Lote 3C; el control nuevo solo se ejecutó aislado en JS V8).

### 2.3. `EXCLUIR` de cualquier futura rama de release — 4 archivos

| Archivo | Motivo |
|---|---|
| `design/INTEGRACION-ESTADO.md` | Histórico de integración/QA, pertenece a la candidata; no es requisito de runtime |
| `design/INTEGRACION-INVENTARIO-LOTE1.md` | Inventario histórico de ramas; documentación interna de proceso |
| `design/LOTE3-QA-WORK-20261117.md` | Runbook local de Work, no componente de producción |
| `vercel.json` | BLOQUEO: es exclusivamente de la candidata, git.deploymentEnabled=false; jamás trasladarlo a main |

Este mismo informe y futuras secciones del registro maestro también pertenecen exclusivamente a la candidata y no deben transferirse como código de producción por inercia.

## 3. Evaluación de riesgos y puertas

| Prioridad | Hallazgo | Gate / medida |
|---|---|---|
| P0 | `main` está sin reglas de protección y cualquier push puede activar producción | Configurar protección de rama desde una cuenta administradora; no permitir force push/borrado; PR y checks obligatorios cuando estén disponibles; comprobar `protected=true` antes de integrar |
| P0 | La candidata suprime Vercel con `vercel.json` temporal; una futura rama sin ese archivo podría crear preview al recibir push | Planificar explícitamente desactivar/autorizar el trigger de preview antes de cualquier push de release; **no** eliminar el archivo en candidata |
| P1 | Los dos tests del gate temporal fallarán en release si se copia el árbol y se elimina `vercel.json` sin adaptación | Adaptar pruebas en checkout local de release, volver a ejecutar suite completa y dejar evidencia |
| P1 | Work validó Lote 3C, pero el panel admin recibió después un ajuste de interpolación JSX de una línea | Nuevo contrato estático PASS; falta `tsc`, lint, build y prueba de visibilidad/índice en panel antes de aprobar el SHA actualizado |
| P1 | Compra/pago y datos Supabase no se probaron en producción, solo con fixtures | Prueba controlada de checkout/inventario/variante en ambiente seguro de QA autorizado; sin transacciones reales ni mutaciones comerciales |
| P2 | Galería/Lista privada a 1440 tuvo un fallo intermitente en lote anterior | 12/12 arranques fríos correctos en 3C, 0 reproducciones; continuar monitoreo, no reescribir el runtime especulativamente |
| P2 | Hojas de CSS históricas y overrides `!important` son extensos | Mantener alcance por `#updown-store` y wrapper de ficha; realizar smoke responsive/Safari antes de habilitar tienda |
| P2 | Repositorio público e historial experimental con respaldo existente | Auditoría separada de exposición histórica; NO copiar archivos privados, tokens o datos en el PR |

## 4. Secuencia futura, con nuevas autorizaciones

1. **Ahora, en candidata:** Work puede ejecutar un QA focalizado del nuevo rótulo en el administrador de Servicios, junto con `node --test`, `tsc`, lint y build; solo fixtures.
2. **Antes de PR:** administrador habilita protección de `main` y comprueba el valor efectivo. Configurar política de despliegues/preview para no publicar accidentalmente al crear una rama de release.
3. **Preparación local aislada:** crear checkout limpio desde SHA exacto de `main`, trasladar **solo los 21 archivos de aplicación + 3 tests** del manifiesto; **no incluir 3 documentos ni `vercel.json` ni este informe**. No hacer push; reajustar las dos suites de gate para modo release.
4. **QA de combinación local:** validar TypeScript, lint, Next build, rutas, autorización, modo público/privado, móvil/escritorio, ES/EN, carrito/stock, Clases, metadatos y barrera. Comparar diff final con manifiesto exacto y comprobar ausencia de secretos y salvaguarda temporal.
5. **PR/merge/deploy:** solo tras **nueva autorización explícita** de administrador y estrategia Vercel validada. El merge a `main` puede activar un despliegue aunque `UNDER_CONSTRUCTION=true`; la retirada posterior de «Próximamente» requiere una autorización **distinta**.

## 5. Criterio de cierre de esta preauditoría

**SÍ:** lista selectiva exacta de 28 archivos, tratamiento del bloqueo temporal, contrato de tests y rótulo administrativo corregido en candidata.  
**NO:** protección real de `main`, release branch, PR, merge, despliegue, pruebas E2E reales de pago, apertura de la tienda.

**Decisión vigente: NO-GO para fusionar/desplegar.** Este documento solo entrega un plan de ejecución seguro.
