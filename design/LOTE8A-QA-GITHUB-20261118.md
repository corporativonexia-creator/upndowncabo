# UpNDown Cabo · Lote 8A — QA automático de release con GitHub Actions

**Fecha:** 18-nov-2026  
**Dictamen:** **GO técnico de QA con fixtures**. No autoriza PR/merge/despliegue ni apertura comercial.  
**Repositorio:** `corporativonexia-creator/upndowncabo`  
**Rama candidata:** `integracion/premium-white-candidata-20261117`  
**SHA del run verificado:** `8b4b7e3fbe4ea262f67cc80cffe00b51dc627167`  
**Fuente inmutable ensamblada:** `c04513dabb8192aee9f555bbfb29583a116ece07`  
**Base main intacta:** `44e3f10bc8cf32d0b468ea6f406d4b4171a79d4b`

## 1. Archivos de QA añadidos, excluidos del release comercial

- `.github/workflows/upndown-premium-release-qa.yml`: workflow push de candidata y ejecución manual, `permissions: contents: read`, no secretos de producción ni comandos de deploy.
- `tests/premium-release-viewport.spec.ts`: tres pruebas Chromium en servidores locales; una de barrera pública/preview privada, una de 20 ciclos acumulados 760→1024→1440 px, y una de 5 resoluciones + ES/EN y recarga.
- `playwright.premium-release.config.ts`: usa `playwright.config.ts` del proyecto con fixture de Supabase en `127.0.0.1:4319` y Next local en `127.0.0.1:4320`.
- `scripts/prepare-release-local.py`: lista explícita de estos tres archivos como **únicamente permitidos en la candidata** después del SHA fuente, conservando manifiesto selectivo de **24 archivos**, exclusión de `vercel.json` y todos los demás guards.

**Ninguno de estos archivos CI se copió dentro de los 24 archivos de release.** Los dos scripts Playwright se copian temporalmente dentro del worktree exclusivamente para ejecutar QA en Actions; GitHub no los sube a producción.

## 2. Ejecuciones reales observadas

- **Primer run:** `44274287820`, SHA `f2b47f055c837e3cf6c19d4698540c8ab9d717da`. Falló correctamente en el control del ensamblador, que detectó archivos QA nuevos no incluidos en su lista posterior al SHA fuente. Se amplió **solo** `ALLOWED_AFTER_SOURCE`, sin alterar fuente, las 24 rutas, proxy ni protección de deploy.
- **Segundo run: SUCCESS:** `44274494221`, SHA `8b4b7e3fbe4ea262f67cc80cffe00b51dc627167`. [Ver run completo](https://github.com/corporativonexia-creator/upndowncabo/actions/runs/44274494221).

Resultados extraídos directamente de los logs del run SUCCESS:

| Verificación | Resultado |
|---|---|
| Checkout y ensamblaje local selectivo | PASS · exactamente 21 app + 3 suites |
| Variables de fixture y checkout bloqueado | PASS · loopback, sin secrets de Supabase/Stripe |
| Contratos Premium White + Lote 2A/2C | **40 PASS, 0 FAIL, 1 TODO** preexistente |
| Scripts administrativos | PASS |
| `npx tsc --noEmit` | PASS |
| ESLint | 0 errores, 9 advertencias preexistentes |
| `npm run build` Next.js | PASS |
| Chromium administración (fixture) | **14 PASS** |
| Chromium Premium (fixture) | **3 PASS** |
| 20 ciclos acumulados 760→1024→1440 | **20/20 PASS** dentro del test Premium |
| Chromium POS (fixture) | **2 PASS** |
| Revalidación `UNDER_CONSTRUCTION=true`, sin `vercel.json` en release | PASS |
| Comandos de push/merge/deploy | No se ejecutaron |

El test responsive ejercita selección Lista/Galería y estado de clases `#udsGrid`, `aria-pressed`, `localStorage`, URL y evento `updown:copy-ready` después del cambio de viewport. El segundo test valida 320, 390, 760, 1024 y 1440 px con ES/EN y recarga.

## 3. Límites, riesgo residual y próximos gates

- Los resultados anteriores se ejecutaron **con Supabase simulado y localhost**, no con inventario real, pago real ni entorno Preview de Vercel; por tanto son un GO **de QA** y no de lanzamiento.
- El TODO heredado declara expresamente que existe un E2E de negocio más amplio aún pendiente. Aunque se añadieron tests browser focalizados y pasaron, no debe reclasificarse el TODO como resuelto.
- La regresión Galería/Lista que falló en la matriz previa quedó cubierta en la nueva suite con 20 ciclos reales. El pase no garantiza por sí solo Safari, redes reales o condiciones de producción.
- El flujo `upndown-premium-release-qa.yml` **vive solo en candidata**, no en el conjunto selectivo de 24 archivos. Antes de requerir su check en PR o considerarlo parte de CI permanente, diseñar su incorporación/adaptación a la rama final; las Actions existentes del repositorio sí validan administración y POS para PR.
- Vercel tiene dominio productivo asociado a main y autenticación habilitada en dominios de Preview. Su entorno Preview **declara** variables públicas de Supabase también; no se ha comprobado aún que correspondan a un backend de pruebas. No realizar operaciones que escriban o borren datos desde ese Preview hasta verificar el aislamiento y las credenciales no productivas.
- Antes de una futura rama remota de release sin `vercel.json`, validar política de auto-preview, SSO, dominios y destino de deploy para evitar publicación anticipada. La candidata bloqueada no se convierte directamente en release.
- Regla GitHub `main` ID `27534656`, active con deletion, non_fast_forward y PR, rama protegida; los checks todavía no son obligatorios en ruleset.

## 4. Siguiente lote autorizado por separado

**Lote 8B:** auditar aislamiento y protección Vercel Preview y preparar el procedimiento de PR selectivo de forma reversible, sin push/PR/deploy hasta nueva autorización. Después, Lote 8C para PR y pruebas previas a merge, y Lote 8D para deploy técnico con `UNDER_CONSTRUCTION=true`. La apertura pública será una fase posterior.

**Estado de cierre:** QA automáticos **PASS**, datos reales y producción intactos. **NO-GO de despliegue todavía** por los gates ambientales y de aprobación restantes.
