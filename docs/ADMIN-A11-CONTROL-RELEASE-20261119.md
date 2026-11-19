# ADMIN Premium White — corte de integración y reversión

Fecha de preparación: 19 de noviembre de 2026 (UTC; 18 de noviembre en Los Cabos).

## Árbol exacto preparado en aislamiento

- Base de `main`: `cff541a03dff8fc98437e1176dc3aef057c25562`.
- Fuente candidata: `6b694364c94f2d30abb0938cb1b9d386119b3632`.
- Rama local: `integracion/admin-premium-white-release-a11-20261119`.
- Se trasplantaron las 23 rutas de ejecución del manifiesto `ADMIN-A11-RELEASE-MANIFEST.json`, las pruebas de navegador y sus fixtures, cuatro documentos de auditoría y esta nota de control.
- Después de la autorización explícita de Aldo para el cambio SKU, se añadió **solo** la migración que reemplaza `next_category_sku` y `next_variant_sku`, así como sus pruebas de PostgreSQL aislado. No incluye ninguna instrucción de actualización de los SKU existentes.
- Excluidos deliberadamente `vercel.json`, los scripts SQL de experimentación y el workflow exclusivo de la candidata.
- La rama de release incluye una verificación propia `.github/workflows/admin-release-a11.yml` y un contrato de selección: no publica automáticamente `main`; únicamente ejecuta pruebas aisladas. **Total del corte: 35 rutas modificadas frente a `main` (23 funcionales, una migración y 11 rutas de QA/documentación).**
- **Solo preparación local: no existe PR, merge ni despliegue de esta rama.**

## Verificaciones realizadas sobre el árbol selectivo

1. Inventario de archivos: 23/23 rutas de ejecución presentes; 0 archivos prohibidos; `vercel.json` no existe en el árbol de integración.
2. `npm run check:admin-scripts`: 9 scripts, sintaxis correcta.
3. `npx tsc --noEmit`: PASS.
4. `npm run lint`: PASS con 8 advertencias heredadas y 0 errores.
5. `npm run test:pos`: 20 PASS, 1 SKIP por requerir PostgreSQL multisesión aislado.
6. `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:4319 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=fixture-publishable-key npm run build`: PASS.
7. Chromium local: **no evaluable** por una restricción del equipo (`socket(): Operation not permitted`) al iniciar el navegador. No es una regresión demostrada de la aplicación. La candidata sí pasó 62/62 pruebas de Chromium en GitHub Actions #44468096819; falta ejecutarlas sobre este árbol selectivo en un runner compatible.

## Hallazgo verificado en Supabase de producción, solo lectura

- Proyecto `upanddown` (`xlkjztcxqlsegboivccg`) sin cambios.
- El historial de migraciones alojadas no incluye `20261118202020` **antes de su aplicación autorizada**.
- La definición alojada `next_category_sku` **no** realiza la comprobación global insensible a mayúsculas de SKU en `products` y `product_variants` que incorpora la propuesta A3.4.
- La definición alojada `next_variant_sku` **no** usa el candado transaccional advisory que incorpora A3.4.
- Huellas inmutables previas: `products` 351 filas, MD5 `1ea3d74be8a23a9d516704a84864b738`; `product_variants` 499 filas, MD5 `d19ae45eea349a16a72abfe796600efe`. La consulta de referencias cruzadas indica 11 SKU compartidos entre un producto padre y una variante, 0 duplicados internos en productos, 0 en variantes, 0 prefijos de categoría repetidos. **No modificar esos 11 casos históricos; verificar los mismos hashes tras la migración.**
- Al capturar estos indicadores no se escribió ningún dato ni se ejecutó SQL de alteración.

## Decisión de lanzamiento

**Autorización específica ya concedida**, bajo ventana de negocio cerrado: Aldo permite sustituir exclusivamente las dos funciones SQL de generación SKU, integrar y publicar, y probar con registros ficticios no visibles en tienda/POS. La condición vinculante es **no cambiar ningún SKU existente** ni registros comerciales históricos. La publicación sigue condicionada a QA del árbol exacto y verificación de hashes inmediatamente después de aplicar la migración.

**Riesgos aceptados por la ventana de lanzamiento:** no existe staging Supabase independiente; la compatibilidad de RLS/Storage y HEIC de Safari debe validarse de forma operativa tras el despliegue. No se autoriza ninguna modificación adicional a esquemas, políticas RLS, permisos ni registros reales si las pruebas descubren fallas.

**Orden operativo autorizado:** (1) CI de árbol exacto de integración; (2) registrar función anterior y comparar sumas de verificación SKU; (3) aplicar exclusivamente la migración aprobada; (4) repetir sumas de verificación (deben coincidir); (5) fusionar/publicar tras QA verde; (6) ejecutar pruebas con usuarios y artículos de prueba ocultos, sin ventas reales; (7) detener y revertir el despliegue si alguna prueba esencial falla.

## Plan de corrección y reversión

- Antes del despliegue: registrar los SHA y el deployment `READY` de `main`, validar variables, permisos, URL y el camino de regreso. El deployment de referencia de Vercel es `upndowncabo-7vuklje4b-nexia10.vercel.app` (`cff541a0`, READY).
- Después del despliegue autorizado: smoke test de sesión ADMIN, ficha única, variantes, consulta UPC/nombre, fotografía, inventario, pedidos, taller y POS; **sin ventas, bajas o alteraciones comerciales reales**.
- Ante error funcional del frontend: detener operación de la funcionalidad afectada, revertir o promover deployment anterior de Vercel y validar `/admin` y `/pos`; corregir en rama aislada y volver a correr CI antes de republicar.
- Ante error de SQL, SKU o integridad: **no realizar una reversión SQL ciega**; detener altas, revisar logs y transacciones, comparar estado previo y solicitar autorización específica para reparación de base. No eliminar ni modificar registros históricos como remedio rápido.
- Works puede preparar y verificar el parche, pero no garantiza por sí solo recuperación automática de datos ni permiso para operar en producción.
