# POS 2.2 — aceptación de caja, Retail V8 y recuperación controlada
**Proyecto:** UpNDown Cabo · **PR:** #28 · **Rama:** `feat/pos22-global-promos-services-20261112`
**Estado:** guía de preparación, **NO autorización para publicar**. Sin cambios en `main`, Supabase productivo ni terminales de tienda.

## 1. Evidencia exigida antes de liberar
- [ ] PR #28 mantiene HEAD exacto aprobado, sin modificaciones posteriores a CI.
- [ ] GitHub Actions `POS variant safety` y `Admin catalog regression` en **success**, incluyendo `tests/pos/pos22-transactions.cjs` y `tests/pos/pos22-receipt.cjs`.
- [ ] Compilación y TypeScript aprobados; Vercel Preview vinculado al **mismo commit**.
- [ ] Confirmada revisión de los tres scripts SQL POS 2.2 y permisos; ninguna consulta de prueba modifica producción.
- [ ] Validada copia térmica Retail V8 en una PC y con impresora POS-80C reales: **dos copias, dos cortes, una apertura de cajón**.
- [ ] Capturas/evidencia de tickets sin nombres, referencias de pago ni datos personales de clientes.
- [ ] Personal de caja/supervisión confirma los escenarios de aceptación (abajo).
- [ ] Aprobación **expresa y separada** del responsable para migración y publicación productiva.

## 2. Cambios certificados digitalmente
La venta guarda descuentos **por línea** (campaña automática + descuento manual) y el **general** únicamente en la cabecera de venta. Los tickets computan:
- `ahorro_por_articulos = SUM(pos_sale_items.discount_amount)`
- `ahorro_general = pos_sales.discount_amount - ahorro_por_articulos`
- `ahorro_total = pos_sales.discount_amount`
- `total = subtotal_original - ahorro_total`

No se consultan campañas **actuales** para recalcular ventas históricas. El ticket distingue `AHORRO ARTICULOS`, `DESCUENTO GENERAL` y `AHORRO TOTAL` cuando correspondan. Las pruebas detectan inconsistencias entre cabecera y líneas, antes de generar el PDF o el ESC/POS.
Para el ejemplo: subtotal $5,000; descuento general 20% ($1,000); pelotas $200 con 10% adicional ($20), total **$3,980**. Una operación con descuento de artículo pero sin general no debe imprimir el renglón de descuento general.

**Límites:** el ticket PDF es una vista/descarga; el sistema de impresión automática usa el *puente local* `tools/pos-print-bridge/UpNDownPrintBridge.ps1`. El puente instalado actualmente en la PC puede ser una versión anterior; un commit no actualiza automáticamente ese equipo. No ejecutar un instalador nuevo sin prueba física y autorización de la tienda. El puente ofrece `/health`, pero responder `retail-v8` no verifica papel, driver, caja ni calidad de impresión. La comprobación física es obligatoria.

**Comportamiento importante:** el código Retail V8 envía dos copias, dos cortes y al final la señal del cajón. Ante una falla de impresión, comprobar venta en historial antes de intentar reimprimir; **nunca volver a cobrar únicamente por falta de papel o error de impresora**. Si falla entre copias puede haber impresión parcial: cotejar el folio impreso antes de repetir.

## 3. Aceptación funcional de caja (ambiente separado de producción)
Usar producto/servicio y operador ficticios sobre una base local, o durante una práctica operativa formal autorizada por el negocio. Para las pruebas físicas de impresión **no realizar transacciones de prueba en la base productiva**.

| ID | Escenario | Criterio verificable |
|---|---|---|
| C01 | Venta sin promoción | Cobro, ticket y pago exactos; existencia disminuye 1 |
| C02 | 20% general sobre $5,000 | Total $4,000; aparece `DESCUENTO GENERAL $1,000` |
| C03 | Pelotas $200 con 10% individual y 20% general sobre $5,000 | Total $3,980; ahorro artículos $20, general $1,000; ahorro total $1,020 |
| C04 | Campaña activa por categoría/SKU/UPC | Solo mayor campaña coincidente; empieza y termina en fechas establecidas de Los Cabos |
| C05 | Precio final exacto de cuenta | Resultado coincide con valor capturado; descuentos ya aplicados no se vuelven a restar |
| C06 | Descuento que supera límite del cajero | Sin token se rechaza; supervisor/administrador acorde a permisos; token se consume al cobrar |
| C07 | Servicio a precio libre por cajero/supervisor | Cobro correcto; inventario físico sin movimientos; sin variante obligatoria |
| C08 | Pago mixto efectivo + terminal | Suma exacta, detalle por método y referencias visibles |
| C09 | Pago insuficiente o negativo | Rechazo íntegro; sin venta, sin movimiento de inventario |
| C10 | Producto/variante sin stock | Rechazo; no se vende un SKU padre de variantes |
| C11 | Anulación de venta de artículo y servicio | Artículo se reintegra una sola vez; servicio no genera movimiento |
| C12 | Devolución de pago mixto | Respeta los métodos y montos originales; no se puede devolver dos veces |
| C13 | Ticket térmico | Dos copias completas, dos cortes, un cajón; renglones de descuentos legibles en 80 mm |
| C14 | Error de impresora/desconexión | La venta confirmada sigue registrada; error visible; reimpresión por folio sin segundo cobro |
| C15 | Cierre de turno | Efectivo esperado = inicial + cobros efectivo + entradas - salidas - devoluciones efectivo; terminal no suma como efectivo |
| C16 | Sin promoción | El ticket NO inventa un descuento general |
| C17 | Venta con varias piezas | Totales de línea, ahorro y artículo comprados correctos |
| C18 | Impresión PDF y compartir comprobante | Totales coinciden exactamente con folio y formato de ticket, sin omitir pagos |

Registrar por escenario: fecha, cajero/rol, equipo/driver, folio ficticio, resultado, fotografía del ticket sin datos sensibles y observaciones.

## 4. Procedimiento productivo preparado — no ejecutar hasta autorización
### A. Antes de mantenimiento
1. Confirmar operaciones del día y acordar ventana fuera de horas críticas. Cerrar ventas pendientes y registrar turnos activos.
2. Verificar identidad del proyecto Supabase `xlkjztcxqlsegboivccg`, Vercel `upndowncabo`, repo, rama, PR y SHA.
3. **Verificar respaldo recuperable** con los mecanismos oficiales disponibles en la cuenta Supabase: esquema, migraciones, funciones RPC, políticas RLS/ACL, y datos transaccionales (ventas, artículos, pagos, eventos, reembolsos, caja, stock, variantes y movimientos). Guardarlo en ubicación privada cifrada con acceso restringido, **fuera del repositorio**.
4. Restaurar el respaldo **en una base aislada** y comprobar que las tablas/folios y totales concuerden; no basta con que el botón diga «backup completado».
5. Tomar instantánea de control de conteo de variantes, cantidades de stock, número máximo de venta, ventas/devoluciones de la jornada, caja por terminal, y conteo de operaciones pendientes.
6. Confirmar la versión **instalada** de Print Bridge Retail V8 en cada PC, el driver POS-80C, papel de 80 mm y cajón. Si se requiere actualización local, efectuarla bajo mantenimiento con acceso físico.

### B. Orden de publicación, **requiere aprobación separada**
1. Verificar nuevamente las migraciones POS 2.2 y su compatibilidad con las funciones anteriores. Identificar dependencias, reversiones y nuevas tablas antes de aplicarlas.
2. Preparar plan de «expandir primero»: aplicar cambios de esquema aditivos/controlados mientras el POS 2.1 sigue operativo, con prueba explícita de compatibilidad. **No** usar el entorno de CI como evidencia de datos reales.
3. Aplicar migraciones en el orden exacto aprobado, supervisar errores SQL, funciones y permisos; si falla una migración, **detener despliegue**. No ejecutar pruebas que generen ventas falsas.
4. Fusionar exclusivamente el commit certificado del PR #28 y comprobar READY en Vercel y dominio productivo.
5. Recargar todas las estaciones POS; confirmar accesos de cajero, supervisor, admin, lectura de códigos y catálogo sin cobrar.
6. Verificar la primera **venta genuina supervisada**, su stock, recibo físico, pagos e importes y luego comparar el balance de turno.

### C. Recuperación sin destruir datos
- **Si aún no existen ventas POS 2.2:** detener despliegue; devolver frontend al build productivo validado; revisar las migraciones aplicadas antes de revertir cualquier función o tabla. El rollback del frontend no revierte automáticamente PostgreSQL.
- **Si ya hay ventas POS 2.2:** **NO restaurar** una copia antigua sobre la base viva, **NO borrar ventas**, **NO ajustar inventario por reinicio de tablas**, **NO sustituir** funciones de devolución por versiones que desconozcan servicios y variantes. Suspender cobro si es necesario y efectuar *forward fix* revisado. Conciliar cada transacción real contra su `inventory_movements`, `pos_sale_items`, `pos_payments` y `pos_refunds`.
- **Si falla impresora únicamente:** conservar ventas y caja, revisar el puente local y reimprimir el comprobante del mismo folio; jamás generar otra venta para obtener papel.
- **Si hay discrepancia contable:** detener la operación afectada, identificar folio/terminal y conservar evidencia; no modificar stocks ni totales manualmente sin auditoría de ledger.

## 5. Condición de cierre
Ninguna aprobación de CI autoriza migración/despliegue por sí sola. Requiere confirmación de impresión física, respaldo restaurable, conciliación de caja y autorización expresa de publicación.
