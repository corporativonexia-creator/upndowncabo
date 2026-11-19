# A11 · Preparación quirúrgica de salida — ADMIN Premium White + POS administrativo

> **Actualización de autorización (18-nov-2026, Los Cabos):** Las conclusiones NO GO que siguen documentan el estado anterior. Aldo autorizó posteriormente integrar y publicar durante una ventana de negocio cerrado, reemplazar exclusivamente las funciones SQL de generación SKU y utilizar registros ficticios ocultos para QA, sin alterar SKUs ya existentes. La preparación controlada y su estado vigente se registran en `ADMIN-A11-CONTROL-RELEASE-20261119.md`.

Fecha de corte: 18 de noviembre de 2026 (Los Cabos). Repositorio `corporativonexia-creator/upndowncabo`.

## Estado de autorización

**NO GO para `main` y producción.** El administrador pidió acelerar la puesta en marcha, pero la autorización categórica anterior sigue exigiendo una confirmación **expresa y posterior** para fusionar, desplegar, o modificar el Supabase alojado. No se ha solicitado ni aplicado ninguna migración a un backend real. Este lote crea solo documentos, manifiesto y contratos de QA en la candidata protegida.

| Punto | Referencia comprobada | Estado |
| --- | --- | --- |
| Base actual de `main` | `cff541a03dff8fc98437e1176dc3aef057c25562` | Preservar |
| Última candidata funcional auditada | `d2a8976d594b10280f1cd7aa55ee81efc5cfb7e6` | QA GitHub Actions #44463636405 SUCCESS |
| Chromium con fixture aislado | 62/62 | PASS |
| Contratos del cliente ADMIN | 29/29 | PASS |
| PostgreSQL/PGlite en aislamiento | 7+2+5+7 pruebas | PASS |
| TypeScript, build, nueve scripts | Todos aprobados | PASS |
| ESLint | 0 errores, 8 avisos heredados | PASS |
| Despliegues de rama candidata | 0 | Bloqueo de Vercel vigente |

La compilación y el navegador con fixtures demuestran paridad **sintética**, pero no permiten afirmar compatibilidad con los permisos de una base alojada, el módulo de cámara de Safari o el estado real de producción.

## Diferencia candidata → main: 38 archivos

El manifiesto `docs/ADMIN-A11-RELEASE-MANIFEST.json` identifica **23 rutas de ejecución** que deben incluirse juntas en una integración selectiva. Contiene cambios en ADMIN, ficha unificada, inventario/etiquetas, reportes POS y seguimiento de taller; incluye la retirada de `inventory-label-enhancer.tsx`, cuyo motor de impresión se consolidó en `inventory-label-print.ts`. No autoriza integración directa ni despliegue.

**Nunca arrastrar automáticamente al release:**

1. **`vercel.json`**: guarda el bloqueo temporal `git.deploymentEnabled=false`. Debe existir en la candidata, pero **no formar parte del commit de producción**. Una omisión impediría los despliegues posteriores esperados.
2. **`supabase/migrations/20261118202020_admin_sku_collision_safe_allocator.sql`**: cambio *propuesto* de reglas SKU, preparado y probado solamente en entornos ficticios. Permanecer fuera de la integración hasta una autorización SQL independiente y verificación en staging aislado. Incluirlo en una fusión podría hacerlo ejecutable por una automatización de migraciones.
3. **`tests/sql/admin-gallery-upc-append-proposal.sql`** y **`tests/sql/admin-retirement-a53-fixture.sql`**: experimentos para PostgreSQL ficticio, no operaciones comerciales ni cambios a ejecutar en producción.
4. **`.github/workflows/admin-ux-a0a2.yml`**: workflow limitado expresamente a la rama candidata. Revisar si conviene agregar una puerta de QA para `main` después de la autorización; no modificar reglas de publicación existentes por accidente.

Los cambios de tests y documentación son trazabilidad de QA; no forman parte de las **23 rutas de ejecución**. El contrato `tests/admin-release-a11.contract.cjs` compara las rutas reales del diff con la selección autorizable y falla si aparece un archivo no clasificado, una exclusión obligatoria dentro de la lista o una diferencia inesperada en el bloqueo de Vercel.

## Puertas reales antes de GO

### A. Backend de prueba completamente aislado

- Disponer de un proyecto Supabase de **staging separado**: jamás usar el proyecto de producción ni copiar sus filas reales. Vercel Preview **puede compartir el backend productivo** con Production, así que una URL preview por sí sola **no** constituye un laboratorio seguro.
- Preparar datos sintéticos de categorías, productos, variantes, UPC, SKU, stock y galería. Verificar perfiles de prueba y los permisos existentes `SELECT`/`INSERT` en `products`, `product_images` y Storage `product-media`. No cambiar RLS ni tablas reales.
- Con aprobación expresa, evaluar la regla propuesta de SKU **solo en staging**: conservar `WED-0001` y otras máscaras históricas, detectar colisiones en padres/variantes y dos altas concurrentes, respetar el SKU de variante predeterminada, no modificar registros anteriores. Confirmar que el RPC real `admin_quick_product_create` utiliza las funciones esperadas. Cualquier decisión de aplicar SQL a producción queda fuera de A11.

### B. Pruebas físicas y funcionales de ADMIN

- En iPhone Safari, escanear UPC real de fábrica y UPC interno simulado; generar código solo cuando no exista uno. Tomar una fotografía **HEIC válida**, comprobar conversión y asociarla al producto correcto usando UPC o nombre.
- Crear una **ficha única** ficticia con 2 variantes y fotos, reabrirla para comprobar precio, canal, descripciones y stock. Verificar que la ruta vieja de Alta rápida redirige a la ficha única.
- Simular denegación de permisos de foto/Storage y pérdida de respuesta; no debe borrar ni duplicar imágenes. Mantener un solo operador de fotografías, según decisión vigente.
- Visitar Inventario, conciliación manual, Pedidos, vendedores, comisiones, contenido, taller y reportes POS. No realizar ventas reales ni movimientos sobre productos reales; los flujos comerciales se prueban con fixtures.
- Capturar snapshots antes/después de las tablas **de staging** para demostrar invariancia de registros no utilizados en la prueba. La conciliación A10.3 no debe crear variantes ni mover existencias sin autorización individual.

### C. Lanzamiento revisado y reversión

1. Revalidar SHA exacto de `main` y candidata; congelar diff de 23 rutas y resultados de QA. Ningún merge si hay cambios concurrentes sin reevaluación.
2. Tras GO en staging y aprobación expresa de integración, preparar un **PR de integración selectiva** que excluya el bloqueo Vercel y SQL pendiente. Ejecutar CI completo sobre el árbol exacto propuesto, no solo sobre la candidata protegida.
3. Resolver primero la decisión explícita sobre la regla SKU: **no declarar garantizada la unicidad bajo concurrencia en Supabase de producción solo porque pasó PostgreSQL aislado**. Si el SQL no está autorizado, la puesta en operación de nuevas altas queda bloqueada.
4. Con autorización separada de publicación y confirmación del proyecto Vercel de destino, desplegar el árbol aprobado. Mantener `UNDER_CONSTRUCTION=true` para la tienda hasta una orden distinta; `/admin` y `/pos` siguen siendo rutas operativas.
5. Verificar inicio de sesión, carga ADMIN, ficha, búsqueda y fotos en un smoke test operativo autorizado, seguido de monitoreo de errores. Preparar reversión mediante el despliegue anterior de Vercel si falla el código. Una migración de base no puede asumirse reversible mediante rollback del frontend.

## Riesgos residuales que no deben ocultarse

- El guardado de ficha única aún consta de **dos transacciones** (RPC comercial existente y actualización acotada de metadatos). Tiene reintentos idempotentes simulados, no atomicidad total.
- La operación real de almacenamiento HEIC en iOS y la compatibilidad RLS/Storage **no se han verificado** en un staging aislado.
- Las reglas de SKU propuestas están probadas en PostgreSQL aislado, **no instaladas en Supabase alojado**. La integridad final depende del esquema y RPC efectivo.
- La capacidad de retirar productos con relaciones históricas exige auditoría y permisos especiales; A5 no autoriza bajas ni movimientos reales.
- A10.3 eliminó la sincronización silenciosa de variantes; una conciliación administrativa real necesita autorización, trazabilidad e idempotencia adicionales.
- Un workflow histórico de impresión POS marca fallo desde antes de A10.3. No es el workflow dedicado de ADMIN; deberá catalogarse por separado antes de imponerlo como puerta de release.

## A11.1 · Staging gratuito bloqueado por cuota; laboratorio sin costo

**Consulta del 18-nov-2026:** la organización «Up And Down» figura en plan `Free` y la cotización oficial para un nuevo proyecto devuelve **0 USD/mes**. Aldo autorizó su creación exclusivamente si no genera cargos. Sin embargo, el alta de «UpNDown Staging» fue **rechazada** por Supabase: el propietario `corporativonexia@gmail.com` ya alcanzó el límite de **dos proyectos gratuitos activos** entre las organizaciones donde es administrador o propietario. Se verificó nuevamente el listado de «Up And Down»: conserva solo el proyecto original `upanddown` (`ACTIVE_HEALTHY`); **no se creó staging ni se generó costo**. No se intentará un upgrade ni pausar/eliminar otro proyecto sin autorización específica.

**Fallback efectivamente ejecutado, sin conexiones a datos comerciales:**

- `node --test tests/admin-shell-a1.contract.cjs tests/admin-product-a3.contract.cjs tests/admin-release-a11.contract.cjs tests/admin-sku-a34.pg.cjs`: **39/39 PASS**. Confirma máscaras históricas, detección de colisiones, sufijos, propuesta SQL aislada y exclusiones del release.
- `npm run test:pos`: **20 PASS, 1 SKIP**, sin fallos. El escenario omitido es el de terminales simultáneas que exige PostgreSQL multisesión; CI anterior ya ejecutó las pruebas de PostgreSQL aislado de la candidata.
- La última matriz completa en GitHub Actions sigue siendo #44465465678, **SUCCESS** con 62/62 Chromium y 32/32 contratos. No sustituye comprobaciones de permisos RLS/Storage ni HEIC real de iPhone en un Supabase aislado.

**Puerta abierta:** si Aldo identifica y autoriza pausar algún proyecto gratuito realmente prescindible, se puede volver a cotizar el costo y solicitar un staging nuevo. No se realizará esa acción sobre sistemas ajenos ni sobre producción por iniciativa del agente. Hasta entonces, mantener **NO GO** para SQL alojado, fusión a `main` y despliegue.

**Siguiente decisión solicitada a Aldo:** autorizar un entorno de staging Supabase completamente separado con productos ficticios y la prueba de la regla SKU *solo allí*. Después presentar un GO/NO GO fundamentado y pedir autorización específica para `main` y producción. No solicitar credenciales en el chat ni publicar un entorno de prueba conectado a registros reales.
