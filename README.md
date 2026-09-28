# UP AND DOWN · Phase 2A Foundation

Este repositorio es el primer scaffold de la migración HighLevel -> Next.js/Vercel.

## Objetivo de esta etapa

Validar, sin tocar el dominio público:

- Next.js 16.3.3
- React 19.2
- Supabase SSR por cookies
- acceso público al catálogo por RLS
- login Supabase
- guard server-side de `admin`
- guard server-side de `seller`
- lectura del `affiliate_sellers` propio
- ruta de health check

Todavía NO contiene la migración visual final del HOME/Admin.
Todavía NO sustituye las Edge Functions de Stripe productivas.
Todavía NO requiere apuntar `upndowncabo.com` a Vercel.

## 1. Instalar

PowerShell:

```powershell
npm install
```

## 2. Variables

Copia:

```powershell
Copy-Item .env.example .env.local
```

Completa al menos:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Para esta primera prueba local NO necesitas todavía completar Stripe.

`SUPABASE_SECRET_KEY` solo se usará desde servidor en etapas posteriores.
Nunca debe tener prefijo `NEXT_PUBLIC_`.

## 3. Ejecutar

```powershell
npm run dev
```

Abrir:

- http://localhost:3000
- http://localhost:3000/api/health
- http://localhost:3000/login
- http://localhost:3000/admin
- http://localhost:3000/admin-afiliados
- http://localhost:3000/vendedor

## PASS esperado

HOME:
- muestra `Supabase conectado ✓`
- muestra número real de categorías activas
- muestra número real de productos activos
- presenta hasta ocho productos reales.

`/api/health`:
```json
{
  "ok": true,
  "supabase": true,
  "active_products": 1
}
```
(el número real puede ser distinto).

Admin:
- usuario admin real entra a `/admin`
- seller no puede entrar a `/admin`.

Seller:
- usuario seller real entra a `/vendedor`
- solo puede cargar su `affiliate_sellers` debido a RLS.

## Seguridad

- La publishable key puede existir en el browser.
- La secret/service-role key nunca debe llegar al browser.
- RLS sigue siendo la autoridad de datos.
- Las dos RPC de procesamiento Stripe ya fueron restringidas a service_role en Fase 1.
- `resolve_affiliate_ref` sigue disponible a público de forma intencional.

## Siguiente etapa

Phase 2B:
1. portar el HOME oficial V9.x a componentes React manteniendo UX/diseño;
2. migrar carrito y afiliado de localStorage hacia una implementación compatible;
3. construir `/api/checkout`;
4. agregar reserva de inventario antes de crear Stripe Checkout;
5. mantener el webhook productivo hasta completar pruebas del nuevo flujo.
