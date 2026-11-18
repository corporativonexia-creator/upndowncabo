# UP AND DOWN Cabo · Lote 7 — ensamblaje local de release

**Fecha:** 18-nov-2026  
**Estado:** LISTO PARA EJECUCIÓN LOCAL AISLADA EN WORK; **NO AUTORIZADO PARA PUSH, PR, MERGE O DESPLIEGUE**.  
**Repositorio:** `corporativonexia-creator/upndowncabo`.  
**Código de origen congelado (7D):** `c04513dabb8192aee9f555bbfb29583a116ece07`.  
**Base `main` exacta:** `44e3f10bc8cf32d0b468ea6f406d4b4171a79d4b`.  
**Manifiesto autorizado:** [LOTE6-PREINTEGRACION-20261118.md](./LOTE6-PREINTEGRACION-20261118.md) (21 archivos aplicación + 3 tests; 4 exclusiones principales).

## 1. Avance ejecutado aquí

Se añadió `scripts/prepare-release-local.py` a la **candidata con `vercel.json` bloqueante**. Es una utilidad local que verifica identidad del remoto, árbol de trabajo limpio, SHA de `main`, ascendencia del SHA fuente y ausencia de cambios de código posteriores no permitidos. Hace **fetch**, no push; crea un `git worktree --detach` temporal desde el SHA de `main`, importa mediante `git show` exactamente 24 archivos y modifica **solo dentro del worktree** dos contratos de prueba para comprobar ausencia del `vercel.json` temporal. Rechaza modificaciones de `main`, arrastre de documentación, ausencia de `UNDER_CONSTRUCTION=true` o diff que no sea exactamente los 24 archivos esperados.

**Prueba realizada aquí:** ejecución de la misma utilidad en un **repositorio Git local sintético con remote bare de prueba**, no en la cuenta real: ensamblaje final con **24/24 rutas exactas**, ningún `vercel.json`, barrera intacta y **2/2 contratos de gate adaptados PASS** mediante `node --test`. La utilidad también pasó análisis de sintaxis de Python. **NO se ha ensamblado todavía el repositorio real** porque este entorno de ejecución no puede resolver github.com para un clone/fetch; el acceso autenticado se hizo por conexión de GitHub para crear este archivo. Work debe ejecutar el procedimiento con acceso Git y dependencias reales.

## 2. Instrucción para Work

1. Preparar un checkout Git **limpio** de la candidata, con remoto `origin` apuntando al repositorio correcto, sin archivos sin seguimiento que requieran conservarse.
2. Ejecutar desde raíz:

   ```bash
   python3 scripts/prepare-release-local.py
   ```

3. El script imprime la ruta del **worktree temporal detached** (ejemplo `/tmp/upndown-release-local-xxxxxxxx`). Cambiarse a esa ruta; no crear una rama remota.
4. Comprobar el manifiesto resultante: **21 archivos de aplicación + 3 suites = 24 rutas**. Sin `vercel.json`, sin documentos históricos de candidata, sin la utilidad local; `src/proxy.ts` debe ser byte por byte el de `main`.
5. Ejecutar `npm ci`, tres suites `node --test` (40 contratos + 1 TODO esperados, incluidos 3 contratos nuevos de ciclo de vida del runtime), `npm run check:admin-scripts`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.
6. Chromium en entorno aislado con datos simulados: rutas públicas/privadas, gate Próximamente y preview admin, diseño blanco 320/390/760/1024/1440, Lista/Galería y persistencia, búsqueda/filtrado, enlaces locales/canónicos, ES/EN, variantes/fotos/carrito/topes de stock, Clases foto/orden/visibilidad, consentimiento/primer clic/segundo alumno/recarga, cinco servicios restantes, SEO y metadatos.
7. Verificar que no se abrió ningún checkout/pago real, no hubo mutaciones de Supabase ni cambios en POS. Guardar informe GO/NO-GO y **no ejecutar `git push`, `git merge`, `git commit`, crear PR o desplegar**.

El script interrumpe la operación si `main` o la candidata tuvieron deriva que exija nueva comparación. No usar `--force`, `reset --hard` ni corregir el guard eliminando verificaciones.

## 3. Dos autorizaciones de lanzamiento distintas

**A. Integración técnica a producción manteniendo Próximamente:** requiere primero activar protección de `main` mediante cuenta administradora en GitHub, validar la estrategia de Vercel para ramas/PR y aprobar el diff+QA local. Solo entonces autorizar explícitamente un PR y posterior merge/despliegue. El deploy puede ocurrir aun estando `UNDER_CONSTRUCTION=true`; verificar que público sigue cerrado y administración funciona.

**B. Apertura pública:** requiere una autorización específica posterior para cambiar `UNDER_CONSTRUCTION` y validar ruta, pagos y seguridad real del lanzamiento. No confundir despliegue con apertura. No se modificó `src/proxy.ts` en este lote.

### Bloqueos actuales

- GitHub `main` reporta `protected=false` y rulesets vacíos; el conector instalado carece de acción administrativa para establecer protección.
- Vercel registra despliegues de otras ramas. Una rama de release sin `vercel.json` podría desplegarse automáticamente al hacer push. **Por eso el ensamblaje es solo local.**
- El producto todavía requiere QA de ensamblaje local y pruebas controladas de pagos/integración antes de publicación.
- NO se puede garantizar a través de este entorno la compilación del worktree real sin que lo ejecute Work.

**Estado de cierre:** herramientas de ensamblaje preparadas y simuladas con éxito. Siguiente actor: **Work**, para la ejecución y QA en checkout real, sin envío remoto.

## 4. Actualización quirúrgica tras diagnóstico Lote 7B

El Lote 7 original construyó correctamente pero reprodujo una intermitencia de **Galería/Lista privada a 1440 px**. El diagnóstico reportado por Work identificó callbacks de una ejecución de runtime anterior tras el cambio de viewport **760 → 1024 → 1440**: la ejecución obsoleta conservaba el listener `updown:copy-ready`, podía volver a renderizar sobre los controles nuevos y anulaba la selección de Lista. Work reportó 2/5 reproducciones iniciales, 4/4 instrumentadas y arranques fríos sin error. Los logs de instrumentación de Work deben adjuntarse al cierre formal si están disponibles; este documento no los sustituye.

- Parche mínimo aplicado **solo en candidata**: `public/updown-parity-runtime.js`, commit `810c38508a0846e04a8933276fbe795c18894613`. Generación/propiedad de runtime por montaje, guard de `renderProducts()`, limpieza de listener `copy-ready` y del evento de media query, sustitución de toolbar/pager cuyo owner sea obsoleto.
- Contratos nuevos: `tests/premium-white-contracts.cjs`, commit `7bae91bddfd19b705919db83c6d4ac71f0740543`; se ejecutaron **2/2 PASS** aisladamente con el código actual mediante un harness JS. **No** equivale a 39 PASS ejecutados por Node ni a Chromium.
- El ensamblador `scripts/prepare-release-local.py` fue **repinneado** a fuente inmutable `7bae91bddfd19b705919db83c6d4ac71f0740543`, manteniendo la base de `main` `44e3f10bc8cf32d0b468ea6f406d4b4171a79d4b`. Work debe crear **un worktree nuevo**, no reutilizar `/tmp/upndown-release-local-0alnher5` porque contiene código antiguo.
- **QA requerido antes del siguiente gate**: ejecutar suite completa (esperado 39 PASS + 1 TODO), `check:admin-scripts`, `tsc`, lint, build, Chromium focalizado con matriz acumulada de viewport y resolución 1440 en ambos canales; repetir primer clic de instructores, variantes/carrito/stock y rutas protegidas. No dar GO si el click de Lista vuelve a perderse.
- Este cambio **no** autoriza push/PR/merge/despliegue ni retirar `UNDER_CONSTRUCTION`. La protección de `main` y la política de despliegue siguen pendientes.

## 5. Lote 7D — protección de finalización asíncrona y nuevos controles

**Fecha:** 18-nov-2026. **Estado:** código corregido y prueba dinámica aislada PASS; **suite Node/Chromium posterior aún pendiente**.

- `public/updown-parity-runtime.js`, commit `ce6f5ef2e5328f5528ff596a1b1cb6807d5ba144`: `loadStore()` revisa `parityIsCurrent()` al comienzo, después de respuestas de catálogo/categorías/promociones y al terminar la obtención de variantes; `refreshCampaignsForCheckout()` lo verifica después de su RPC. Las finalizaciones de instancias viejas no deben renderizar el catálogo actual, escribir caché ni activar reconciliaciones de carrito. No se alteraron cantidades, precios, consultas de variantes, checkout ni contratos de datos.
- `tests/premium-white-contracts.cjs`, commit `c04513dabb8192aee9f555bbfb29583a116ece07`: test asíncrono real sobre cuerpos de las funciones recuperadas de GitHub, con respuestas deliberadamente tardías de catálogo y promociones, más una ejecución actual que debe seguir renderizando. **1/1 PASS en harness V8 aislado**; en combinación con los 2 contratos previos hay 3 contratos nuevos del ciclo de vida.
- Se repinneó el ensamblador local a `SOURCE_SHA=c04513dabb8192aee9f555bbfb29583a116ece07`, conservando `MAIN_SHA=44e3f10bc8cf32d0b468ea6f406d4b4171a79d4b`. Work debe generar un worktree **nuevo** con exactamente 21 archivos de aplicación + 3 suites, sin `vercel.json` ni documentación.
- **Expectativa de contratos tras 7D: 40 PASS + 1 TODO**; no declarar PASS del total hasta ejecutar `node --test` en el release local. Debe repetirse `npm ci`, `check:admin-scripts`, `tsc`, lint y build, más los ciclos de Chromium móvil → escritorio y matriz completa, incluyendo Galería/Lista 1440, Clases, traducción y carrito.
- No se realizaron PR, merge, despliegue, operaciones en Supabase real ni cambios en `main`. Su protección sigue pendiente. La publicación comercial sigue bloqueada.

**Dictamen:** GO de revisión técnica aislada; **NO-GO para PR/merge/deploy** hasta QA Chromium completo, branch protection y política Vercel verificados.
