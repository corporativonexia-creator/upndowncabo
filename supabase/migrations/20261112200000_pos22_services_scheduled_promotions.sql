-- POS 2.2: servicios con precio bajo demanda y promociones programadas.
-- Se aplica antes de activar el nuevo checkout; no modifica ventas históricas.
begin;

alter table public.products add column if not exists is_service boolean not null default false;

create table if not exists public.pos22_promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 3 and 120),
  target_type text not null check (target_type in ('category','sku','barcode')),
  target_value text not null check (length(btrim(target_value)) between 1 and 120),
  discount_percent numeric(5,2) not null check (discount_percent > 0 and discount_percent < 100),
  starts_on date not null,
  ends_on date not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  constraint pos22_promotion_date_order check (starts_on <= ends_on)
);
create index if not exists idx_pos22_promotion_schedule
  on public.pos22_promotions(enabled,starts_on,ends_on,target_type,target_value);
alter table public.pos22_promotions enable row level security;
revoke all on public.pos22_promotions from public, anon;
grant select,insert,update,delete on public.pos22_promotions to authenticated;
drop policy if exists pos22_promo_read on public.pos22_promotions;
create policy pos22_promo_read on public.pos22_promotions for select to authenticated using (true);
drop policy if exists pos22_promo_add on public.pos22_promotions;
create policy pos22_promo_add on public.pos22_promotions for insert to authenticated
 with check (public.is_admin());
drop policy if exists pos22_promo_edit on public.pos22_promotions;
create policy pos22_promo_edit on public.pos22_promotions for update to authenticated
 using (public.is_admin()) with check (public.is_admin());
drop policy if exists pos22_promo_remove on public.pos22_promotions;
create policy pos22_promo_remove on public.pos22_promotions for delete to authenticated
 using (public.is_admin());

-- No se inventa inventario: los productos de servicio tienen stock cero permanentemente.
-- El producto sigue siendo el identificador contable del renglón del ticket.
create or replace function public.pos22_admin_create_service(
  p_name text, p_category_id uuid
) returns jsonb
language plpgsql security definer set search_path=''
as $service$
declare v_id uuid; v_slug text; v_product public.products%rowtype;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;
  if length(btrim(coalesce(p_name,''))) not between 2 and 180 then
    raise exception 'SERVICE_NAME_REQUIRED';
  end if;
  if not exists(select 1 from public.categories
                where id=p_category_id and is_active=true) then
    raise exception 'CATEGORY_REQUIRED';
  end if;
  v_id:=gen_random_uuid();
  v_slug:='servicio-'||substr(replace(v_id::text,'-',''),1,16);
  insert into public.products(id,category_id,name,slug,price,stock,
      status,currency,online_visible,pos_visible,is_service,
      short_description,specifications)
    values(v_id,p_category_id,btrim(p_name),v_slug,0,0,
      'active','MXN',false,true,true,
      'Servicio con importe capturado al cobrar',
      jsonb_build_object('pos_service',true))
    returning * into v_product;
  -- SKU y EAN-13 asignados por el trigger existente product_auto_identifiers.
  return jsonb_build_object('id',v_product.id,'name',v_product.name,
    'sku',v_product.sku,'barcode',v_product.barcode,
    'category_id',v_product.category_id);
end;
$service$;
revoke all on function public.pos22_admin_create_service(text,uuid) from public,anon;
grant execute on function public.pos22_admin_create_service(text,uuid) to authenticated;

-- Solo una promoción automática por artículo: mayor porcentaje gana.
-- Descuentos manuales y generales son capas adicionales controladas por el POS.
create or replace function public.pos22_match_promotion(
  p_product_id uuid, p_variant_id uuid default null
) returns jsonb
language sql stable security invoker set search_path=''
as $promo$
 select jsonb_build_object('id',pr.id,'title',pr.title,
         'percent',pr.discount_percent)
 from public.products p
 left join public.product_variants v on v.id=p_variant_id and v.product_id=p.id
 join public.pos22_promotions pr on pr.enabled=true
   and (now() at time zone 'America/Mazatlan')::date between pr.starts_on and pr.ends_on
   and (
    (pr.target_type='category' and pr.target_value=p.category_id::text)
    or (pr.target_type='sku' and
       upper(btrim(pr.target_value)) in (upper(coalesce(p.sku,'')),upper(coalesce(v.sku,''))))
    or (pr.target_type='barcode' and
       btrim(pr.target_value) in (coalesce(p.barcode,''),coalesce(v.barcode,'')))
   )
 where p.id=p_product_id
 order by pr.discount_percent desc, pr.created_at, pr.id
 limit 1
$promo$;
revoke all on function public.pos22_match_promotion(uuid,uuid) from public,anon;
grant execute on function public.pos22_match_promotion(uuid,uuid) to authenticated;

commit;
