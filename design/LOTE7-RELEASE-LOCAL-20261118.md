# UP AND DOWN Cabo · Lote 7 — ensamblaje local de release

**Fecha:** 18-nov-2026  
**Estado:** LISTO PARA EJECUCIÓN LOCAL AISLADA EN WORK; **NO AUTORIZADO PARA PUSH, PR, MERGE O DESPLIEGUE**.  
**Repositorio:** `corporativonexia-creator/upndowncabo`.  
**Código auditado de origen:** `f59ca078cee500cdfe0550bbf3a6a22c9586e7a3`.  
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
5. Ejecutar `npm ci`, tres suites `node --test` (37 contratos + 1 TODO esperado), `npm run check:admin-scripts`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.
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
