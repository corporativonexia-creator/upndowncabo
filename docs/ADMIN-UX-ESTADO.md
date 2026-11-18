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

Estado: **A3.1 en preparación/QA local, NO completa la retirada de Alta rápida**.

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

## Requisitos Premium White
Blanco #FFFFFF; superficies #F6F8F6; verde principal #123D32; verde secundario #2F7058; lima de acento #B7DE45. Densidad operativa apropiada para tablas, filtros y POS; alertas y bajas con semántica propia.
