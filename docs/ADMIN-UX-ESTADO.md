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

**Autorización acotada posterior (18-nov-2026):** el administrador confirma **mantener la máscara actual** y actualizar **únicamente la regla de creación**. Esta autorización permite preparar una migración *no aplicada* en la candidata, y probarla en PostgreSQL aislado; **no autoriza ejecutarla en Supabase real**, cambiar identificadores existentes, estructura de tablas, RLS, main ni despliegues.

**Implementación A3.4 candidata:** `20261118202020_admin_sku_collision_safe_allocator.sql` redefine exclusivamente `next_category_sku` y `next_variant_sku`, sin alterar las firmas, permisos, prefijos ni secuencias. El SKU principal mantiene correlativo de categoría y omite candidatos previamente ocupados en cualquiera de las dos tablas, incluso con diferencia de mayúsculas. El SKU de variante conserva exactamente el sufijo histórico (`-V01`, o derivado de atributos y su incremento `02`, `03`, etc.), consulta ambas tablas y serializa asignaciones simultáneas al mismo producto mediante bloqueo transaccional. El SKU que comparte una variante predeterminada con su mismo producto padre se mantiene por compatibilidad comercial.

**QA local A3.4:** `tests/admin-sku-a34.pg.cjs` ejecuta SQL real sobre PGlite efímero: máscaras y contadores por categoría; saltos de SKU previamente usados, incluso en variantes/cambio de caja; llamadas paralelas de un mismo controlador; sufijos por atributos; continuidad `-Vnn`; prefijos inválidos sin consumir números; funciones y modo de seguridad existentes. **7/7 PASS**. Esto valida colisiones y el controlador aislado, **no demuestra intercalaciones de transacciones independientes**; la prueba exhaustiva de concurrencia requiere un PostgreSQL aislado multi-sesión previo a cualquier integración. No hay garantía global contra inserciones externas que no utilicen estas funciones mientras no exista una restricción adicional en ambas tablas. La vista previa del SKU en la ficha permanece pendiente: no se fabricará un valor tentativo como si fuera reservado. La migración debe quedar fuera de toda integración hasta aprobación explícita separada.

### A3.5 · Cierre de acceso único y paridad de variantes (QA aislado aprobado)

**Alcance autorizado:** preparación, ajustes del código de ADMIN y QA aislado. Sin integración a `main`, despliegue, aplicación SQL real ni datos comerciales reales.

- El enlace histórico `/admin/productos/alta-rapida` deja de montar una segunda ficha y **redirige**, tras comprobar rol administrador, a `/admin?producto=nuevo`. El instalador de pestañas abre `Nueva ficha` en ese caso; el motor `QuickProductEntry` sigue reutilizado dentro del ADMIN y no se duplican altas. El archivo de ruta queda como compatibilidad de enlaces antiguos, sin formulario independiente.
- Antes de subir fotografías o llamar al RPC, la ficha impide códigos de barras duplicados **dentro de la misma solicitud** (padre frente a variantes o entre variantes). La base de datos sigue comprobando duplicados contra registros existentes.
- Se reforzó el servidor simulado para reconstruir las variantes solicitadas, sus SKU de prueba, códigos, atributos, existencias y galería del producto padre. Dos pruebas de Chromium añadidas verifican alta completa con dos variantes y fotografía propia de variante, y rechazo temprano de UPC repetidos sin escrituras. Los escenarios heredados de tallas y calzado entran ahora por la ruta redirigida al mismo ADMIN.
- La carga a Storage utiliza ahora **inserción sin sobrescritura (`upsert: false`)** en rutas UUID exclusivas de la solicitud, como el cargador heredado. Ante una respuesta perdida tras un upload efectivo, el 409 de objeto ya existente permite reintentar el mismo archivo sin reemplazarlo; una tercera prueba simula esa situación. Esto reduce dependencia de permisos de UPDATE en Storage, **sin sustituir** la validación de políticas en un entorno de pruebas equivalente al real.
- El workflow CI selecciona el Chrome preinstalado en Ubuntu 24.04 para Playwright (`CHROMIUM_EXECUTABLE_PATH`) y solo descarga Chromium si no existe ese binario; se mantiene el mismo test completo de navegador. Evita instalaciones redundantes que estaban retrasando las corridas de la candidata.
- Se conserva el editor original para **productos existentes** y sus variantes, incluidos sus controles de integridad; no se modifica el mecanismo de ventas ni stock del POS. La retirada física del código obsoleto depende de una auditoría adicional de sus dependencias y queda fuera de este lote, aunque el segundo acceso visible ya desapareció.

**Puertas pendientes para release:** permisos reales equivalentes de RLS/Storage en entorno no productivo, fotos HEIC en móvil real, prueba PostgreSQL multi-sesión de generación SKU y riesgo de galería llena con operadores concurrentes. El guardado de ficha completa continúa siendo una acción de usuario con dos transacciones; no declarar atomicidad total. No aplicar la migración A3.4 ni eliminar funciones heredadas en producción sin decisión posterior.

**Primera corrida de A3.5:** [GitHub Actions #44395062707](https://github.com/corporativonexia-creator/upndowncabo/actions/runs/44395062707) **23/25 Chromium PASS, 2 NO GO**. Ambos fallos correspondieron exclusivamente al enlace legado redirigido: el instalador de pestañas activó la captura antes de que el efecto React suscribiera `updown:admin-product-view`. Se corrigió en `admin-parity.tsx` releyendo el estado real (`!host.hidden`) después de registrar el listener, manteniendo la carga diferida normal. **Requiere nueva corrida integral antes de GO.**

**Segunda corrida A3.5:** [GitHub Actions #44395891479](https://github.com/corporativonexia-creator/upndowncabo/actions/runs/44395891479) **24/25 Chromium PASS**. Ambas pruebas del enlace legado pasaron. Único caso intermitente: inyección de error al cargar el resumen opcional de variantes durante el arranque, donde la consulta podía ser reemplazada por una recarga de catálogo. La prueba ahora activa el fallo **después** de confirmar el catálogo listo y provoca explícitamente `updown:admin-products-refresh`, para validar el manejo de errores y reintento sin depender del orden de inicialización. No se cambia lógica comercial. **Pendiente de nueva matriz.**

**Tercera corrida A3.5:** [GitHub Actions #44396532292](https://github.com/corporativonexia-creator/upndowncabo/actions/runs/44396532292) **24/25 Chromium PASS**; el mismo caso de reintento de resumen opcional volvió a fallar. Se añadieron trazas acotadas **solo si falla esa prueba**, mostrando las solicitudes simuladas de variantes y los avisos en la lista, sin credenciales ni datos reales. No se modificó el algoritmo comercial para intentar ocultar la intermitencia.

**Cuarta corrida A3.5:** commit `02c272e5f6daa3a74fca95ff377f71114be33c78`, [GitHub Actions #44397560628](https://github.com/corporativonexia-creator/upndowncabo/actions/runs/44397560628) **SUCCESS**: Chromium **25/25**; contratos ADMIN **10/10**; asignación SKU en PGlite aislado **7/7**; sintaxis de scripts, TypeScript y Next build PASS; ESLint **0 errores, 9 advertencias heredadas**. El escenario de reintento pasó, pero por haber fallado en corridas anteriores, conviene confirmar su estabilidad en una corrida adicional antes de levantar cualquier bloqueo de release. Vercel reporta **cero despliegues** de esta candidata. `main` conserva `cff541a03dff8fc98437e1176dc3aef057c25562`. **GO técnico del alcance A3.5 en entorno simulado; NO GO para migración Supabase, merge o producción.**

**Repetición de estabilidad A3.5:** se ejecutó nuevamente el job `admin-ux` de [#44397560628, intento 2](https://github.com/corporativonexia-creator/upndowncabo/actions/runs/44397560628/attempts/2), con el **mismo código**, y terminó **SUCCESS**. La matriz de navegador se aprobó en dos ejecuciones sucesivas (25/25 en cada una); se conserva la traza condicional en el escenario de reintento para investigar cualquier recurrencia futura. Esto permite cerrar el QA aislado del lote sin afirmar que un resultado de CI sustituya pruebas reales de iPhone, PostgreSQL multi-sesión o políticas de Storage.

**Cierre documental A3.5:** [GitHub Actions #44402306905](https://github.com/corporativonexia-creator/upndowncabo/actions/runs/44402306905) **SUCCESS** en el commit de documentación `89ba1b7bd16f86c6cc995bbbc4492304910ccd1f`, nuevamente Chromium 25/25, contratos 10/10 y PGlite 7/7. Los tres resultados consecutivos permitieron iniciar el lote de endurecimiento siguiente sin integrar la candidata.

### A3.6 · Validación preproductiva aislada (sin conexión a Supabase real)

**Alcance:** reproducir bloqueos del asignador de SKU en transacciones PostgreSQL independientes y auditar riesgos de fotografía. No se autoriza aplicar la migración SQL, cambiar las funciones alojadas, despliegues o alteraciones comerciales.

- `tests/admin-sku-a36-concurrency.pg.cjs` usa **dos conexiones PostgreSQL reales y una tercera de observación** contra un contenedor efímero `postgres:16-alpine` en GitHub Actions. Antes de conectarse exige nombre, host, usuario, contraseña y marca de entorno **exactamente iguales a los de la base simulada**; rechaza cualquier conexión distinta. No usa secretos ni URLs de Supabase.
- Primer escenario: la transacción A genera `WED-0001` y retiene el bloqueo del contador; la conexión B debe esperar. Tras insertar y confirmar A, B omite los SKU heredados `wed-0002` y `WED-0003` presentes en el fixture y obtiene `WED-0004`. Se comprueba el contador y que ninguna consulta haya devuelto dos veces el mismo SKU.
- Segundo escenario: A genera `WED-0001-ROM` y mantiene el bloqueo de aviso transaccional; B espera. Después de insertar y confirmar A, B genera e inserta `WED-0001-ROM02`. En ambos casos se inspecciona `pg_stat_activity` para confirmar la espera real de la segunda sesión, no solo concurrencia de promesas en una sesión PGlite.
- La prueba instala solamente **tablas simuladas**, el generador histórico de sufijos y la migración candidata **en el contenedor desechable de CI**. La máscara SKU no cambia; los SKU reales no se consultan ni modifican.

**Auditoría estática de fotografía (riesgos que siguen abiertos):**

1. `QuickProductEntry` usa objetos Storage nuevos con `upsert:false`, ruta UUID de operación y de imagen, y luego inserta `product_images`. No requiere reemplazar objetos. Las políticas de `storage.objects`, el bucket `product-media` y los permisos de `product_images` **no están definidos en las migraciones inspeccionadas**, por lo que no se puede declarar RLS/Storage verificado sin un entorno de staging equivalente al real.
2. El límite de diez imágenes se verifica con una **lectura previa de la galería y una inserción posterior**. Dos operadores pueden leer nueve imágenes a la vez y añadir una cada uno, llegando a once. Sin bloqueo o restricción transaccional en servidor no existe garantía fuerte del máximo; no se altera el SQL en este lote. El campo `sort_order` también podría repetirse bajo esa carrera.
3. La interfaz acepta `.heic/.heif`, transforma a JPEG en cliente mediante `heic-to/next`, comprime y sube como `image/jpeg`; la cámara usa `capture="environment"`. **La compatibilidad en Safari/iPhone físico sigue sin prueba**, por falta de dispositivo real en el laboratorio. No confundir una prueba de Chromium con esa validación.
4. La alta completa mantiene su frontera transaccional conocida: RPC idempotente para identificadores/variantes/stock y PATCH acotado a metadatos. Reintentos tienen prueba simulada; la atomicidad total no está garantizada.

**QA A3.6:** commit `6eebb7f8574f0b34a57667c01a9bf98e80f8dc21`, [GitHub Actions #44405725515](https://github.com/corporativonexia-creator/upndowncabo/actions/runs/44405725515) **SUCCESS**: PostgreSQL 16 con sesiones independientes **2/2** (esperas de bloqueo observadas), PGlite **7/7**, contratos **10/10**, Chromium **25/25**, sintaxis, TypeScript y Next build PASS, ESLint 0 errores / 9 advertencias anteriores. **GO limitado al algoritmo SKU probado bajo estas transacciones de fixture**; no implica que todos los escritores externos de `products` y `product_variants` usen el asignador ni crea una restricción de unicidad entre tablas.

**Puertas para solicitar integración:** ejecutar una prueba de Storage y RLS en staging no productivo expresamente aprobado, validación manual de iPhone y solución transaccional del límite de galería. Ninguno de esos puntos justifica tocar datos comerciales reales o fusionar ahora.

### A3.7 · Prototipo transaccional para fotografías por UPC (SIN activar ni aplicar)

**Autorización acotada:** preparar la protección transaccional en la candidata y demostrarla con dos operadores simulados; NO ejecutar SQL en Supabase real, NO reemplazar la ruta actualmente operativa ni fusionar/desplegar.

- `tests/sql/admin-gallery-upc-append-proposal.sql` es una **propuesta de función SQL para fixture, no una migración** y no participa en los despliegues de base de datos. La CLI de Supabase no está disponible en este ejecutor para generar una migración formal; hacerlo requerirá el flujo de creación y revisión de migraciones, seguido de autorización explícita para cualquier aplicación.
- La función `admin_append_upc_photos_atomic` valida sesión y rol de administrador, acepta únicamente rutas HTTPS de fotografías UPC asociadas al `product_id`, aplica un bloqueo transaccional por producto, vuelve a consultar espacio y añade como máximo diez filas. Calcula `sort_order` dentro del bloqueo y conserva el primer `is_primary`; no toca precio, SKU, inventario ni fotografías previas. Las URLs ya registradas se reconocen como reintentos y no se duplican; un lote que excede la capacidad debe abortar completo. Es `SECURITY INVOKER`: las políticas RLS existentes siguen aplicando y se revoca el permiso de ejecución predeterminado a `PUBLIC`, concediéndolo solo a `authenticated`.
- `tests/admin-gallery-a37-concurrency.pg.cjs` instala esa propuesta en una **segunda base PostgreSQL desechable** de GitHub Actions, separada del laboratorio A3.6. Crea roles y políticas RLS de fixture y comprueba: dos operadores con nueve fotos, donde solo uno puede insertar la décima; reintento tras respuesta perdida; rechazo atómico de lote excesivo; prohibición para no administradores/anónimos; y URL ajena al producto rechazada. En ningún escenario se consulta Supabase alojado.
- **Límite intencional:** el bloqueo de aviso coordina únicamente las llamadas a este nuevo RPC. El editor heredado (`updown-admin-legacy-runtime.js`) sigue pudiendo reemplazar galerías mediante `DELETE` y `INSERT`; el motor actual de alta también inserta imágenes directamente. Por ello **no se declara resuelta la integridad global de diez fotos** mientras existan escritores que no adopten el mismo control, y no se instala un trigger global sin auditar impactos en el editor histórico. El nuevo RPC no está invocado desde React: activar la llamada antes de instalar la función rompería la captura.
- **Puerta restante:** revisar en staging equivalente la política `SELECT/INSERT` de `product_images`, autenticación, permisos y las rutas del bucket `product-media`; diseñar la transición sin ventana de incompatibilidad, y auditar los otros escritores de galería. HEIC/cámara Safari iPhone y limpieza de objetos Storage huérfanos después de un error también siguen pendientes.

**QA del prototipo A3.7:** commit `3816ef2bde056f90a22b067a80ce2fc3077c44d4`, [GitHub Actions #44409765211](https://github.com/corporativonexia-creator/upndowncabo/actions/runs/44409765211) **SUCCESS**: cinco escenarios de galería con PostgreSQL 16 y roles/RLS simulados **5/5**, SKU multi-sesión **2/2**, PGlite **7/7**, contratos **10/10**, Chromium ADMIN **25/25**, build y TypeScript PASS, ESLint cero errores y nueve advertencias heredadas. **GO únicamente para el diseño de función bajo las condiciones del fixture; NO GO para aplicar SQL, activar el cliente, migrar datos, fusionar o desplegar.**

### A3.8 · Auditoría y preparación de convivencia entre ficha única y editor histórico

**Hallazgo auditado:** el editor heredado cargaba hasta diez fotografías como estado local y, aun al modificar solo nombre o descripción, ejecutaba `DELETE` de **todas** las filas `product_images` y después las recreaba mediante un `INSERT` separado. Esto cambiaba IDs históricos innecesariamente, podía borrar una imagen por UPC añadida después de abrir el editor y perdía el registro original si la segunda operación fallaba. Además, al reconstruir como máximo diez imágenes, una galería histórica superior a diez podría perder entradas no visibles. El campo `cover_image_url` se actualiza incluso antes de esas operaciones de galería; por tanto todavía no existe consistencia transaccional entre portada y fotos.

**Ajuste quirúrgico reversible en la candidata:** se conserva una firma de la galería visible cuando se abre `Editar producto`. Al guardar, si no cambió la composición, el orden ni la imagen principal, se omite la secuencia `DELETE`/`INSERT` de fotografías. La actualización de metadatos sigue utilizando el flujo histórico; las funciones de fotografía al editar realmente una imagen continúan disponibles. El fixture ahora simula borrados para comprobar que una fotografía añadida por otro operador **permanece** tras una edición exclusivamente de metadatos. Otra prueba verifica que añadir una imagen mediante el editor antiguo sigue funcionando. No se tocó el POS, SQL alojado ni las fotografías reales.

**Riesgos aún sin resolver:** si el administrador cambia explícitamente la galería, el editor sigue sustituyendo filas con dos consultas distintas y puede sobrescribir una incorporación concurrente; las políticas RLS reales y el máximo histórico no están auditados. El RPC `admin_append_upc_photos_atomic` continúa **sin activarse**. No sustituir el flujo heredado todavía: para hacerlo con seguridad hay que serializar todos los escritores, incorporar detección de instantáneas obsoletas, revisar el comportamiento al retirar todas las fotos y coordinar la portada con la transacción de galería. Estos cambios requieren una revisión de esquema/permiso en staging y autorización de integración independiente.

**QA A3.8:** commit `f4f54d122d74be9af8aafbcda3423157c6095fee`, [GitHub Actions #44411612776](https://github.com/corporativonexia-creator/upndowncabo/actions/runs/44411612776) **SUCCESS**: Chromium **27/27** (dos escenarios nuevos de conservación/edición de galería), contratos **11/11**, galería SQL aislada **5/5**, SKU multi-sesión **2/2**, PGlite **7/7**, scripts, TypeScript y build PASS, ESLint 0 errores / 9 advertencias heredadas. **GO técnico para omitir reescrituras fotográficas sin cambios; NO GO para declarar seguro el reemplazo concurrente de galerías ni activar el RPC propuesto.**

## Requisitos Premium White
Blanco #FFFFFF; superficies #F6F8F6; verde principal #123D32; verde secundario #2F7058; lima de acento #B7DE45. Densidad operativa apropiada para tablas, filtros y POS; alertas y bajas con semántica propia.
