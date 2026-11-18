# UPNDOWN CABO · Lote 8B — Auditoría de Vercel Preview y estrategia de salida

**Fecha:** 18 de noviembre de 2026.  
**Alcance autorizado:** SOLO LECTURA de Vercel y preparación documental del siguiente paso. **No** crear Preview, despliegue, PR ni rama remota, ni cambiar Vercel/Supabase/POS/`main`.
**Dictamen:** **PASS de protección de acceso; NO-GO para pruebas con escrituras sobre Preview; GO para definir staging o un lanzamiento técnico sin pruebas de escritura.**

## 1. Evidencia inspeccionada directamente (conexiones Vercel y GitHub)

| Área | Resultado |
|---|---|
| Proyecto Vercel | `upndowncabo`, `prj_GREaNpIHFkbwUEhqNpTUhmY9OP9W`; equipo `team_BzKv1tlVuToXfCwCBHq8lbVN`, Next.js; Node `24.x` |
| Vercel Authentication | `ssoProtection.enabled=true`, `deploymentType=all_except_custom_domains`: protege despliegues sin dominio personalizado. No equivale a aislamiento de base de datos |
| Password protection | `enabled=false`; la protección relevante es Vercel Authentication |
| Dominios productivos | `upndowncabo.com`, `www.upndowncabo.com`, `upndowncabo.vercel.app`, verificados; no se observan dominios personalizados de Preview |
| Vercel Production actual | Deployment `dpl_Dstj9UmnCccKGPAX8iYEKf8iC5w6`, URL `upndowncabo-lq6usnazv-nexia10.vercel.app`, commit `44e3f10bc8cf32d0b468ea6f406d4b4171a79d4b`, rama `main`; los cinco aliases de producción estaban asociados a este deployment al consultar |
| Preview en otras ramas | Vercel registra builds de otras ramas: crear una rama remota sin protección puede provocar deploy Preview automáticamente |
| Preview de candidata | **0 deployments** en `integracion/premium-white-candidata-20261117` |
| Configuración de candidata | `vercel.json` con `git.deploymentEnabled=false` (no transferir al release final) |
| Protección GitHub | Ruleset 27534656 activo para default branch: `deletion`, `non_fast_forward`, `pull_request`; `main.protected=true` |
| Base release | `main=44e3f10bc8cf32d0b468ea6f406d4b4171a79d4b`; `SOURCE_SHA=c04513dabb8192aee9f555bbfb29583a116ece07`, 21 archivos app + 3 suites de tests |
| Pruebas técnicas | Lote 8A GitHub Actions run 44274494221: 40 PASS/0 FAIL/1 TODO, TypeScript/lint/build PASS, admin Chromium 14 PASS, premium Chromium 3 PASS (20/20 ciclos viewport), POS Chromium 2 PASS en fixtures |

## 2. Hallazgo crítico: variables compartidas Production + Preview

La enumeración de metadatos de Vercel (sin descifrar ni mostrar valores) devuelve exactamente tres variables:

- `SUPABASE_SECRET_KEY`: `target=["production"]`, tipo `sensitive`; **no** está dirigida a Preview.
- `NEXT_PUBLIC_SUPABASE_URL`: **un solo registro** con `target=["production","preview"]`, tipo `encrypted`; **no** tiene `gitBranch` específico.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: **un solo registro** con `target=["production","preview"]`, tipo `encrypted`; **no** tiene `gitBranch` específico.

Una consulta filtrada por la rama candidata no devolvió sobreescrituras específicas de esa rama. Por consiguiente, **Vercel aplica las mismas variables públicas de Supabase a Production y Preview por defecto**. No existe aislamiento de backend para Preview demostrado. Vercel Authentication restringe quién puede visitar el Preview, pero **no** convierte el backend en sólo lectura ni evita mutaciones de quienes puedan acceder al Preview.

**No** ejecutar en Preview real: ventas, cobros, recepción de equipos, modificación de servicios, clases, registros de clientes, actualización de stock, importación, borrado ni otras escrituras. No probar flujos con escrituras como parte del QA hasta proporcionar backend aislado y reglas de datos de prueba. Este hallazgo NO descalifica los tests del Lote 8A: se ejecutaron enteramente con servidores simulados `127.0.0.1:4319/4320`.

## 3. Política recomendada antes de un PR remoto o Preview

**Opción preferida (QA de navegación y escritura controlada):** crear/identificar un proyecto Supabase de staging separado de producción, con esquema compatible y registros ficticios; configurar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` **sólo para la rama release Preview**, sin editar las variables Production compartidas. Confirmar con auditoría de metadatos la presencia de los overrides, que la Preview use staging, SSO habilitado, sin dominios personalizados de Preview y sin secretos productivos. Si se necesitara escritura para API privada, crear credenciales staging independientes y limitadas, nunca reusar secretos de producción. No copiar datos personales reales al staging.

**Opción limitada (sin staging):** no efectuar prueba interactiva de escritura ni ventas sobre Preview; seguir utilizando GitHub Actions de fixtures para todos los flujos mutables. Si se autoriza un PR con Preview que apunte al backend real, se debe asumir riesgo residual de acceso de usuarios autorizados y de side effects. Esa alternativa no satisface la puerta de aislamiento y requerirá decisión explícita del administrador y limitación operativa. Es más segura una Preview desactivada temporalmente o un entorno staging aislado para cualquier QA E2E mutable.

La candidata actual NO se debe publicar ni cambiar su `vercel.json`. Cualquier rama release desde `main` sin `vercel.json` provocaría potencialmente una Preview, por lo que la estrategia de protección del entorno debe aplicarse ANTES del primer push remoto.

## 4. Preparación del PR selectivo (plan, todavía sin creación)

1. Congelar los SHA de `main` y `SOURCE_SHA` antes de ejecutar. Si deriva `main`, detener y recalcular.
2. Trabajar desde un checkout local de `main`; ejecutar `scripts/prepare-release-local.py` sólo en un entorno aislado. Confirmar diff de **24 rutas exactas** (21 app, 3 suites) y excluidos: `vercel.json`, `design/**`, `scripts/**`, archivos adicionales CI de Lote 8A.
3. Cerrar la política Vercel Preview: comprobar aislación staging o aprobar explícitamente el modo limitado sin escrituras de Preview, y qué efecto tiene el primer push de una rama remota de release.
4. Con nueva autorización, crear rama remota de release basada en `main` con los 24 archivos (y adaptaciones locales de 2 tests para comprobar ausencia de `vercel.json`). No usar merge de toda la candidata, que contiene 31+ rutas y documentos.
5. Abrir PR hacia `main`. Ejecutar checks existentes de GitHub Actions (administración y POS), revisar CI de release Lote 8A contra el mismo SOURCE_SHA y auditar archivos/seguridad. El workflow aislado 8A está en candidata, NO dentro del diff de 24 rutas: no suponer que se ejecutará automáticamente en el PR final. No merge hasta registrar todos los PASS.
6. Con autorización nueva posterior, merge y primer deploy técnico con `UNDER_CONSTRUCTION=true`, verificar regresión de /proximamente, login, admin, POS, preview privada, stock y no escrituras reales. Conservar ID de despliegue previo para rollback documentado. No quitar barrera pública.
7. Apertura comercial requiere autorización independiente y QA de cobros, inventario, variantes, acceso y SEO.

## 5. Estado final y límites

**Comprobado en este Lote 8B:** Vercel Auth activada para deployments no personalizados, dominios productivos y aliases actuales, ID de deployment productivo, variables compartidas Production/Preview, falta de overrides branch-specific registrados, 0 deployments candidata, main protegido, 24 archivos y tests Lote 8A.

**No comprobado/no realizado:** no se descifraron variables, no se ejecutaron llamadas de escritura, no se verificó un backend de staging porque no figura configurado en el proyecto Vercel, no se creó Preview ni rama, no se alteró el acceso SSO ni la política de Git, no se hizo PR, merge o deploy. Vercel API del proyecto no expone todos los detalles de política de activación de git-deploys; su comportamiento se infiere de despliegues existentes y del bloqueo en la candidata.

**Cierre Lote 8B:** auditoría de solo lectura completada, **GO para preparar aislamiento de Preview y procedimiento de release**; **NO-GO para pruebas E2E de escritura en Preview, PR remoto/merge/deploy** hasta nueva autorización y control del entorno.
