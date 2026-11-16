# UP AND DOWN — Premium White | Solo estilos, sin despliegue

## Qué se hizo
La rama `offline-premium-white-20261114` parte del commit `cf373a3770d5a9379552c7fb1ed149b3a16a7c74` de `main` (14-nov-2026).

La implementación real de Premium White se compone exclusivamente de:
- `src/app/vista-previa/premium-white.css`: capa aislada de colores, tipografía, fondos, bordes, sombras y enfoque.
- `src/app/vista-previa/page.tsx`: **una línea** agregada, `import "./premium-white.css";`.

No se tocó ninguna implementación de filtros inteligentes, búsqueda, promociones, inventario, Supabase, menú, carrito, pago, scroll o fichas de producto. Se conserva la misma estructura de contenidos y el mismo orden de montaje. La ruta `/` de producción no importa este CSS.

Además, `vercel.json` de esta rama configura `git.deploymentEnabled` en `false` para esta rama y un `ignoreCommand` que omite la compilación. No crear ni promover un despliegue.

## Cómo revisar localmente en Windows
Esta **versión funcional no es un HTML de doble clic**: usa Next.js y conserva los componentes reales. Para verla necesitas ejecutar el repositorio localmente.

Abre PowerShell en una ubicación nueva, separada de cualquier carpeta de trabajo o backups:

```powershell
git clone --single-branch --branch offline-premium-white-20261114 https://github.com/corporativonexia-creator/upndowncabo.git UPNDOWN_PREMIUM_LOCAL
cd UPNDOWN_PREMIUM_LOCAL
node --version
npm ci
npm run dev
```

Si ya cuentas con una copia local del proyecto y su archivo `.env.local`, copia **solo tu propio** archivo de entorno a esta carpeta privada para poder iniciar sesión. **No lo compartas ni lo subas a GitHub.** Si no hay variables de Supabase o no inicias sesión como administrador, la ruta privada puede mostrar la página de acceso o no cargar productos.

Abre en Chrome:
`http://localhost:3000/vista-previa`

La ruta `http://localhost:3000/` permanece con el diseño original: sirve para comparar sin cambiar la tienda pública.

> Importante: los componentes que se ejecutan localmente pueden conectarse a la instancia de Supabase indicada en tu `.env.local`. Para pruebas completamente aisladas, usa una base de datos o proyecto de pruebas. En una base de producción no hagas compras, modificaciones de inventario ni otras operaciones de escritura.

## Qué debe seguir funcionando igual
- Filtro inteligente: opciones avanzadas, combinar filtros, aplicar, limpiar y mensajes sin resultados.
- Catálogo: resultados, categorías, marcas, orden, tamaño de página, vista galería/lista, navegación continua.
- Menú, buscador, ES/EN, enlaces externos y servicios.
- Fichas de producto: fotografías, variantes, descripción, precio, galería, botones, estados y notificación de carrito.
- Carrito, totalización y checkout (validación de lectura/flujo sin transacciones reales).
- Orientación horizontal, vertical, móvil y escritorio; overlays, scroll y accesibilidad.

## Verificación estática completada
- GitHub: comparado con `main`. Solo 5 archivos diferentes (README, HTML de demostración, CSS nuevo, importación en preview y `vercel.json`).
- No cambian clases ni componentes operativos, no se renombran ids ni data attributes, no cambia el orden de secciones.
- La capa blanca inicial cambió colores, tipografía y superficies. Las correcciones locales V2/V3 agregaron **solo reglas visuales responsive** de `display`, `grid-template-columns`, tamaños y espaciados, para que Lista y Noticias se vean como filas. No se cambiaron los estados ni eventos de los módulos, ni `pointer-events` o `z-index`.
- El archivo CSS tiene llaves balanceadas.
- Vercel: no hubo despliegues de esta rama al completar esta revisión.

## Mejoras UX incrementales (15-nov-2026)
- Vista **Lista**: una ficha horizontal de producto por renglón; vista **Galería** permanece separada.
- **Noticias**: una fila horizontal por noticia en móvil; las noticias administradas en Supabase siguen abriendo su lector modal original. Las noticias antiguas que utilizan `.is-expanded` conservan la expansión original.
- **Servicios**: seis opciones visibles y una tarjeta oculta de compatibilidad; fondo verde de respaldo cuando una fotografía esté pendiente, sin cambiar URLs, registros ni acciones.

Después de actualizar `premium-white.css` localmente, recarga con `Ctrl + Shift + R`. Validaciones de solo lectura en Chrome DevTools:

```javascript
getComputedStyle(document.querySelector("#udsGrid")).gridTemplateColumns
```

La salida en **Lista** debe ser una sola medida, no dos anchuras como `188px 188px`.

Para revisar si las fotos de servicios han terminado de cargar:

```javascript
console.table([...document.querySelectorAll('#udsServices .uds-service-card.has-service-photo img.uds-service-photo')].map(img=>({servicio:img.closest('[data-service-kind]')?.dataset.serviceKind,completa:img.complete,anchoNatural:img.naturalWidth})))
```

`anchoNatural` mayor que 0 confirma imagen cargada; 0 indica carga pendiente o fallida. No modificar el código de fotografías hasta conocer la causa.


## Pendientes UX — Premium White

### PW-UX-01 · Fondo blanco puro sin degradado lateral — RESUELTO (verificación móvil del usuario, 15-nov-2026)
**Reportado:** 15-nov-2026. **Contexto:** captura de localhost en móvil, tras las mejoras de Noticias, justo antes de «Quiénes somos».

**Problema observado:** aparece una franja/velo degradado gris verdoso hacia el borde derecho de las secciones de contenido (muy visible alrededor de Noticias y Quiénes somos). El fondo de la propuesta debe ser blanco puro, sin bruma, tinte ni degradado en los laterales.

**Resultado exigido:** #FFFFFF uniforme a todo lo ancho del fondo general y de las secciones neutras, sin gradiente visible en los bordes. Mantener deliberadamente los fondos gráficos de fotografías/hero, las tarjetas de servicio con fotografía, la sección verde de campos y el footer oscuro.

**Investigar antes de cambiar:** fondos, pseudo-elementos ::before y ::after, gradientes o sombras heredados en #updown-store, contenedores y secciones, .uds-shell, wrappers de vista previa, #udsJournal, #udsAbout, #udsVisit y estilos responsive en globals.css y preview-header.css. No asumir que la causa es un único background: podría ser un elemento superpuesto o una sombra. No desactivar gradientes de las imágenes por accidente.

**Intervención del 15-nov-2026:** se identificó una causa plausible y específica en el menú móvil H53 que se monta fuera de la raíz de la tienda. En `globals.css`, `#udsMobileMenu53` conserva `box-shadow: -28px 0 70px rgba(20,62,53,.18)` mientras permanece oculto con `translate3d(104%,0,0)`. Se agregó únicamente a `premium-white.css` una regla para eliminar esa sombra cuando NO tenga `.is-open`, además de fijar el fondo blanco puro solo en la vista previa. La sombra se elimina **tanto con el menú cerrado como abierto**; se conserva la funcionalidad, el panel y la capa de oscurecimiento de fondo original. **Pendiente:** comprobar en Chrome que desapareció la franja y que el menú abre/cierra bien.

**Ajuste adicional (15-nov-2026):** el primer cambio no eliminó la franja. Al revisar `globals.css` se identificaron otras dos sombras laterales persistentes: el carrito `#udsCart` (`-30px 0 90px`) y el menú móvil anterior `#udsMobileMenu` (`-24px 0 70px !important`). Se agregó en `premium-white.css` una regla de alcance privado para anular las sombras del carrito y ambos menús, abiertos o cerrados, sin alterar estados, navegación ni overlay. **Falta confirmar el resultado tras actualizar el CSS local**; no marcar cerrado hasta comprobarlo visualmente.

**Validación:** el usuario confirmó el 15-nov-2026 que, tras actualizar el CSS local con la eliminación de las tres sombras laterales, **el degradado ya no se ve** en su navegador. Incidencia cerrada para el caso móvil reportado. Quedan las comprobaciones generales de regresión a otros anchos y con los paneles abiertos.

**Criterios de aceptación:** inspeccionar a 320, 390, 440 px y escritorio; fondo blanco puro de lado a lado en los espacios sin imágenes; sin halos ni bandas verdosas al hacer scroll; contraste intacto en menú, botones, fotos, tarjetas, lector de noticias, filtro inteligente y fichas. Solo CSS, cambios aislados en premium-white.css; sin modificaciones de funciones, Supabase, POS, carrito, catálogo, orden ni despliegues.

### Próximas verificaciones de UX
1. PW-UX-01 resuelto en el móvil reportado; conservar en regresión visual con paneles abiertos y otros anchos.
2. Validar en Chrome que la vista Lista conserve una sola columna y que las noticias mantengan su lector original.
3. Continuar con revisión visual del filtro inteligente (campos, estados y controles), sin cambiar su lógica.

### PW-UX-02 · Buscador en tiempo real — Mejora visual validada por el usuario
**Reportado:** 15-nov-2026; interfaz móvil con búsqueda de productos, categorías y marcas.

**Regla de integridad:** el buscador ya consulta coincidencias automáticamente en cada cambio del texto. Conservar sin cambios las funciones `window.__UPDOWN_SEARCH_PRODUCTS__`, `window.__UPDOWN_OPEN_SEARCH_PRODUCT__`, el estado de carga, historial, filtros, contador de coincidencias, límite inicial de seis resultados, «Ver más resultados», idiomas, cerrar el diálogo y foco del teclado. No añadir botón obligatorio para ejecutar la búsqueda.

**Intervención visual:** únicamente en `premium-white.css`, reglas aisladas para el diálogo `.uds-search-panel` (fuera de la raíz de la tienda), su campo, chips y tarjetas de resultados: fondo blanco puro, contraste verde, precios más destacados, nombres legibles y objetivos táctiles apropiados. No se modificó `store-search.tsx` ni `store-search.css`.

**Validación parcial:** el usuario confirmó el 15-nov-2026 que la presentación del buscador mejoró en localhost. Conservamos como regresión pendiente: en `http://localhost:3000/vista-previa` abrir búsqueda, escribir letras de una marca o modelo, comprobar que los resultados se muestran mientras se escribe, tocar una ficha, volver, borrar texto, usar chips y «Ver más», cerrar y reabrir, y repetir en ES/EN y a 320/390/440 px. Confirmar visualmente que los controles permanecen accesibles con el teclado del teléfono abierto.

### PW-UX-03 · Filtro inteligente del catálogo — Filtro móvil rehabilitado en CSS, pruebas locales pendientes
**Fecha:** 15-nov-2026. **Ámbito:** solo estilos de `/vista-previa`, archivo `src/app/vista-previa/premium-white.css`.

**Qué cambia:** panel de filtros sobre fondo blanco puro, botón «Filtrar catálogo» más visible y con altura táctil, selects con flechas recuperadas, estados activos con contraste verde suave, campos de texto legibles, botones «Borrar filtros» / «Aplicar filtros» claros, ordenamiento y selector de Galería/Lista visualmente consistentes. En 320–760 px se ajustan paddings y tipografías sin alterar las columnas ni los estados de apertura.

**Qué NO cambia:** `#udsCatalogFilterToggle`, `#udsCatalogFilterBody`, `#udsCatalogCategory`, `#udsCatalogCondition`, `#udsCatalogBrand`, `#udsCatalogHand`, `#udsCatalogFlex`, `#udsCatalogLoft`, `#udsCatalogSort`, `#udsCatalogSearch`, `#udsCatalogClear`, `#udsCatalogApply`, `#udsClearFilters`, su JS/eventos, el filtro inteligente dinámico, reglas de disponibilidad de campos, datos, URLs, promociones, ventas o inventario. La apertura/cierre sigue bajo la clase original `.is-open`; el CSS añadido no cambia `grid-template-rows`, `display`, `opacity` ni `pointer-events` del panel.

**Corrección móvil del 15-nov-2026:** al comparar la captura de teléfono con el código se confirmó que `globals.css` todavía incluye una regla heredada `#updown-store.uds-ux-v1 #udsCatalogFilterBox {display:none!important}`. Al mismo tiempo, `mobile-storefront.tsx` oculta `.uds-discovery`, de modo que el usuario móvil no veía ningún filtro. Se añadió en el CSS de la rama privada una anulación solo para pantallas menores de 1024 px, recuperando el panel y el botón originales; cuando está cerrado, el panel conserva el colapso y cuando está abierto responde a la clase `.is-open` original. **No se modificó el código del filtro, los eventos, los valores ni los datos.**

**Validación adicional móvil:** debe aparecer el botón «Filtrar catálogo» sobre la barra de resultados. Pulsarlo debe abrir/cerrar los selectores originales, y Aplicar/Borrar debe seguir funcionando. Revisar también el caso 768–1023 px y comprobar que la vista escritorio >=1024 px no cambia.

**Pruebas locales necesarias:**
1. Ir a `http://localhost:3000/vista-previa?limit=8` y abrir «Filtrar catálogo».
2. Seleccionar categorías, condiciones, marcas y especificaciones que correspondan; comprobar que solo aparezcan las opciones aplicables.
3. Aplicar filtros; validar recuento, productos, orden y controles; después borrar y confirmar restauración.
4. Alternar Galería y Lista; cambiar número por página; confirmar que ni el filtro ni los resultados se pierden inesperadamente.
5. Revisar móviles a 320, 390 y 440 px; controles sin cortes, textos legibles, selección y cierre funcionando.
6. No completar pedidos ni modificar datos de producción desde la sesión local.

### PW-UX-04 · Autocierre suave de filtros móviles — Implementado, pendiente de verificación local

**Solicitud (15-nov-2026):** al pulsar «Aplicar filtros» o «Borrar filtros» dentro del panel del catálogo móvil, ejecutar primero la acción existente y después contraer suavemente el panel para mostrar los productos debajo.

**Implementación aislada:** archivo nuevo `src/app/vista-previa/preview-filter-auto-collapse.tsx`, importado únicamente por `src/app/vista-previa/page.tsx`. Registra un listener de clic en la fase de burbujeo del documento para los botones actuales `#udsCatalogApply` y `#udsCatalogClear` exclusivamente cuando la raíz es `#updown-store.uds-preview` y la ventana es menor de 1024 px. Tras el manejador original de los botones, elimina la clase `.is-open` y actualiza `aria-expanded`; reutiliza la animación CSS ya existente (0.25 s). Si el foco estaba dentro del panel cerrado, lo devuelve al botón de apertura.

**Protección funcional:** sin cambios en `public/updown-parity-runtime.js`, filtros, consulta a Supabase, opciones de selects, ventas, inventario ni `main`. En escritorio no cambia el comportamiento.

**Validación local:** abrir «Filtrar catálogo», seleccionar marca/categoría, pulsar «Aplicar filtros» y confirmar que se contrae suavemente mostrando resultados filtrados. Reabrir, pulsar «Borrar filtros», verificar cierre y recuperación del recuento sin filtros. Probar el control por teclado y comprobar que el botón «Filtrar catálogo» permite reabrir el panel. Asegurar que a partir de 1024 px no se aplican estos cierres.

**Actualización de copia ZIP:** esta mejora requiere descargar **dos archivos** desde la misma rama: `src/app/vista-previa/page.tsx` y `src/app/vista-previa/preview-filter-auto-collapse.tsx`. No se requiere actualizar `premium-white.css` para esta solicitud si ya se descargó la corrección móvil del filtro.

### PW-UX-05 · Búsqueda enfocada en escritorio — implementada, pendiente de validación local

**Solicitud 15-nov-2026:** en la vista normal de escritorio, los laterales blancos del buscador sobre el hero deben ser transparentes. Al confirmar una búsqueda (p.ej. `wedge`), ocultar hero, «Encuentra lo que buscas», marquesina de marcas, «Novedades y ofertas» y «Servicios», y mostrar la colección filtrada inmediatamente debajo del buscador. El buscador debe quedar pegado bajo el menú superior al desplazar la página, para permitir refinar categoría, marca y otras condiciones sin volver a subir.

**Hallazgo:** el runtime ya activa la clase `uds-search-focus` al confirmar búsquedas y ya oculta varias secciones. Sin embargo, Servicios Etapa 7 reubica `#udsServices` **entre Novedades y Colección**; antes quedaba visible y el scroll terminaba en medio de esa sección.

**Implementación:** solo en la rama `offline-premium-white-20261114`:
- Reglas CSS finales en `src/app/vista-previa/premium-white.css`, limitadas a pantallas >=1024 px y raíz `.uds-preview`: laterales transparentes sobre hero normal, ocultación de Servicios y demás secciones durante búsqueda confirmada, encabezado + buscador en dos niveles sticky, colección inmediatamente después.
- Nuevo componente cliente `src/app/vista-previa/preview-desktop-search-focus.tsx`, montado exclusivamente en `src/app/vista-previa/page.tsx`: mide la altura real del encabezado para el offset sticky y alinea el scroll al principio de los resultados tras confirmar búsqueda. No sustituye `confirmPreviewSearch`, `applyFilters` ni sus eventos; no lee ni escribe Supabase.
- El panel inteligente de escritorio mantiene los mismos inputs/selectores, contador, URL, opciones de ordenamiento y botones. Se preserva el autocierre de filtros móviles de PW-UX-04.

**Pruebas por hacer en localhost:** comprobar que al entrar sin búsqueda se ve el hero detrás de los laterales del buscador; escribir `wedge` y pulsar Buscar; confirmar que desaparecen las secciones indicadas, que la colección está justo debajo del buscador, y que el buscador permanece disponible al hacer scroll. Modificar texto, categoría/condición y pulsar Aplicar; cambiar Lista/Galería, orden y límite; usar «Cerrar búsqueda» y navegación del menú para recuperar secciones. Probar en escritorio a 1024/1280/1600 px y verificar que el móvil mantiene el modal de búsqueda en tiempo real y el panel de filtros actual. **No se han ejecutado pruebas de navegador automáticamente**, queda la validación local del usuario.

**Para actualizar ZIP local:** reemplazar `src/app/vista-previa/premium-white.css` y `src/app/vista-previa/page.tsx`; agregar `src/app/vista-previa/preview-desktop-search-focus.tsx`.

**Corrección posterior de superposición (15-nov-2026):** la captura de Chrome confirmó filtro pegado debajo del menú y colección filtrada visible (66 resultados para `wed`), pero el encabezado «Colección completa» aparecía parcialmente detrás del filtro sticky al finalizar el scroll. Se sustituyó el segundo desplazamiento suave que competía con el `scrollIntoView` original por una alineación instantánea al inicio del área de resultados; el helper también mide la altura real del encabezado y del buscador para el `scroll-margin-top` dinámico. En Premium White CSS, el catálogo aumenta el respiro superior a 42 px y se desactiva el scroll anchoring únicamente mientras la búsqueda de escritorio está activa. Se conserva el buscador pegado, todo el estado de filtros y el orden de secciones fuera de búsqueda. **Pendiente de comprobación visual tras actualizar únicamente CSS y el helper de escritorio.**

**Ajuste fino posterior:** otra captura confirmó que aún se cortaba ligeramente la descripción derecha del encabezado de colección, aunque el título izquierdo casi se veía completo. Se agregaron **34 px de separación propia** al bloque `.uds-section-head` exclusivamente en el modo de búsqueda enfocada de escritorio (`>=1024px`), para desplazar título y descripción conjuntamente debajo del buscador sticky. No se cambia el scroll, la búsqueda, ni la posición de productos o estado de filtros; queda pendiente comprobación visual local.


### PW-UX-06 · Ficha canónica independiente — estilo Premium White (por validar localmente)

**Objetivo:** mejorar visualmente la página independiente que se abre al tocar un producto en la vista previa. En este proyecto el producto **NO** abre el modal legado: el runtime `openProduct` utiliza la ruta estable `/vista-previa/producto/[productKey]`.

**Protección de producción:** la ficha independiente comparte `src/components/store/product-detail.tsx` y `product-detail.css` con la tienda normal, por lo que esos dos archivos **no se han modificado**. En la rama experimental se creó `src/app/vista-previa/producto/[productKey]/premium-product-detail.css` y se importó exclusivamente desde `src/app/vista-previa/producto/[productKey]/page.tsx`, envolviendo su contenido en `.ud-preview-product-skin`. Todos los selectores están limitados a ese contenedor privado.

**Tratamiento visual:** fondo general blanco puro, encabezado blanco, fotografía sobre superficie neutra mínima, bordes discretos, tipografía y precio legibles, botones de 44–48px, variantes y especificaciones más claras; en móvil se respetan la galería, el orden del contenido, compartir, Intercambiar/Preguntar/Carrito, productos relacionados y retorno al catálogo. No se han modificado cálculos de precio, eventos del carrito, imágenes, stock, selección de variantes, productos relacionados ni Supabase.

**Pruebas locales pendientes:** con `npm run dev`, abrir `/vista-previa`, buscar un producto, tocar su ficha y confirmar ruta independiente. Verificar a 320, 390, 440 y 1280px: imagen, controles anterior/siguiente, ampliar, título completo, precio, condición/stock, variantes (cuando existan), enlaces de intercambio y preguntas, compartir y regresar a los mismos resultados. No realizar compras ni escrituras sobre base de datos productiva durante la revisión. Para actualizar una copia ZIP, descargar **dos archivos** de la rama: `src/app/vista-previa/producto/[productKey]/page.tsx` y el nuevo `premium-product-detail.css` en la misma carpeta.

## Límites
La verificación estática no equivale a pruebas visuales o funcionales en navegador: es necesario recorrer el checklist local antes de declarar paridad funcional total.
`design/UPNDOWN_PREMIUM_WHITE_LOCAL.html` es solo una maqueta autónoma previa, no el código funcional: no usarlo para validar filtros, carrito o inventario reales.
