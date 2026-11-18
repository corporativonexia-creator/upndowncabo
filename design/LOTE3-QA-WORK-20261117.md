# UpNDown Cabo · Lote 3 — Handoff de QA a Work
**Preparado:** 17-nov-2026 · Sin despliegue ni cambios en datos
**Repositorio:** corporativonexia-creator/upndowncabo
**Rama autorizada:** `integracion/premium-white-candidata-20261117`
**Commit de entrada:** `de2899b9c0f630310c6ffc9f56b7d5f9fb9d1b8e` (el documento de handoff crea un commit nuevo; usar el HEAD actual de ESTA rama, nunca main)
**Principal de referencia:** `main` `44e3f10bc8cf32d0b468ea6f406d4b4171a79d4b`

## A. Alcance y barreras de seguridad
- Trabajar EXCLUSIVAMENTE en la rama candidata. No hacer merge, pull request, push a main, preview deployment, deploy de producción, ni modificar settings o secretos de Vercel. NO eliminar el `vercel.json` temporal hasta que se planifique de modo explícito la estrategia de salida: `git.deploymentEnabled=false`.
- `src/proxy.ts` debe conservar `const UNDER_CONSTRUCTION = true`; /producto público permanece detrás de «Próximamente», /vista-previa sigue protegida por `requireRole("admin")`.
- No hacer escritura, DDL, migración ni DML en Supabase. No repetir `STORE_SERVICES_SIX_UNIFICATION_20261116_ONE_TIME.sql`. Solo fixtures/mocks. No crear pedidos reales, checkout ni alterar stock, precios, carrito ajeno, ventas o POS.
- Repo GitHub es **público**: no guardar credenciales, datos de clientes, backups ni valores de `.env` en commits, logs ni artefactos.
- No resolver este lote copiando ramas antiguas enteras. Cambios permitidos: correcciones mínimas y demostradas, exclusivamente en candidata, de errores encontrados en este QA.

## B. Evidencia aportada antes de Work
- Protección revisada: main estable, candidata 38 commits adelante/0 detrás al inicio de preparación del handoff; Vercel **0 deployments** de candidata.
- Integración Premium White 2A/2B/2C ya registrada en `design/INTEGRACION-ESTADO.md`.
- Controles 2A: **6/6 PASS** con ejecución en V8 de las aserciones de la suite alimentadas por archivos reales de GitHub (no Node local).
- Controles 2C: **7/7 PASS** en harness V8 de archivos GitHub (no build ni navegador). Lote 2B tiene 28 chequeos estructurales previos PASS; suite formal 18 + 1 TODO aún sin ejecutar en Node.
- Bloqueo técnico en este entorno: `git ls-remote` falla por DNS/no acceso a GitHub, Next y React no están instalados localmente, por lo que **npm ci, tsc, ESLint, next build y Playwright NO SE HAN EJECUTADO**. Work debe hacerlo en un entorno con checkout y red.

## C. Pruebas en Work, orden obligatorio
1. Leer este documento y el maestro `design/INTEGRACION-ESTADO.md`. Clonar/checkout SOLO la rama candidata; registrar `git rev-parse HEAD`, `git status --porcelain`, rama y diff contra main. Verificar `UNDER_CONSTRUCTION=true` y `deploymentEnabled=false`. No registrar valores secretos.
2. Revisar `package.json`, hooks/prebuild y `.github/workflows`, y no instalar extensiones externas no auditadas. Preparar dependencias en entorno local controlado: `npm ci`.
3. Ejecutar exactamente: `node --test tests/integration-lot2a-style.cjs tests/premium-white-contracts.cjs tests/integration-lot2c-shared-skin.cjs`. Esperado: 6 + 18 + 7 = **31 contratos**, 1 TODO E2E; registrar conteo real. Si falla un contrato por selector legítimamente compartido, corregir test solo con evidencia, no forzar PASS.
4. Ejecutar `npm run check:admin-scripts`, `npx tsc --noEmit`, `npm run lint`, `npm run build`. El build dispara `prebuild`; distinguir fallas existentes de fallas introducidas por 2A/2B/2C. Para backend usar variables de fixture/local si son necesarias; nunca conectar servicios reales en modo de escritura.
5. Ejecutar Playwright con backend mock y servidor local, de acuerdo con `playwright.config.ts` (`node tests/mock-supabase.cjs`, `npm run start -- --hostname 127.0.0.1 --port 4320`). `npx playwright test` corre el test de admin configurado; agregar tests focalizados SOLO si se requiere para probar tienda, sin pagos reales ni servicios externos. Verificar captura de errores de consola/hidratación.
6. Matriz de navegador en ancho **320, 390, 760, 1024 y 1440 px**, escritorio y móvil vertical/horizontal: encabezado, logo SVG, menú/cierre, búsqueda en vivo, filtros/aplicar/limpiar/autocierre, Galería/Lista, paginación desktop/móvil, 6 servicios ordenados por Supabase/fixture, ES/EN, fichas independientes y relacionados, enlaces copiar/WhatsApp/consulta con parámetro `ref`, fotografía real/fallback canónico, carrito +1 repetido y tope de stock/variante, indicación «Last one», sin cortes ni overlays que tapen X/CTA.
7. **Importante P1 abierto:** el switch Galería/Lista y paginación sofisticada se controlan en el runtime bajo `PREVIEW_CATALOG`, habilitado SOLO en `/vista-previa`. La portada pública en 2C recibió paridad **visual**, no necesariamente funcional. Probar y registrar explícitamente si / pública muestra y usa dichos controles. Si la funcionalidad pública falta, reportar **NO-GO**, o corregir con un cambio quirúrgico manteniendo backend/precios/carrito; no activar `PREVIEW_CATALOG` globalmente sin análisis.
8. Pruebas de rutas: `/` y `/producto/...` deben seguir redirigiendo a `/proximamente` en contexto público hasta lanzamiento; `/vista-previa` debe requerir administrador, y enlaces internos a `/vista-previa/producto/...` no deben navegar al host de producción al correr en localhost. El enlace destinado a compartir sí usa la URL pública canónica con variante/ref.
9. Si hay defectos: registrar pasos para reproducir, severidad P0/P1/P2, evidencia y SHA. Corregir exclusivamente en candidata y **repetir todas las pruebas afectadas**. No fusionar ramas de POS, etiqueta o recepción.
10. Al terminar, actualizar SOLO la sección de ejecución Lote 3 del registro maestro con los comandos, resultados **ejecutados de verdad**, problemas pendientes, commits correctivos, SHA final y decisión GO/NO GO para pasar a Lote 5. Confirmar en Vercel que la rama candidata tiene **0 deployments**. La aprobación para main/publicación es OTRO paso separado.

## D. Formato de entrega de Work
- **Rama y SHA exacto**
- **Pruebas:** comando, PASS/FAIL/TODO, evidencia reproducible
- **Regresiones comerciales y de seguridad:** carrito, stock, variantes, precios, 6 servicios y permisos
- **Bugs por prioridad:** P0/P1/P2, archivo y corrección
- **Vercel:** 0 deployments, `main` intacto
- **Siguiente acción:** Lote 5 E2E si el gate de Lote 3 pasa, o parche mínimo en candidata y repetir QA

**Prohibido llamar "listo para producción" al resultado de pruebas estáticas o a una compilación sin QA funcional.**
