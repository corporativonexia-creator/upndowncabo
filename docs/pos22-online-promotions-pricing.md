# POS 2.2 — Promociones programadas en tienda online

**Estado:** cambios aislados en PR #28. **NO** implementado en producción.

## Regla autorizada
Para cada producto y variante publicada:
1. Precio base = precio especial de esa variante si está vigente/configurado y es menor que su precio regular; de lo contrario, precio regular de la variante, o de su padre cuando la variante no tiene precio propio.
2. De las promociones activas y habilitadas del admin POS 2.2 (categoría, SKU o código de barras), se aplica **una sola**, la de mayor porcentaje. Una promoción puede coincidir por identificador del artículo o del padre; empates se resuelven determinísticamente.
3. Precio online = redondeo a centavos de `precio base × (1 − porcentaje / 100)`.
4. Si existe reducción, se muestra el **precio regular tachado**, el precio online destacado, y etiqueta `-X%` cuando la reducción corresponde a una campaña programada. El porcentaje es el de la campaña, no necesariamente el ahorro total frente al precio regular.
5. El carrito conserva **el precio final online** y al abrir y antes de checkout revalida inventario, producto/variante y campañas.
6. La reserva de inventario de Stripe **recalcula en PostgreSQL** el precio sobre el catálogo y la campaña vigente; nunca acepta el precio enviado por el navegador. Se conservan las validaciones, reservas y pagos existentes.
7. La vigencia usa fecha local `America/Mazatlan`. La RPC pública expone **solo** título, target, código y descuento de campañas activas/vigentes; no publica campañas programadas para el futuro, inactivas, ni información administrativa.
8. Promociones manuales de cajero y descuento general por **ticket** siguen siendo mecanismos de POS. La tienda online aplica las **promociones automáticas programadas**, no un porcentaje general manual de una caja.

| Regular | Especial | Campaña | Precio visible / carrito / servidor |
|---:|---:|---:|---:|
| $1,000 | $900 | 20% | **$720**, tachado $1,000 y badge -20% |
| $1,000 | — | 20% | **$800**, tachado $1,000 y badge -20% |
| $1,000 | $900 | — | **$900**, tachado $1,000 sin badge |
| $1,000 | — | — | **$1,000**, sin tachado |

## Componentes modificados
- `public/updown-parity-runtime.js`: catálogo, cards, modal, ofertas, ordenamiento, carrito, revalidación.
- `src/lib/storefront/online-pricing.ts`: regla común en servidor.
- `src/lib/storefront/get-shareable-product.ts`: ficha independiente y precio que llega al botón carrito.
- `src/lib/storefront/get-related-products.ts` y su rail: precios y badges en relacionados.
- `supabase/migrations/20261113093000_pos22_storefront_campaign_checkout.sql`: lectura pública controlada y precio de reservas Stripe V1/V2.
- `tests/pos/pos22-online-promotions.cjs`, `tests/pos/pos22-transactions.cjs`: pruebas aisladas con PostgreSQL 17.

## Puerta de producción / precauciones
- **No desplegar frontend sin aplicar primero la migración nueva** y las tres migraciones anteriores POS 2.2, en orden y bajo ventana autorizada.
- La vista previa del código se mantiene navegable antes del despliegue SQL, sin inventar campañas; no significa que ya pueda demostrar promociones activas contra producción.
- Verificar permisos de ejecución anon/autenticado de la RPC pública, existencia de reglas de categoría, vencimiento, activación/desactivación y tiempo local.
- Requiere revisar el feature flag `UPDOWN_CHECKOUT_V2_ENABLED`: por seguridad el checkout de variantes V2 sigue bloqueado hasta aprobación separada; **este PR no lo habilita**.
- Tras habilitar un checkout en el futuro, comprobar una reserva y una sesión Stripe reales en entorno de ensayo con credenciales de prueba; no crear pagos reales para validar.
- No copiar funciones históricas de reserva desde una base de pruebas hacia producción si el esquema y firmas reales han cambiado. La migración del PR debe volver a auditarse contra el esquema de producción en el momento de la liberación.
