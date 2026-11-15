# Taller · Recepción de equipos para servicio (POS)
**Estado:** Implementación aislada PR #29. Esta versión no forma parte de producción hasta aprobación separada.

## Flujo de mostrador
1. Empleado activo inicia sesión en una terminal autorizada del POS (sin necesidad de turno abierto).
2. Pulsa **Recibir equipo para servicio** → ruta `/pos/recepciones`.
3. Captura nombre y teléfono del cliente, identificación del equipo, servicio del catálogo POS 2.2, trabajo solicitado, estado físico observado y accesorios.
4. **Registrar recepción** produce un folio nuevo `SR-000001`, hora de Los Cabos, empleado y terminal. No dispara ni abre una venta.
5. Elige **Imprimir 2 tickets térmicos** (con Print Bridge actualizado); si aún no está actualizado, utiliza **PDF dos copias**.
6. Entrega copia **CLIENTE**; identifica el equipo con copia **TALLER**. El folio es el mismo.
7. Las recepciones anteriores se consultan por folio, cliente, teléfono o equipo y pueden reimprimirse, sin crear otra recepción.

## Aislamiento y control
- DB: migración `20261114215000_pos_service_receptions.sql` crea **una sola tabla nueva** y tres funciones RPC específicas. RLS habilitado; tabla cerrada a consultas directas de `anon` y `authenticated`.
- Cada RPC exige sesión Supabase activa, empleado POS `status=active` y terminal POS autorizada por su token. No exige turno abierto.
- El registro es inmutable. El cliente no puede editar ni borrar el original. Las reimpresiones conservan la información registrada.
- Se valida en el servidor que el servicio siga activo, sea `is_service=true` y tenga visibilidad POS.
- `request_id` UUID impide doble registro ante reintentos. Nunca incrementa inventario ni toca `pos_sales`, `pos_payments`, `pos_shifts` o `inventory_movements`.
- No se almacenan fotografías, no se abre orden de taller ni se registra estado de avance. No reemplaza recibos fiscales ni acredita pago.

## Impresión de dos copias
- Nuevo comando local `POST http://127.0.0.1:18181/print-reception`.
- Versión nueva del puente térmico envía `CLIENTE` + corte y `TALLER` + corte. **No envía `$DRAWER` en esta ruta.**
- El puente existente en las PC no se actualiza con GitHub/Vercel. Debe copiarse y **reiniciarse** el archivo `tools/pos-print-bridge/UpNDownPrintBridge.ps1` bajo supervisión de TI, conservando una copia previa; una impresión en terminal no demuestra el cambio hasta inspeccionar papel y cajón.
- En la versión antigua del puente, el botón térmico informa que el endpoint no existe; el PDF permite imprimir ambas páginas manualmente. La apertura del cajón desde el driver al imprimir PDFs depende de su **configuración local**, no de la aplicación. Verificar o usar perfil de impresión sin señal de cajón.
- Si la respuesta térmica falla a mitad de impresión, comprobar qué copia salió antes de reimprimir. Reimprimir no crea recepción adicional.

## QA y condiciones para publicación
- [x] Protocolo de permisos: funciones solo para `authenticated`, tabla restringida; sesiones/terminales verificadas en RPC.
- [x] Pruebas locales de PostgreSQL desechable en `tests/pos/pos22-transactions.cjs`: cajero sin turno, folio, consulta, idempotencia, servicio inválido, terminal no autorizada, inventario/ventas inmutables.
- [ ] CI GitHub `POS variant safety` y `Admin catalog regression` en verde sobre el último commit.
- [ ] Probar con admin, supervisor y cajero en terminal real autorizada, incluyendo sin turno de caja.
- [ ] Alta de uno o más servicios en Admin → POS → Promociones (catálogo existente; no se crea servicio ficticio en producción).
- [ ] Prueba de impresión en POS-80C real: 2 copias, 2 cortes, **cajón cerrado**.
- [ ] Respaldo reciente y revisión de migración en producción, autorización expresa antes de aplicar SQL / merge a `main`.
- [ ] Verificar que POS 2.2 siga cobrando y anulando normalmente.
- [ ] Opcional: revisión legal de términos de recepción, privacidad de teléfonos y comprobantes con información de clientes.

**Importante:** el preview de Vercel valida la compilación/UI, pero las RPC nuevas no estarán disponibles en Supabase productivo hasta que se aplique la migración autorizada; no generar recepciones de prueba usando datos reales en producción antes de esa etapa.
