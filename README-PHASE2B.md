# UP AND DOWN · Phase 2B.1 · HOME Parity Build

Esta fase monta el HOME oficial V9.x dentro de la nueva aplicación Next.js/Vercel.

## Qué conserva

- Identidad visual oficial marfil / verde / dorado.
- Hero cinematográfico y hero móvil.
- Header inmersivo y navegación móvil.
- Filtros de búsqueda/categoría/condición/marca/mano/flex/loft.
- Coque's Picks y colecciones rápidas.
- Recién llegados.
- Categorías dinámicas desde Supabase.
- Catálogo dinámico desde Supabase.
- Modal de producto y galería de hasta 10 imágenes.
- Carrito en localStorage y conciliación de precio/stock.
- ES/EN.
- Afiliado `?ref=` por 30 días usando `resolve_affiliate_ref`.
- Golf Advisor con teléfono del vendedor.
- WhatsApp contextual.
- Servicios UP AND DOWN.
- Agenda HighLevel existente.
- Directorio de campos.
- Noticias.
- Barra de beneficios y footer.
- Mobile dock.

## Seguridad de esta preview

El checkout real está apagado por defecto:

```env
NEXT_PUBLIC_ENABLE_LEGACY_CHECKOUT=false
```

Aunque agregues productos al carrito, pulsar Finalizar compra solo mostrará un aviso. Esto es intencional: la siguiente fase agrega reserva temporal de inventario antes de reactivar Stripe en la nueva arquitectura.

## Cómo usarlo sobre Phase 2A

Puedes usar el ZIP completo y copiar tu `.env.local` de Phase 2A, o aplicar el patch incluido.

Después:

```powershell
npm run dev
```

Abre:

- http://localhost:3000
- http://localhost:3000/admin
- http://localhost:3000/api/health

## Pruebas PASS para HOME

1. Hero y header cargan con el diseño oficial.
2. Los 3 productos activos aparecen desde Supabase.
3. Los productos con stock 0 muestran agotado y no se agregan al carrito.
4. Búsqueda y filtros funcionan.
5. Click en producto abre detalle/galería.
6. Carrito persiste al recargar.
7. ES/EN cambia contenido comercial.
8. `/?ref=CODIGO_VALIDO` muestra el Golf Advisor correspondiente.
9. WhatsApp del Advisor usa el teléfono del vendedor cuando existe.
10. Servicios y Noticias expanden/cierra una card a la vez.
11. Móvil no desborda horizontalmente.
12. Checkout permanece apagado en localhost.

## Nota de arquitectura

Phase 2B.1 es una **parity bridge**: Next.js ya posee el shell, variables, Auth y rutas; el HOME conserva temporalmente el runtime comercial V9.x para obtener paridad exacta antes de desarmarlo en componentes React independientes. Esto reduce el riesgo de cambiar simultáneamente diseño, comportamiento y backend.

Phase 2C reemplazará progresivamente este runtime por React state/components y añadirá reserva de inventario + checkout server-side.
