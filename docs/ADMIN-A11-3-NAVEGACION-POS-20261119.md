# A11.3 · Navegación persistente y Recepción como pestaña POS

Fecha: 19-nov-2026. Base: `31670405224e67291679dcf20589514df2be8fc2` (PR #35 en borrador).

## Diagnóstico

- La navegación de `admin-section-nav.tsx` usaba documentos completos para volver a `/admin` y sus submódulos. Esto destruía el DOM de nueve scripts y obligaba a mostrar «Preparando el administrador» repetidamente.
- La interfaz de Inventario podía exhibir la vista previa durante el cambio de documento entre `/admin` y `/admin/inventario`. Se conserva el DOM y se oculta el panel antiguo al entrar en la ruta anidada; no se clonan manejadores.
- Los registros de Supabase de producción del 19-nov mostraron `POST 401` y «permission denied for function pos_reception_access» / `pos_reception_recent`. Se comprobó que ambas funciones existen y `authenticated` tiene `EXECUTE`. El error observado corresponde a una solicitud sin sesión POS válida, no a un permiso de función faltante.

## Cambios de aplicación

1. La capa `/admin` exige el rol ADMIN en servidor y conserva `AdminParity` montado después de la primera visita. Las rutas internas siguen exigiendo su rol y usan transiciones Next.js sin volver a cargar los scripts del ADMIN.
2. Al regresar a la raíz, los enlaces `?section=...` llaman a los botones originales para mostrar la sección correspondiente (Pedidos, Vendedores, Clases, Contenido, POS), preservando sus listeners y reglas comerciales.
3. `/pos` ofrece dos pestañas para la misma sesión: POS y Recepción de equipos. La pestaña POS se oculta visualmente sin desmontar el carrito, el turno ni los controles; Recepción se monta al primer acceso y se conserva al alternar.
4. El enlace de Recepción desde ADMIN apunta a `/pos?tab=recepciones`; la URL histórica `/pos/recepciones` sigue funcional para compatibilidad.
5. Recepción valida primero si existe una sesión autenticada del POS, comunica cómo iniciarla cuando falta y no envía RPCs de taller con sesión anónima. No se cambian permisos de base de datos.

## Seguridad y exclusiones

- Ninguna migración nueva, modificación de datos comerciales, cambio RLS, terminal, empleado, venta, caja ni stock.
- El POS conserva la autorización de empleado y terminal para cada RPC; ingresar al ADMIN no concede automáticamente permiso POS.
- Sin despliegue a producción ni fusión a `main`: el parche queda disponible como candidato independiente para QA.

## Validación local

- `npm run check:admin-scripts`: PASS (9 scripts).
- `npm run lint -- --quiet`: PASS.
- `npx tsc --noEmit`: PASS dentro de `next build`.
- `npm run build` con backend ficticio: PASS.
- `npm run test:pos`: 20 PASS, 1 SKIP heredado para sesiones PostgreSQL concurrentes.
- `node --test tests/admin-release-main.contract.cjs tests/premium-white-contracts.cjs`: 33 PASS, 1 TODO.
- Chromium local no ejecutable: entorno devuelve `socket(): Operation not permitted`. Se requiere CI de GitHub Actions / QA operativo antes de autorizar fusión.

Pruebas de regresión nuevas en `tests/admin-catalog.spec.ts`: conservación del DOM y scripts, pestañas POS/Recepción, rechazo de RPC sin sesión y compatibilidad de navegación A11.2.
