# UP AND DOWN Cabo · Auditoría de regresión Premium White

**Fecha:** 15 de noviembre de 2026 (hora local del proyecto)  
**Rama auditada:** `offline-premium-white-20261114`  
**Alcance:** revisión del código de la rama, controles y contratos de vista previa, diferencias con `main`, y confirmaciones previas del administrador en localhost.  
**No ejecutado:** compra real, pagos, SQL, mutaciones de inventario, despliegue Vercel, navegación automatizada en localhost.

## Veredicto

**Enlaces públicos corregidos y preparados para el lanzamiento; NO se ha autorizado publicación.** Tras la corrección PW-QA-02, 29 de las 30 comprobaciones iniciales están conformes. Sigue pendiente una validación E2E de navegador para la tienda completa. Las rutas de compartir ahora utilizan `/producto/[productKey]`, el destino público permanente; las rutas de navegación privada siguen usando `/vista-previa/producto/[productKey]`. **Actualmente el acceso público aún redirige a «Próximamente»** por el bloqueo de lanzamiento (`UNDER_CONSTRUCTION = true`). Esta separación queda lista para funcionar cuando se autorice abrir la tienda, sin volver a editar los enlaces compartidos.

**Prueba reproducible incorporada a la rama:** `tests/premium-white-contracts.cjs`; 14 pruebas de contratos y URL aprobadas, 1 pendiente `TODO` (navegación E2E con navegador). Se ejecutaron en un entorno JS aislado de lectura con el contenido exacto obtenido de GitHub. Para ejecutarlas directamente desde una copia actualizada del repositorio: `node --test tests/premium-white-contracts.cjs`. Las pruebas son análisis de código; **no** cargan la tienda en un navegador, no hacen llamadas de red, no usan secretos ni venden artículos.

## Matriz de regresión

| Área | Estado | Evidencia / alcance |
|---|---|---|
| Aislamiento / permisos | **PASS estático** | `/vista-previa` y su ficha verifican `requireRole("admin")`. El CSS de portada solo se usa en vista previa; la ficha Premium White utiliza una hoja compartida por la ficha privada y la pública. Los cambios actuales del runtime se limitan a generar URLs públicas para compartir, y los del componente ProductDetail a utilizar la ruta pública permanente. No se modificaron POS, inventario, checkout, ni Supabase. |
| Búsqueda en tiempo real | **PASS estático + aceptación visual previa** | La ventana React consume `__UPDOWN_SEARCH_PRODUCTS__`, que entrega resultados mientras se escribe; cada elemento usa `__UPDOWN_OPEN_SEARCH_PRODUCT__`. |
| Filtros móviles y cierre | **PASS estático + usuario validó** | Botones originales aplican/limpian filtros. El helper privado retira `.is-open` tras el clic, actualiza `aria-expanded` y devuelve el foco. |
| Búsqueda enfocada en escritorio | **PASS estático + usuario validó visual** | `uds-search-focus` oculta hero, categorías, logos, novedades y servicios; la barra queda sticky y la colección inmediatamente después. |
| Galería/Lista, ordenamiento, paginado | **PASS de contrato; falta E2E** | El runtime conserva las clases de Lista/Galería, `movePreviewCatalogPage` y los selectores de ordenamiento. No se probó con cada combinación real. |
| Fichas independientes / localhost | **PASS de contrato + usuario validó** | El evento de navegación se redirige a `router.push` local. No se reactivó el antiguo modal. |
| Variantes y relacionados en localhost | **Corrección aplicada; falta prueba E2E** | Se interceptan clics de links de fichas dentro del contenedor privado ANTES del manejador Next Link, sin afectar clic con Ctrl/Cmd o nueva pestaña; prefetch y atributos href también se localizan. |
| Carrito: +1, sumar/restar/eliminar | **PASS estático; falta prueba E2E** | Runtime y ficha usan `upDownCart`, suman una unidad por clic, limitan por existencias; la ficha emite `updown:cart-update`. No se validó la interfaz de carrito con datos reales. |
| Precios/stock de variantes | **PASS estático; falta prueba E2E** | `reconcilePreviewCart` relee `product_variants` y `products`, actualiza stock/precio y limita cantidades; la ficha bloquea añadir un padre con variantes sin elegir la variante. |
| Checkout / Stripe | **BLOQUEADO por diseño** | En vista previa, salvo flag explícito habilitado, el botón conduce a consulta de WhatsApp; no se ha realizado ni autorizado prueba de cobro real. |
| Noticias | **Aceptación visual del usuario** | Una noticia por renglón en móvil. Sigue pendiente validar lector/expansión y cerrar artículos con teclado. |
| Servicios | **PASS estático; falta E2E** | Stage 7 solo actúa dentro de `.uds-preview`, posiciona sección y presenta seis tarjetas. Pendiente prueba de enlaces y acordeones. |
| Idiomas ES/EN | **PASS estático; falta E2E** | Runtime y modal tienen traducciones y listeners. No se recorrieron todas las etiquetas en dos idiomas. |
| Enlaces públicos para compartir | **LISTO EN CÓDIGO; APERTURA PENDIENTE** | WhatsApp, Copiar enlace y Compartir usan `https://upndowncabo.com/producto/[productKey]`; conservan referencia de vendedor y variante. La ficha privada sigue navegando localmente. La puerta «Próximamente» impide el acceso público hasta autorización del lanzamiento. |
| QA responsivo / navegadores | **Pendiente** | Faltan pruebas de interacción completa a 320, 390, 768, 1024 y 1280 px; Chrome/Safari y orientación horizontal. |

## Hallazgo y corrección de esta auditoría

**PW-QA-01 · Next Link de productos relacionados:** la adaptación previa cambiaba los atributos `href` en el DOM a localhost, pero los componentes Next.js `Link` conservan internamente su URL original. Eso podía permitir que un clic en producto relacionado utilizara nuevamente el dominio público. Se corrigió en el archivo privado `src/app/vista-previa/preview-local-product-navigation.tsx` añadiendo captura de clic en el contenedor de ficha con `preventDefault`, `stopPropagation` y `router.push` hacia la ruta local. El handler omite clics modificados, otras rutas, enlaces `target="_blank"`, descargas, y no altera las URL que se comparten.

**Estado:** revisión estática aprobada; requiere abrir un producto relacionado en localhost para confirmar de extremo a extremo.

### PW-QA-02 · Enlaces públicos permanentes y diseño Premium White compartido

**Solicitud del administrador:** dejar preparadas las fichas públicas desde esta fase privada para no volver a modificar sus enlaces al publicar.

**URLs, identidad y atribución:**
- Los botones de **Compartir**, **WhatsApp** y **Copiar enlace** generan ahora `https://upndowncabo.com/producto/[productKey]`, incluyendo `?ref=CODIGO` cuando existe una referencia válida.
- El identificador UUID del producto o de la variante (prefijo `--p-` o `--v-`) es el mismo en la ficha privada y pública. Los títulos pueden variar sin perder el identificador estable.
- Los clics de navegación del catálogo, el prefetch, las variantes y los productos relacionados dentro de `/vista-previa` siguen usando las rutas privadas; los botones públicos de compartir no envían a esa zona.
- La página pública `src/app/producto/[productKey]/page.tsx` ya existía con OG/Twitter, ficha, datos estructurados y productos relacionados. Ahora usa el mismo `src/components/store/premium-product-detail.css` que la ficha privada. El CSS duplicado de la ruta privada se eliminó.

**Código afectado:** `public/updown-parity-runtime.js` (solo separa URL de navegación vs compartir para modo preview), `src/components/store/product-detail.tsx` (share URL pública; enlace interno de variantes sin cambios), `src/components/store/premium-product-detail.css` (nuevo compartido), ambas páginas de producto y helper de navegación localhost. `product-share.ts`, `product-metadata.ts`, `proxy.ts`, Supabase, carrito y checkout permanecen intactos.

**Prueba offline:** 14 contratos aprobados, incluyendo una ejecución de la función de URL con un producto padre y una variante, validando que se conserva `UUID` y `ref` entre las dos rutas. Sigue pendiente validación E2E en navegador y comprobación de tarjetas sociales tras abrir el dominio al público.

**Limitación temporal esperada:** una URL pública copiada hoy redirigirá a `/proximamente`; es la barrera de lanzamiento, no un error del enlace ni una indicación de que hay que dar credenciales de administrador al cliente.

## Prueba final segura en localhost

Sin realizar pagos, sin gestionar inventario y sin usar credenciales de terceros:

1. Acceder como administrador a `http://localhost:3000/vista-previa`; buscar «wedge» y confirmar la sección Colección debajo del filtro sticky en escritorio.
2. Cambiar Ordenar, Galería/Lista y la cantidad por página; comprobar que se mantienen resultados y navegación.
3. En móvil abrir «Filtrar catálogo», establecer marca/categoría, aplicar, confirmar autocierre y resultados; reabrir y borrar.
4. Abrir ficha independiente; verificar que permanece en `localhost:3000`, que las fotos, texto, precio y selección de variantes tienen sentido.
5. Abrir producto relacionado y variante; confirmar que también permanecen en localhost (corrección PW-QA-01).
6. Con datos de prueba y sin dar clic a pagar: agregar **una unidad**, agregar otra, restar, eliminar; confirmar cantidades, límites de stock y persistencia entre catálogo y ficha.
7. Abrir artículo de noticias, cerrarlo y validar los seis servicios, incluidos enlaces y acordeones.
8. Cambiar ES/EN y repetir búsqueda, filtros, ficha y navegación.
9. Comprobar vistas 320, 390, 768, 1024 y 1280 px; también móvil horizontal.
10. No abrir la ruta de cobro ni confirmar pagos de prueba contra el entorno comercial. El checkout está fuera del alcance.

## Criterios de salida para publicar (no cumplidos todavía)

- **Resuelto en código:** las URL para clientes apuntan a `/producto/[productKey]` y su apariencia coincide con Premium White. Al lanzar solo se abrirá la puerta general de la tienda según el proceso autorizado, sin cambiar el generador de enlaces. Validar metadatos sociales con el dominio público tras abrir la tienda.
- Ejecutar pruebas Playwright específicas de Premium White contra **fixture local** y completar QA manual de carrito/variantes/móviles.
- Revisar diferencias recientes de `main` antes de integrar. La rama estaba divergente al inicio de la auditoría (un commit posterior en `main`).
- Revisar accesibilidad mínima (teclado, foco, contraste), estados vacíos y errores, y evitar cambios ajenos a lo visual.
- Obtener autorización expresa antes de integrar o desplegar.

## Qué NO se hizo

No se accedió a la computadora del usuario, no se conectó al navegador localhost, no se realizaron mutaciones de Supabase, no se ejecutó Stripe, no se modificaron las aplicaciones del POS/inventario, no se publicaron ramas y no se declararon pruebas de navegador como aprobadas. Se editaron puntualmente los generadores de enlaces del storefront, no los procesos de cobro.
