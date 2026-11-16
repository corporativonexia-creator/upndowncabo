# UP AND DOWN Cabo · Servicios unificados (16 de noviembre de 2026)

## Autorización y límites
El administrador autorizó expresamente unificar los servicios del administrador y del catálogo Premium White, fusionar Reparación + Mantenimiento, eliminar después de respaldar los registros `maintenance` y `putter-restoration`, incorporar `lie-loft-adjustment` y conservar el flujo protegido de Clases.

**Alcance:** cambios de datos autorizados en el proyecto Supabase `upanddown` (ref `xlkjztcxqlsegboivccg`) y cambios de código ÚNICAMENTE en la rama `offline-premium-white-20261114`. **Sin despliegues a Vercel, sin integración a main, sin mutaciones del POS/inventario/checkout.**

## Respaldo y transacción
- Respaldo de las 7 filas originales, con TODOS los campos: `design/backups/storefront_services_20261116_pre_unification.json`.
- SQL DML histórico, atómico, con bloqueo temporal, validación de claves y `updated_at` contra el respaldo, controles finales y `COMMIT`: `design/sql/STORE_SERVICES_SIX_UNIFICATION_20261116_ONE_TIME.sql`. **No volver a ejecutar:** el guardado inicial exige los siete registros originales.
- Fotografías originales de los servicios eliminados: **no se eliminó ningún objeto de Supabase Storage**. Las rutas están en el respaldo, para recuperación si se requiere.
- No hay relaciones mediante claves foráneas hacia `public.storefront_services`; las clases mantienen trigger de protección y no se tocaron.

## Resultado definitivo en Supabase

| Índice | Clave | Título ES | Título EN | Foto | Contacto |
|---|---|---|---|---|---|
| 1 | `repair` | Reparación y mantenimiento | Repair and maintenance | Conservada | WhatsApp equipo general, con atribución |
| 2 | `trade` | Intercambios y consignación | Trade-ins and consignment | Conservada | WhatsApp equipo general, con atribución |
| 3 | `lie-loft-adjustment` | Ajuste de lie y loft | Lie and loft adjustment | Ninguna | Sin CTA: «PRÓXIMAMENTE» |
| 4 | `classes` | Clases de golf | Golf lessons | Conservada | Formulario e instructores protegidos |
| 5 | `ghin` | GHIN | GHIN | Conservada | WhatsApp original GHIN, sin atribución |
| 6 | `27a30f4f-018e-460a-9b7d-b1dc1488143f` | Restauración y personalización | Restoration and customization | Conservada | Instagram VS GOLF original |

Los dos registros deprecados `maintenance` y `putter-restoration` se eliminaron **solo después del respaldo completo**. El contenido comercial de reparación y mantenimiento ahora reside en la fila `repair`; la restauración de putters y wedges permanece en el servicio independiente VS GOLF.

## Registros nuevos y actualización

- `repair`: copia bilingual Premium White (Cambio de grips, Cambio de varilla, Limpieza profunda), descripción y nota del estado aprobado, WhatsApp general adaptado a reparación o mantenimiento.
- `trade`: copia bilingual Premium White sobre intercambio/consignación, valoración y términos, WhatsApp actualizado.
- `lie-loft-adjustment`: nombre, «PRÓXIMAMENTE/COMING SOON», descripción, punto informativo, nota; `is_active=true` para que se muestre, `image_url=NULL`, etiquetas y URL de CTA vacías, `use_referral=false`.
- `classes`: sin modificación de ningún campo ni de `updated_at`.
- `ghin`: solo cambia el índice al 5.
- VS GOLF: cambia al índice 6 y se actualizan título/subtítulo ES/EN; foto, enlace y nota originales conservados.

## Sincronización Admin ↔ Web

1. `public/updown-parity-runtime.js` sigue siendo el lector de `storefront_services` con filtro `is_active` y orden `sort_order,key`; ahora el **submenú móvil de servicios** se construye con esas mismas filas activas en el idioma actual, usando claves estables y `__UPDOWN_OPEN_SERVICE__`. El acceso «Mantenimiento» o «Restauración de Putters» ya no se genera por código.
2. `public/updown-preview-services-stage7.js` ya no contiene diccionarios que sustituyan título, eyebrow, descripción, bullets o CTA, ni oculta un servicio «fusionado». Aplica únicamente maquetación, posición de sección, clase visual «Próximamente» al leer el subtítulo de la tarjeta sin CTA y distinción VS GOLF por su clave estable. El orden procede de las filas publicadas por el runtime.
3. `src/components/store/storefront-parity.tsx` actualiza versiones de scripts de vista previa y pública para evitar caché anterior.
4. `src/components/admin/services-admin.tsx` continúa leyendo/editando `storefront_services` por `key`. Clases permanece protegida por el trigger de la base de datos.
5. `tests/premium-white-contracts.cjs` añade condiciones para impedir que reaparezcan títulos o accesos de servicios codificados a mano.

## Verificación posterior (lecturas directas de Supabase)

**Aprobado:** seis filas, seis `is_active=true`, índices 1–6 únicos, cero registros eliminados remanentes, nuevo Lie & Loft con `NULL` de fotografía y ambos CTA vacíos; `classes` idéntica al respaldo (incluye fecha `updated_at`), fotos previas conservadas, enlace GHIN sin cambios, enlace VS GOLF sin cambios y referidos de `repair/trade` intactos.

**Código:** 16 pruebas estáticas de contrato aprobadas (sin errores); comprobación sintáctica de ambos scripts JS aprobada.

**Pendiente en el equipo local:** importar `public/updown-parity-runtime.js`, `public/updown-preview-services-stage7.js` y `src/components/store/storefront-parity.tsx` de esta rama; reiniciar `npm run dev` si fuese necesario, recargar en Chrome con Ctrl+Shift+R y confirmar 6 tarjetas en PC/móvil, en ES/EN, menús móviles, enlaces y servicios por nombre. La auditoría visual E2E no pudo ejecutarse en el localhost del usuario.

## Importante para futuras versiones

No mezclar servicios del catálogo con `pos_service_receptions` (recepción operativa de taller). Son procesos diferentes. No incorporar el SQL de este documento a las migraciones de despliegue; fue ejecutado una vez en el proyecto real. Dejar fuera de `main` cualquier copia de seguridad interna si el repositorio cambia su visibilidad pública. En caso de fallo de lectura de Supabase, el HTML legado puede presentar datos provisionales hasta que el runtime cargue; revisar este estado antes del lanzamiento.
