# UP AND DOWN Cabo · Auditoría de regresión Premium White

**Fecha:** 15 de noviembre de 2026 (hora local del proyecto)  
**Rama auditada:** `offline-premium-white-20261114`  
**Alcance:** revisión del código de la rama, controles y contratos de vista previa, diferencias con `main`, y confirmaciones previas del administrador en localhost.  
**No ejecutado:** compra real, pagos, SQL, mutaciones de inventario, despliegue Vercel, navegación automatizada en localhost.

## Veredicto

**Funcionalmente encaminado; NO aprobado aún para publicación.** Hay 28 de 30 comprobaciones de estructura/contratos con el comportamiento esperado y dos brechas explícitas:
1. Los enlaces de **Compartir** generados dentro de la vista previa dirigen al dominio público con la **ruta privada** `/vista-previa/producto/...`, que requiere sesión de administrador. A un cliente externo no le permitirán ver la ficha sin credenciales. Además, la ruta pública `/producto/...` sigue detrás de la puerta temporal de lanzamiento (`UNDER_CONSTRUCTION = true`). No habilitar enlaces públicos hasta que se planifique el lanzamiento y se apruebe la ruta de destino.
2. No existe una suite de pruebas de navegador `Playwright` para **Premium White** ejecutada en esta revisión. El repositorio sí contiene pruebas para POS y administración, pero no equivalen a una prueba integral del storefront nuevo.

**Prueba reproducible incorporada a la rama:** `tests/premium-white-contracts.cjs`; 12 comprobaciones de contratos aprobadas, 2 pendientes `TODO` (enlaces públicos y navegación E2E). Se ejecutaron en un entorno JS aislado de lectura con el contenido exacto obtenido de GitHub. Para ejecutarlas directamente desde una copia actualizada del repositorio: `node --test tests/premium-white-contracts.cjs`. Las pruebas son análisis de código; **no** cargan la tienda en un navegador, no hacen llamadas de red, no usan secretos ni venden artículos.

## Matriz de regresión

| Área | Estado | Evidencia / alcance |
|---|---|---|
| Aislamiento / permisos | **PASS estático** | `/vista-previa` y su ficha verifican `requireRole("admin")`. Los CSS añadidos se limitan a la vista previa. La comparación de ramas no muestra modificaciones de estos trabajos en runtime del POS, inventario, checkout, componentes comerciales compartidos o Supabase. |
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
| Enlaces públicos para compartir | **NO LISTO PARA CLIENTES** | El generador de la vista previa utiliza `/vista-previa/producto`, protegida para admin; `/producto` permanece redirigida a «Próximamente». |
| QA responsivo / navegadores | **Pendiente** | Faltan pruebas de interacción completa a 320, 390, 768, 1024 y 1280 px; Chrome/Safari y orientación horizontal. |

## Hallazgo y corrección de esta auditoría

**PW-QA-01 · Next Link de productos relacionados:** la adaptación previa cambiaba los atributos `href` en el DOM a localhost, pero los componentes Next.js `Link` conservan internamente su URL original. Eso podía permitir que un clic en producto relacionado utilizara nuevamente el dominio público. Se corrigió en el archivo privado `src/app/vista-previa/preview-local-product-navigation.tsx` añadiendo captura de clic en el contenedor de ficha con `preventDefault`, `stopPropagation` y `router.push` hacia la ruta local. El handler omite clics modificados, otras rutas, enlaces `target="_blank"`, descargas, y no altera las URL que se comparten.

**Estado:** revisión estática aprobada; requiere abrir un producto relacionado en localhost para confirmar de extremo a extremo.

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

- Resolver política y destino de enlaces compartidos públicos, sin exponer área privada ni habilitar la tienda antes de la fecha aprobada.
- Ejecutar pruebas Playwright específicas de Premium White contra **fixture local** y completar QA manual de carrito/variantes/móviles.
- Revisar diferencias recientes de `main` antes de integrar. La rama estaba divergente al inicio de la auditoría (un commit posterior en `main`).
- Revisar accesibilidad mínima (teclado, foco, contraste), estados vacíos y errores, y evitar cambios ajenos a lo visual.
- Obtener autorización expresa antes de integrar o desplegar.

## Qué NO se hizo

No se accedió a la computadora del usuario, no se conectó al navegador localhost, no se realizaron mutaciones de Supabase, no se ejecutó Stripe, no se modificaron las aplicaciones del POS/inventario, no se publicaron ramas y no se declararon pruebas de navegador como aprobadas.
