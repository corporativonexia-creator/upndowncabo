# UPNDOWN CABO — ADMIN UX · Estado maestro

Fecha: 18 noviembre 2026.
Base protegida main: cff541a03dff8fc98437e1176dc3aef057c25562.
Rama: integracion/admin-premium-white-a0a2-20261118.
Scope: A0-A1 y prototipo A2. Ningún cambio en producción, POS comercial o Supabase.

## Regla absoluta de protección
Prohibido modificar valores, precios, SKUs, UPCs, existencias, variantes, ventas, pagos, recibos, clientes, comisiones, Kardex, esquema SQL, RLS, datos o Storage de Supabase. Todos los tests con fixtures sintéticos. No fusionar ni desplegar sin nueva autorización.

## Lotización
- A0: candidata aislada con vercel.json git.deploymentEnabled=false; excluir el archivo del release final.
- A1: ocultar estructura antigua hasta terminar diez scripts y detectar tabs principales; splash Premium White y error con Reintentar. Marca de medición local updown-admin-bootstrap.
- A2: menú lateral inicial por secciones nativas expandibles; trasladar nodos originales del menú sin clonar ni destruir sus handlers; preservar accesos POS, caja, recepción, promociones, comercial y contenido.
- A3: unificar ficha de producto y la captura de UPC, cámara, fotografías HEIC, variantes, entradas y alta. **Decisión del administrador: eliminar Alta rápida como pantalla separada.** Solo retirarla después de demostrar paridad funcional; primero migrar capacidades, luego ocultar enlaces/reescribir marcadores y al final retirar código huérfano con QA.
- A4: fotografía por UPC de producto existente; A5: retirar artículos sin alterar registros históricos; A6: inventario y etiquetas; A7: POS reportes bajo demanda; A8: recepción taller; A9: Pedidos y comercial; A10: limpieza auditada de scripts antiguos; A11: QA/PR selectivo.

## Límites técnicos
- A1 elimina el salto visual pero NO reduce todavía los diez scripts ni garantiza menor latencia de red; medir antes/después en A2-A7.
- La rama hereda main con UNDER_CONSTRUCTION=true y POS intacto.
- Supabase Preview comparte backend con Production. Nunca efectuar escrituras de prueba.
- Conservar todas las herramientas heredadas hasta que cada función tenga sustituto y pruebas.
- Antes de PR: lint, typecheck, Next build, contratos de ADMIN/POS y matriz Playwright aislada. Sin despliegues automáticos de candidata.

## A3 · Primera consolidación reversible (18 noviembre 2026)

Estado: **A3.1 validada técnicamente en CI; NO completa la retirada de Alta rápida ni constituye autorización para producción**.

- Se incorpora `Nueva ficha` en Productos mediante un portal React dentro de `udProductsView`. Se reutiliza `QuickProductEntry` sin copiar su motor de escritura, escáner ZXing, conversión HEIC, capturas de cámara, reconocimiento por código, imágenes por variante y RPCs existentes.
- La ficha se monta **sólo al abrirla**, por lo que no agrega consultas ni dependencias al arranque normal. Una vez montada, se conserva al alternar Catálogo/Editor completo para no perder datos locales sin guardar.
- `Editor completo` conserva intacto el formulario histórico y su edición avanzada. Los enlaces de orientación de talla en dicho formulario ahora abren la captura integrada.
- El catálogo se refresca por un evento local únicamente tras un guardado o entrada confirmados, sin alterar el RPC, el payload, los precios ni la política de inventario.
- La ruta `/admin/productos/alta-rapida` se conserva temporalmente como respaldo, y `AdminSectionNav` también. No se eliminó ni sustituyó funcionalidad comercial.

### Brecha de paridad antes de retirar Alta rápida y el formulario de creación anterior

| Capacidad | Captura integrada | Editor completo heredado | Próxima decisión técnica |
| --- | --- | --- | --- |
| UPC manual, cámara, búsqueda de coincidencias | Sí | Parcial (entrada manual) | Unificar búsqueda en ficha |
| Foto móvil, galería, HEIC | Sí | Sí, otro adaptador | Consolidar canal de fotografías en A4 |
| Variantes con fotografía y existencia inicial | Sí (creación) | Sí (edición posterior) | Diseñar edición completa sin duplicar escritura |
| Marca, modelo, condición, especificaciones golf | Todavía no | Sí | Migrar campos sin cambiar el contrato de guardado |
| Descripciones ES/EN, oferta, destacado, novedades | Todavía no | Sí | Conservar paridad completa antes de retirada |
| Crear borrador con RPC idempotente | Sí | No (inserción directa) | Definir flujo único con rollback real de UI |
| Editar producto y galería histórica | No | Sí | Conservar editor hasta migración verificada |

### Riesgos y límites descubiertos

1. `updown-product-heic-inventory-hotfix.js` incluye `syncMissingInventoryVariants()` y lo ejecuta al inicio; puede crear variantes y movimientos mediante RPCs aun sin interacción explícita. **Comportamiento preexistente**, no alterado en A3. No ejecutar QA contra el Supabase real. Auditar y obtener autorización específica antes de cambiar el mecanismo de sincronización.
2. `next_internal_barcode` consume un identificador; no ejecutarlo en tests contra backend compartido.
3. La captura rápida y el formulario completo realizan escrituras distintas; combinar payloads sin migrar y probar el contrato puede cambiar precio, stock, código o visibilidad. Mantener ambos motores intactos en A3.1.
4. La creación rápida conserva estado `draft` y requiere completar su ficha desde el catálogo. No prometer publicación automática.

### QA exigido para A3.1

`node --test tests/admin-shell-a1.contract.cjs tests/admin-product-a3.contract.cjs`;
`npm run check:admin-scripts`; `npm run lint`; `npx tsc --noEmit`;
`npm run build`; `npm run test:admin` con fixture local y sin red a producción.

**Nota de entorno:** la verificación estática y el build local fueron correctos; Chromium del ejecutor local no arrancó (`socket() failed: Operation not permitted`), por lo que la matriz de navegador debe confirmarse en GitHub Actions (runner Ubuntu aislado con Chromium instalado). Este bloqueo no constituye un fallo funcional de la aplicación ni un resultado PASS de navegador.

**QA de CI del commit inicial `cb15071`:** navegador NO GO (14/17) por dos causas localizadas. Un enlace con atributo `data-*` sin valor explícito no era igual a su serialización `innerHTML` y realimentaba el observador del formulario de ropa; se normalizó a `data-product-capture-link=""`. El contrato nuevo también confundía `HEAD` de conteo con mutaciones; se corrigió para prohibir específicamente `POST`, `PUT`, `PATCH` y `DELETE`. Ambas correcciones requieren nueva validación de Chromium antes de declarar GO.

**Cierre de QA A3.1:** commit funcional `1cd192dad9a85c3f730948de3629a9fdc414f8ae`, [GitHub Actions #44351055124](https://github.com/corporativonexia-creator/upndowncabo/actions/runs/44351055124) **SUCCESS**: 17/17 Chromium, 8/8 contratos A0–A3, 10 scripts con sintaxis válida, TypeScript PASS, build PASS, lint sin errores (9 advertencias heredadas). POS local: 20 PASS / 1 SKIP. Vercel candidata: cero despliegues. **GO para A3.1 únicamente**. No habilitar borrado de Alta rápida ni fusionar hasta completar paridad y A3 integral.

### A3.2 · Propuesta de dos pasos descartada por decisión del administrador

La propuesta `captura básica → completar en editor heredado` **no cumple el requisito**: el administrador necesita una sola alta completa, con variantes, imágenes, información comercial y descripciones en una sola pantalla y una sola confirmación. La revisión de A3.2 se conserva únicamente como antecedente. No integrarla ni presentar su QA como autorización para release.

### A3.3 · Una sola alta completa y fotografías directas por UPC (QA aislado aprobado)

- `Nueva ficha` ahora es el **único formulario de creación visible** dentro del administrador: UPC manual o cámara, fotos/HEIC, categoría, precio y moneda, canal, existencias/variantes, marca/modelo/condición, oferta, descripciones ES/EN, destacados, Novedades y especificaciones de golf. El editor heredado solo aparece al elegir **Editar** sobre un producto existente; se bloquea su antigua inserción directa sin identificador.
- Un único clic en `Guardar ficha completa` realiza la operación idempotente `admin_quick_product_create` para SKU, UPC, variantes, imágenes y existencia inicial, y luego una actualización **acotada a metadatos de la nueva ficha** (moneda, canales y campos avanzados expresamente capturados). No se incluye SKU, UPC, precio normal, stock ni status en esa actualización. El producto queda `draft`, sin publicación automática. Si falla la segunda escritura, se conserva el mismo `request_id` para un reintento sin duplicar el producto.
- **Aclaración de atomicidad:** una sola acción de usuario todavía implica dos transacciones de base de datos porque el RPC histórico no acepta campos avanzados. No afirmar atomicidad total. Hacerlo transaccional requeriría una modificación de función SQL, prohibida actualmente; elevarla para autorización posterior si la auditoría muestra que es indispensable.
- Al leer un UPC ya registrado, la misma ficha ofrece **fotografías por UPC** desde cámara o galería (incluye HEIC). Se resuelve `product_id` mediante el lookup existente, se verifica cuántas imágenes tiene la galería, se suben a rutas nuevas vinculadas al ID del producto y se insertan filas nuevas en `product_images` **sin eliminar, reordenar ni reemplazar el historial**. Si el código corresponde a una variante, la nueva imagen va a la galería de su producto padre; la fotografía específica de esa variante se sigue gestionando por su editor correspondiente.
- El guardado de fotografías es explícito e independiente de las entradas de inventario. El reintento reutiliza rutas únicas y consulta la galería para evitar duplicados después de un fallo de red. No se hacen escrituras en `products`, `product_variants`, ventas ni movimientos por la operación de fotos.
- La comprobación de los diez espacios de galería se ejecuta **antes** de inmovilizar el lote de fotos: si está llena, la selección local sigue siendo editable. El fixture cubre este caso y un fallo simulado de actualización de metadatos después del RPC, que debe reintentarse con el mismo `request_id` sin una segunda alta.
- La ruta histórica `/admin/productos/alta-rapida` y su motor no se borran todavía: deben retirarse en un commit posterior cuando toda la matriz de navegador haya aprobado la ficha única. `vercel.json` permanece excluyente de despliegue.

**Riesgos que faltan antes de retirar el respaldo:** SKU manual distinto del SKU generado por RPC (requiere auditar reglas de unicidad y consistencia con variantes); edición completa de variantes ya existentes en la misma ficha; concurrencia entre dos operadores que llenan simultáneamente una galería de diez fotos; y compatibilidad RLS/Storage para los nuevos objetos mediante las políticas existentes. No se autoriza alterar tablas, migraciones ni políticas en este lote. **Todas las pruebas usan fixture local.**

**QA A3.3:** un solo botón con metadatos en el mismo guardado; actualización sin reescritura de UPC/SKU/precio normal/stock/status; búsqueda por UPC existente; carga y asociación de fotografías preservando galería incluso después de fallo y reintento; protección ante galería llena y reintento idempotente de metadatos. Todo comprobado únicamente con fixture aislado, sin acceder a productos reales.

**Primera corrida A3.3:** commit `12e42d32716285e5db4e158549e5b125a5ef6d76`, [GitHub Actions #44361873220](https://github.com/corporativonexia-creator/upndowncabo/actions/runs/44361873220) **SUCCESS**, Chromium **20/20**, contratos **10/10**, sintaxis, lint, TypeScript y build correctos; POS local 20 PASS / 1 SKIP.

**Corrida A3.3 reforzada:** commit `59d2c35b12342f8390115519884d88f4bac89027`, [GitHub Actions #44363258424](https://github.com/corporativonexia-creator/upndowncabo/actions/runs/44363258424) **SUCCESS**, Chromium **22/22**, contratos **10/10**, scripts válidos, TypeScript, build y lint sin errores (advertencias de lint heredadas). Verificado `main` en `cff541a03dff8fc98437e1176dc3aef057c25562`, candidata sin despliegues Vercel. **GO para continuar auditoría/paridad A3, NO GO para borrar el respaldo, cambiar Supabase, fusionar o desplegar.**

### A3.4 · Identificadores UPC y SKU (auditoría preparatoria; SIN implementación SQL)

**Decisión del administrador:** UPC/código de barras independiente: se acepta el código original de fábrica por escáner, cámara o captura manual; alternativamente se genera EAN-13 interno. SKU estrictamente interno, automático, único, con reglas actuales de categoría y variantes; el operador no debe inventarlo ni modificarlo. Mostrar un candidato disponible en la ficha antes del guardado y volver a validarlo de manera autoritativa al guardar.

**Hallazgos de lectura del repositorio:**

- `next_category_sku` usa `category_sku_counters` con `INSERT ... ON CONFLICT DO UPDATE` para asignar correlativos, **no números al azar**. Los prefijos registrados en la migración son `WED`, `DRI`, `ROP`, etc.; el ejemplo comercial `UND-WED-0001` **no coincide con el formato histórico `WED-0001`**. No cambiar prefijos ni renumerar productos sin decisión específica.
- La función actual genera el siguiente correlativo **sin comprobar contra `products.sku` ni `product_variants.sku`**. El esquema de prueba refleja `products_sku_key UNIQUE (sku)`, pero no una restricción única explícita en `product_variants.sku`. Un contador adelantado o duplicado heredado puede ocasionar error de alta, mientras que una variante concurrente podría repetir SKU.
- El editor legado `updown-inventory-v2.js` llama `next_category_sku` al elegir la categoría (consume contador antes de guardar); la nueva ficha A3.3 no propone ni reserva un SKU antes del guardado y confía en el trigger `product_auto_identifiers` dentro de `admin_quick_product_create`. La variante predeterminada comparte deliberadamente el SKU con su producto padre; esa pareja vinculada **no representa dos artículos comerciales diferentes** y requiere preservar la compatibilidad POS.

**Corrección propuesta, aún no autorizada:** endurecer la asignación SQL para avanzar el correlativo bajo el bloqueo actual y comprobar el candidato contra ambos conjuntos de SKU hasta hallar uno libre; hacer equivalente la generación de sufijos de variantes y proteger sus carreras mediante una garantía de unicidad apropiada. Exponer una **vista previa de solo lectura**, claramente provisional, a partir del prefijo y del siguiente correlativo libre; revalidar/confirmar el SKU real en el RPC de guardado y actualizar la ficha si otro operador se adelantó. Nunca presentar una previsualización no reservada como garantía absoluta. Probar colisiones históricas, categorías, variantes, concurrencia y reintentos solo en base local aislada. **No crear migraciones, alterar funciones, tablas o políticas ni acceder a datos comerciales reales sin autorización posterior.**

## Requisitos Premium White
Blanco #FFFFFF; superficies #F6F8F6; verde principal #123D32; verde secundario #2F7058; lima de acento #B7DE45. Densidad operativa apropiada para tablas, filtros y POS; alertas y bajas con semántica propia.
