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

## A10.2 · Trazabilidad del sincronizador HEIC (auditoría sin cambios operativos)

**Ruta confirmada en código:** el `boot()` de `public/updown-product-heic-inventory-hotfix.js` instala el lector HEIC, vincula el `submit` de `#udProductForm` y llama inmediatamente `syncMissingInventoryVariants()` sin botón de confirmación. Ese mismo `submit` agenda dos llamadas más (1.8 s y 4.2 s), independientes del éxito o fracaso efectivo del guardado original.

| Momento | Acción | Impacto potencial |
| --- | --- | --- |
| Apertura de ADMIN | `products.select(id,name,sku,stock,price,sale_price,status)` y `product_variants.select(id,product_id)` | Dos lecturas globales incluso sin abrir Inventario |
| Producto sin ninguna variante en la instantánea | `admin_inventory_save_variant` con `p_variant_id`, `p_sku` y `p_barcode` nulos | **INSERT** de una variante `Única`; genera SKU y código internos por la función SQL existente |
| Variante recién creada y `products.stock !== 0` | `admin_inventory_adjust` con cambio igual al stock del padre, tipo `adjustment` | **Movimiento/ajuste de inventario** no solicitado explícitamente en esa sesión |
| Cualquier envío del formulario heredado | Nuevas pasadas a los 1.8 y 4.2 segundos | Consultas repetidas; posibilidad de carrera si otra sesión crea la variante entre lecturas |

**Metadatos de las migraciones versionadas:** `supabase/migrations/20261002073000_inventory_auto_sku_barcode_variant_rules.sql` define `admin_inventory_save_variant` como `SECURITY DEFINER`, exige `public.is_admin()` y, para una variante nueva, invoca `next_variant_sku` y `updown_ean13`. Que el usuario autenticado sea administrador **no convierte la creación automática en una autorización operativa de cada artículo**. Este análisis no consulta ni confirma el esquema desplegado; se refiere al código versionado.

**Riesgos específicos:** no hay una confirmación por producto, ni un cotejo de historial, visibilidad o existencias en POS antes del INSERT. `p_is_active` se calcula como `product.status !== "inactive"`, por lo que un producto `archived` no queda desactivado por esa expresión. No hay token/idempotencia por solicitud en el cliente: dos cargas concurrentes podrían leer la misma ausencia antes de que exista la variante. No se afirma que estos escenarios hayan ocurrido en datos reales; son riesgos derivados de la implementación.

**Prueba controlada A10.2:** el servidor ficticio presenta `p-orphan` (stock 3) **solo** a la proyección exacta que consume ese sincronizador. Chromium inicia ADMIN con credenciales de prueba, sin tocar productos, y registra la invocación de `admin_inventory_save_variant` seguida de un intento `admin_inventory_adjust` (+3). El fixture acepta una variante sintética sin stock y **responde 403 al ajuste**, sin modificar existencias. El caso demuestra la ejecución automática del cliente, no prueba movimientos en Supabase real. Otros consumidores del catálogo siguen recibiendo únicamente sus tres productos habituales para no contaminar las pruebas de navegación/variantes.

**Decisión A10.2:** auditoría y contratos solamente; `public/updown-product-heic-inventory-hotfix.js`, las funciones SQL y la operación existente permanecen **sin cambios**. No es seguro retirar todo el archivo: el manejo HEIC heredado aún vive ahí. Recomendación para una etapa con autorización específica: separar la conversión de imágenes del motor de sincronización, retirar la sincronización silenciosa de arranque/envío y ofrecer una conciliación **explícita, con vista previa de artículos y relaciones históricas, confirmación y registros**, probada primero en un laboratorio sintético. Cambiar la lógica de variantes/stock o ejecutar una conciliación real queda fuera de esta autorización.
