# POS-80C Retail V8 · Prueba física SIN venta (POS 2.2)

**Estado:** preparada en el PR #28; requiere ejecución local por el encargado. Esta prueba **no** instala ni publica POS 2.2 ni modifica la versión activa de caja.

## Qué prueba y qué no
El nuevo parámetro `-TestReceipt` del archivo `UpNDownPrintBridge.ps1` utiliza el mismo constructor `BuildBody` y la misma impresora RAW que los tickets actuales, pero **no inicia el servidor HTTP** y no realiza llamadas a Supabase/Stripe, ni registra folios, ni cobra, ni mueve inventario. Se imprimen dos copias y se hacen dos cortes. **No abre el cajón**, a menos que el encargado añada explícitamente `-TestDrawer`.

No es necesario cerrar el turno ni realizar una venta. Coordinar la prueba cuando la impresora no esté atendiendo otro ticket: los dos procesos pueden compartir la cola de impresión, y una impresión simultánea podría intercalar las copias.

## Preparación
1. En la computadora de caja, abrir la configuración de impresoras Windows y **copiar el nombre exacto** de la POS-80C (p. ej., `POS-80C` o `POS-80C Retail V8`).
2. **Sin reemplazar** el Print Bridge instalado, descargar del PR #28 únicamente el archivo actualizado `tools/pos-print-bridge/UpNDownPrintBridge.ps1` en una **carpeta temporal aparte**. Verificar que procede del repositorio corporativo.
3. Usar PowerShell de Windows. La prueba no utiliza el puerto 18181, así que el puente habitual no necesita desinstalarse ni modificarse.
4. Verificar papel y avisar al cajero que se imprimirán dos tickets con la leyenda `PRUEBA POS 2.2 - NO ES VENTA`.

## Ejecución supervisada
En PowerShell, situarse en la carpeta temporal que contiene el archivo (con `cd`, usando la ruta de esa carpeta), y ejecutar:

```powershell
# Sustituir POS-80C por el nombre exacto que muestra Windows.
.\UpNDownPrintBridge.ps1 -PrinterName 'POS-80C' -TestReceipt
```

En una computadora con políticas que impidan ejecutar archivos PS1, detenerse y consultar al administrador de Windows: **no cambiar políticas del sistema ni desactivar antivirus como solución improvisada**.

Opcionalmente, **solo con autorización del supervisor y cuando el cajón esté libre**, verificar el pulso de apertura mediante:

```powershell
.\UpNDownPrintBridge.ps1 -PrinterName 'POS-80C' -TestReceipt -TestDrawer
```

## Resultados esperados
- Dos copias: `CLIENTE` y `COMERCIO`, claramente marcadas como **prueba**, con dos cortes.
- Subtotal original: **$5,000.00**.
- Pelotas de golf $200 y descuento del artículo 10% = **$20**.
- Descuento general en cuenta = **$1,000**.
- Ahorro total = **$1,020**; importe simulado final = **$3,980**.
- Sin pagos reales, sin folios válidos, sin IVA ficticio desglosado como operación real, sin registro de inventario.
- El cajón permanece cerrado por defecto; con `-TestDrawer`, debe recibir un único pulso de apertura.
- La prueba genera trabajos RAW con los mismos comandos ESC/POS. Que el programa reporte «enviado» solo confirma su entrega a la cola de Windows: **el encargado debe verificar visualmente papel y cortes**.

## Registro de evidencia
Anotar fecha/hora, nombre de impresora en Windows, versión de PowerShell, número de copias/cortes, formato de importes, comportamiento del cajón (cuando esté autorizado), y cualquier error. Fotografiar solo tickets ficticios, sin datos de clientes. Enviar el resultado al responsable.

**Nunca usar la opción normal `/print-sale` con una venta inventada como método de prueba**: evita el etiquetado de seguridad y podría generar un comprobante engañoso.

Si algo falla, conservar el puente instalado y la impresora tal como estaban; no reinstalar drivers, modificar ventas, alterar el registro ni fusionar el PR. Documentar el error exacto para corregir la rama.
