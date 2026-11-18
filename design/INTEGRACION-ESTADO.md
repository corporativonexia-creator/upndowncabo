# UP AND DOWN Cabo · INTEGRACION-ESTADO

**Registro maestro para ChatGPT y Work — Lote 1**
**Fecha de referencia:** 17 de noviembre de 2026
**Repositorio:** `corporativonexia-creator/upndowncabo`
**Rama candidata:** `integracion/premium-white-candidata-20261117`
**Base exacta de main:** `44e3f10bc8cf32d0b468ea6f406d4b4171a79d4b`
**Rama de origen Premium White:** `offline-premium-white-20261114`, commit `19b44e25070f5da875a47008bc438c4e766087f9`
**Estado del lote 1:** Preparación documental y protección automática instalada. SIN integración funcional todavía.

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
| 2B | Revisión adicional de URL pública, seguridad y servicios | ChatGPT | Lote 2A | Contratos y revisión por archivo |
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
