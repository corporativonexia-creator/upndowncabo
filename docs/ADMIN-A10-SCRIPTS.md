# ADMIN A10 · Auditoría de dependencias y retiro selectivo

Rama exclusiva: `integracion/admin-premium-white-a0a2-20261118`. Se mantienen `main`, producción y Supabase intactos. Inventario basado en el checkout previo a A10.1; los tamaños son bytes no comprimidos, **no** una medición de tiempo de red.

## Mapa de ejecución

`src/components/admin/admin-parity.tsx` inserta los scripts en orden secuencial, espera los botones críticos y entrega la navegación a `installAdminSidebar()`. La capa React conserva los nodos heredados y sus eventos. Un script que solo cambie el DOM puede ser retirado si sus efectos ya están garantizados antes de revelar ADMIN; un script que lea o escriba Supabase requiere una auditoría funcional separada.

| Runtime histórico | Tamaño | Función comprobada | A10.1 |
| --- | ---: | --- | --- |
| `updown-admin-legacy-runtime.js` | 81,960 | Catálogo, edición heredada, pedidos, listeners comerciales | Conservar |
| `updown-product-heic-inventory-hotfix.js` | 6,686 | HEIC de la ficha antigua **y sincronización automática con escrituras** | **Conservar/bloquear retiro hasta auditoría** |
| `updown-product-smart-entry-v1.js` | 10,590 | Sugerencias de descripción, categoría y código, incluye operaciones de captura | Conservar |
| `updown-product-condition-v1.js` | 928 | Normaliza opciones de condición (`demo` → `preowned`) | Conservar |
| `updown-admin-v2.js` | 183,866 | Contenido, vendedores, clases, reportes y operaciones POS administrativas | Conservar |
| `updown-pos-pin-v2.js` | 1,626 | Generación de PIN del servidor desde el botón POS | Conservar |
| `updown-h63-order-comms.js` | 12,782 | Notas/comunicación de pedidos y confirmación de lectura | Conservar |
| `updown-inventory-v2.js` | 4,635 | SKU/código de barras y controles de inventario en formulario heredado | Conservar |
| `updown-product-tabs-v1.js` | 10,462 | Pestañas de catálogo, buscador y host de ficha unificada | Conservar |
| `updown-inventory-nav.js` | 2,381 | Inventario en menú, CTA duplicado y ordenación periódica de enlaces | **Retirar únicamente de carga** |

## A10.1 · Un solo responsable del menú

Se trasladan las tres responsabilidades todavía útiles de `updown-inventory-nav.js` a `installAdminSidebar.ts`: crear `#udInventoryMainNav` si falta, ocultar el antiguo CTA `#udNew` que duplica «Nueva ficha», y suprimir el enlace «Afiliados» cuando ya existe la pestaña original de Vendedores. El adaptador continúa **moviendo los botones originales, sin recrear listeners comerciales**. La validación de arranque espera primero los módulos y después exige que el enlace Inventario exista en el menú listo.

El archivo histórico permanece en el repositorio para trazabilidad y reversión, pero deja de inyectarse como décimo script. Se elimina así una solicitud JavaScript de arranque y un temporizador de reordenación de navegación. No se afirma una mejora de milisegundos hasta medirla en un entorno de red comparable.

**QA exigido:** contrato de nueve runtimes, vínculo `/admin/inventario`, botón viejo oculto, ausencia de acceso duplicado «Afiliados», navegación Productos/Vendedores con eventos originales, catálogo y POS sin regresiones y ninguna escritura comercial en los flujos de prueba. Todos los datos de navegador son simulados.

## Bloqueos para siguientes retiros

1. **Riesgo de escritura silenciosa:** `updown-product-heic-inventory-hotfix.js` llama `syncMissingInventoryVariants()` **al arrancar** y tras enviar el formulario antiguo; consulta `products` y `product_variants`, crea variantes faltantes mediante `admin_inventory_save_variant` y puede ajustar existencias con `admin_inventory_adjust`. A9.1 ya encontró efectos de este sincronizador en fixtures. No se puede tratar como un conversor HEIC inocuo ni cambiarlo sin autorización específica y pruebas de integridad comercial.
2. `updown-pos-pin-v2.js` intercepta en captura el botón de PIN y utiliza `admin_pos_generate_shift_pin`; retirarlo podría activar una implementación distinta de `updown-admin-v2.js`. Necesita prueba de paridad de permisos, tiempo de validez y auditoría.
3. `updown-product-condition-v1.js` cambia opciones y un valor heredado; el nuevo capturador aún admite `demo`. La máscara de condición de artículos existentes no puede cambiar sin revisión.
4. `updown-inventory-v2.js` y `updown-product-smart-entry-v1.js` comparten responsabilidades de SKU/UPC con implementaciones distintas. No se eliminarán sin aislar los motores de asignación, escaneo, generación y variantes; nunca se reescribirán SKUs registrados.
5. H63, el runtime legacy y V2 administran acciones de pedidos, POS y comisiones. Aunque algunas consultas ya son bajo demanda, no se demostró paridad completa de sus escrituras o suscripciones.

**A10.2 recomendado:** trazar cada efecto secundario y escritura automática de inicialización, construir contratos de no escritura con datos simulados y proponer un aislamiento del sincronizador solo después de autorización explícita. No se realizaron bajas de datos, migraciones, cambios RLS ni despliegues.
