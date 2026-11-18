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

## Requisitos Premium White
Blanco #FFFFFF; superficies #F6F8F6; verde principal #123D32; verde secundario #2F7058; lima de acento #B7DE45. Densidad operativa apropiada para tablas, filtros y POS; alertas y bajas con semántica propia.
