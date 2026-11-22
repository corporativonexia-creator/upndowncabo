# UP AND DOWN · Guía operativa de taller integrada al POS 2.2

> **Versión en desarrollo (PR #29).** No funciona en producción hasta aprobar la migración, fusionar el PR, actualizar el Print Bridge y verificar el hardware. Este documento es la capacitación propuesta al habilitarlo.

## A. Administrador: crear un servicio

1. Inicia sesión como **administrador** en `/admin`.
2. Entra a **POS → Promociones y servicios** (ruta `/admin/pos/promociones`).
3. Baja hasta **02 · SERVICIOS → Alta de servicio**.
4. Captura el **nombre / tipo de servicio** (ejemplos: Cambio de grip, Ajuste de loft/lie, Reparación de putter, Revisión general, Instalación de shaft).
5. Selecciona la **categoría contable** activa adecuada y pulsa **Crear servicio**.
6. Verifica que aparezca en **Servicios registrados** con SKU y EAN-13 propios y botón **Ocultar/Activar**.
7. El servicio queda **activo solo en POS**, no visible online, con **precio y existencias en 0**. El cajero fija el precio cuando corresponda. No requiere registrar stock ficticio.

**Importante:** no utilices la sección de servicios con fotos/banners de la web. Es otro módulo. Para una recepción de taller se usa únicamente un producto de tipo servicio del catálogo POS.

## B. Empleado: recibir un equipo (sin cobrar)

1. Entra a `/pos`, identifícate con tu usuario de empleado y terminal autorizada. **No necesitas abrir turno de caja**.
2. Selecciona **🔧 Recibir equipo para servicio**. Se abre `/pos/recepciones`.
3. Registra **cliente y teléfono**; especifica el **equipo y características**. Selecciona un **servicio POS**.
4. Describe **trabajo solicitado** y **condiciones observadas al recibirlo**: rayones, accesorios, funcionamiento y daños preexistentes. Añade funda, llave u otros accesorios.
5. Pulsa **Registrar recepción**. Se genera folio `SR000001` o sucesivo (sin guion) y queda en estado **RECIBIDO**.
6. Pulsa **Imprimir 2 tickets térmicos**. Si el puente local no está actualizado, usa **PDF dos copias**. Ambas copias llevan el mismo folio y código Code 39: **CLIENTE** y **TALLER**.
7. Entrega una al cliente y conserva la otra junto al equipo. **El ticket de recepción no acredita pago** y no genera venta ni altera inventario.

**Un equipo + un servicio principal por folio.** Para otro equipo abre otra recepción.

## C. Cuando termina el trabajo

1. En **Recepciones**, busca por folio, nombre, teléfono o equipo.
2. Selecciona la recepción y revisa el estado y comentarios.
3. Pulsa **✓ Listo para entregar**. Queda **LISTO PARA ENTREGAR**. Puede volver a consultarse o reimprimirse.

No se lleva una bitácora extensa ni se obliga a capturar precios antes de conocer el trabajo final.

## D. Cliente recoge: escaneo, precio y pago en POS

1. Abre el turno de caja correspondiente. En `/pos`, usa **Cobrar equipo de taller · Folio** y escanea el código Code 39 o escribe `SR000001`. También puedes pulsar **Escanear y cobrar en POS** desde la recepción lista. Los folios antiguos `SR-000001` siguen siendo válidos para búsqueda y cobro.
2. El sistema **busca el folio exacto**, verifica que esté **LISTO PARA ENTREGAR** y carga el servicio correcto, cantidad **1**, con precio pendiente.
3. Revisa en pantalla cliente, equipo, trabajo y condición original. Captura el **precio final MXN mayor a $0**.
4. Puedes agregar otros artículos a la misma venta. Los descuentos y autorizaciones obedecen las reglas normales del POS 2.2.
5. Selecciona efectivo, tarjeta, transferencia u otro método y pulsa **Cobrar**. El POS valida importes y guarda **una única venta** vinculada al folio; marca la recepción **ENTREGADO Y COBRADO**.
6. Entrega el equipo y el ticket fiscal/comercial que proceda. Un folio entregado no se puede cobrar nuevamente.

**Nunca vendas el servicio por $0 para simular la recepción.** El precio `0` es solo el valor pendiente de la recepción; **no se registra como venta**. Tampoco escanees el UPC genérico del servicio para localizar una recepción: usa siempre el **folio SR**.

## E. Seguridad, errores y devoluciones

- Solo empleados **activos**, autenticados y en **terminal POS autorizada** acceden a la recepción. Las recepciones usan RPC y tabla RLS cerrada a lectura directa.
- El paso de recepción a listo puede hacerse sin turno. El cobro requiere **turno abierto** y utiliza una transacción SQL atómica con el motor `pos_create_sale_v22`.
- El folio se bloquea mientras se cobra; un segundo cobro con otro identificador se rechaza. Reintentar el **mismo** cobro perdido por problemas de conexión puede recuperar la venta original (idempotencia).
- Si el sistema informa que el folio ya fue cobrado, **no registres otra venta**; revisa la recepción y su venta vinculada.
- El equipo del cliente **no ingresa al inventario de mercancía**; el servicio no genera movimientos de stock.
- Anulaciones o reembolsos siguen el procedimiento habitual POS y requieren revisión del vínculo con el folio (el registro de recepción original no se elimina).
- No se almacenan fotografías, ni historial de avances, ni se modifica el contenido de tickets antiguos. Se conserva una trazabilidad mínima.

## F. Lista de habilitación en producción

- [ ] PR #29 pasa compilación, TypeScript, lint y suites de POS/administración; revisión de seguridad.
- [ ] Respaldo verificado y revisión expresa antes de ejecutar migración `20261114215000_pos_service_receptions.sql`.
- [ ] Aplicar migración autorizada, fusionar el PR y confirmar nueva versión en Vercel producción.
- [ ] Actualizar y reiniciar **UpNDownPrintBridge.ps1** en cada PC POS, conservando copia del anterior.
- [ ] Prueba física POS-80C: **dos copias**, **dos cortes**, folio Code 39 legible por escáner y **cajón cerrado durante recepción**.
- [ ] Probar Cajero, Supervisor y Admin: recibir sin turno; marcar listo; cobrar con turno; recuperar ante reintento; bloquear el segundo cobro.
- [ ] Confirmar que ventas, promociones, anulaciones, devoluciones e inventario continúen correctos.

No ejecutar ni simular cobros reales sobre producción durante la verificación de código.

## G. Diagnóstico de impresión térmica de recepción (PR #39, sin instalación)

Mientras el PR #39 esté en borrador, **no reemplazar el puente de impresión en operación**, ni fusionar a `main`. Descargar la versión de `UpNDownPrintBridge.ps1` de esa rama a una carpeta temporal y ejecutar las pruebas **cuando no haya otros trabajos de impresión**. Ambas utilizan `SR999999`, datos ficticios, no abren el cajón y no registran recepciones ni ventas.

1. Primero, comprobar texto y corte **sin código de barras** (una sola copia). Desde PowerShell, en la carpeta temporal: `./UpNDownPrintBridge.ps1 -PrinterName 'POS-80C' -TestReceptionPlain`. Deben aparecer cliente, equipo, servicio, trabajo solicitado y corte automático.
2. Si lo anterior funciona, probar el ticket **con código de barras** (dos copias y dos cortes): `./UpNDownPrintBridge.ps1 -PrinterName 'POS-80C' -TestReception`. Verificar en ambas: datos completos, cortes independientes, cajón cerrado y escaneo exacto de `SR999999`.
3. Si el primer paso falla, el problema no depende del código de barras: registrar foto del papel y estado de la cola de impresión. Si solo falla el segundo paso, registrar dónde se detiene y si realiza los cortes. **No repetir impresiones reales hasta diagnosticarlo**.

Si la política de ejecución del equipo impide iniciar la prueba, pedir autorización al administrador de Windows; no cambiar las restricciones del equipo para esta prueba.
