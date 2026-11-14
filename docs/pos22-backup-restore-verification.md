# POS 2.2 — Respaldo restaurable de Supabase (sin servicios adicionales)

**Estado:** protocolo listo; **respaldo real y restauración aún NO certificados**. No ejecutar contra producción ninguna operación de modificación. No crear ramas pagadas de Supabase.

## Propósito
Acreditar que las ventas, sus renglones y pagos, existencias por producto/variante, movimientos, turnos, descuentos y funciones se pueden recuperar desde una copia independiente antes de la liberación POS 2.2.

## Responsables y requisitos
- Administrador con acceso autorizado a la **base Supabase de UpNDown Cabo** y un equipo/servidor confiable con PostgreSQL 17 client tools. Evitar hacerlo en una computadora compartida de caja.
- Tener una **base de datos local desechable** separada de producción; confirmar nombre, host y credenciales antes de restaurar.
- Usar el mecanismo de backup disponible en la suscripción **sin comprar complementos**. Si el panel no permite descargar un respaldo, un administrador puede usar `pg_dump` contra una conexión de base autorizada, siempre que no implique costo extra.
- El archivo contiene datos comerciales y potencialmente personales: **guardar cifrado y con acceso restringido**, jamás adjuntar a GitHub, PR, Issues, mensajes públicos, tickets de soporte ni chats.

## Protocolo
1. Anotar fecha/hora, esquema de migraciones, última venta y conteos. No hacer cambios.
2. Realizar backup consistente en formato custom de PostgreSQL 17, desde un equipo autorizado; **no registrar contraseña en el historial de comandos**. Utilizar `pg_dump` con credenciales en mecanismo seguro (p. ej. `.pgpass` protegida o almacén de secretos local); no insertar contraseñas en archivos fuente.
3. Verificar tamaño, integridad del archivo y su manifiesto con `pg_restore --list`. Calcular SHA-256 local.
4. **Restaurar** en servidor local aislado y desechable, jamás en Supabase activo. En una instalación Supabase completa, algunas dependencias `auth`, `storage`, `extensions` o roles pueden requerir restaurar en infraestructura local equivalente; evitar afirmar éxito si algo falla o se omitió.
5. Ejecutar `VERIFY-RESTORE.sql` tanto en la **instantánea restaurada** como sobre una **instantánea coherente tomada en el momento del respaldo**. No comparar directamente con producción horas después: los conteos pueden cambiar con ventas reales.
6. Validar integridad de `pos_sales` contra `pos_sale_items`, `pos_payments`, movimientos y existencias de variantes; revisar funciones RPC, reglas RLS y permisos con los roles correctos.
7. Guardar evidencia de SHA-256, fecha, responsables, cobertura, conteos, suma de inventario, resultados de restauración y cualquier divergencia; **no compartir nombres de clientes ni números de tarjeta**.
8. Reportar **aprobado** solamente si los datos y la estructura requeridos se restauraron de forma coherente y los puntos de control coinciden. Una copia descargada, listada o con hash **NO equivale** a una restauración certificada.

## Consultas de verificación de la copia
El archivo adjunto `VERIFY-RESTORE.sql` es **SELECT-only**, no crea objetos, no elimina nada y no muestra información personal. Úsese sobre bases con el esquema de UpNDown Cabo y PostgreSQL 17. Los resultados de la copia aislada se comparan con los de la captura del respaldo.

Para volver a comparar después de haber aplicado POS 2.2, hacer énfasis en `pos22_promotions`, funciones de reserva, y compatibilidad de facturación; esos objetos pueden no existir en el backup anterior.

## Bloqueos
- No hay disponible una herramienta de administración de backups en este flujo que confirme haber descargado y restaurado uno real. **Por ello la certificación de respaldo continúa pendiente.**
- Si la exportación es incompatible con la restauración completa, documentar el fallo y detener la publicación; no sustituir con conteos de la base productiva.
- El rollback de código Vercel **no** revierte automáticamente datos ni migraciones; después de ventas reales, evitar restaurar un backup obsoleto sobre la base viva.

## Registro de aceptación
```text
Fecha/hora del respaldo:
Responsable:
Ubicación privada (no dirección pública):
SHA-256 del archivo:
PostgreSQL origen / destino:
Restauración completada sin errores: Sí / No
Conteos y totales de control coinciden: Sí / No
Objetos, políticas y funciones comprobados: Sí / No
Discrepancias (sin datos personales):
Certificado por:
```
