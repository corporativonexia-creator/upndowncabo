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

### PW-UX-01 · Fondo blanco puro sin degradado lateral — P1 / Implementado en rama; pendiente validación visual
**Reportado:** 15-nov-2026. **Contexto:** captura de localhost en móvil, tras las mejoras de Noticias, justo antes de «Quiénes somos».

**Problema observado:** aparece una franja/velo degradado gris verdoso hacia el borde derecho de las secciones de contenido (muy visible alrededor de Noticias y Quiénes somos). El fondo de la propuesta debe ser blanco puro, sin bruma, tinte ni degradado en los laterales.

**Resultado exigido:** #FFFFFF uniforme a todo lo ancho del fondo general y de las secciones neutras, sin gradiente visible en los bordes. Mantener deliberadamente los fondos gráficos de fotografías/hero, las tarjetas de servicio con fotografía, la sección verde de campos y el footer oscuro.

**Investigar antes de cambiar:** fondos, pseudo-elementos ::before y ::after, gradientes o sombras heredados en #updown-store, contenedores y secciones, .uds-shell, wrappers de vista previa, #udsJournal, #udsAbout, #udsVisit y estilos responsive en globals.css y preview-header.css. No asumir que la causa es un único background: podría ser un elemento superpuesto o una sombra. No desactivar gradientes de las imágenes por accidente.

**Intervención del 15-nov-2026:** se identificó una causa plausible y específica en el menú móvil H53 que se monta fuera de la raíz de la tienda. En `globals.css`, `#udsMobileMenu53` conserva `box-shadow: -28px 0 70px rgba(20,62,53,.18)` mientras permanece oculto con `translate3d(104%,0,0)`. Se agregó únicamente a `premium-white.css` una regla para eliminar esa sombra cuando NO tenga `.is-open`, además de fijar el fondo blanco puro solo en la vista previa. Al abrir el menú sigue utilizando su sombra original. **Pendiente:** comprobar en Chrome que desapareció la franja y que el menú abre/cierra bien.

**Criterios de aceptación:** inspeccionar a 320, 390, 440 px y escritorio; fondo blanco puro de lado a lado en los espacios sin imágenes; sin halos ni bandas verdosas al hacer scroll; contraste intacto en menú, botones, fotos, tarjetas, lector de noticias, filtro inteligente y fichas. Solo CSS, cambios aislados en premium-white.css; sin modificaciones de funciones, Supabase, POS, carrito, catálogo, orden ni despliegues.

### Próximas verificaciones de UX
1. Diagnosticar y corregir PW-UX-01.
2. Validar en Chrome que la vista Lista conserve una sola columna y que las noticias mantengan su lector original.
3. Continuar con revisión visual del filtro inteligente (campos, estados y controles), sin cambiar su lógica.

## Límites
La verificación estática no equivale a pruebas visuales o funcionales en navegador: es necesario recorrer el checklist local antes de declarar paridad funcional total.
`design/UPNDOWN_PREMIUM_WHITE_LOCAL.html` es solo una maqueta autónoma previa, no el código funcional: no usarlo para validar filtros, carrito o inventario reales.
