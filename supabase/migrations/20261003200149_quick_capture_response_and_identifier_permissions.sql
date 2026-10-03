-- Return current identifiers after variant synchronization.
create or replace function public.admin_quick_product_create(
  p_request_id uuid,p_name text,p_category_id uuid,p_price numeric,
  p_barcode text default null,p_quantity integer default 0,
  p_images text[] default '{}'::text[],p_variants jsonb default '[]'::jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.products%rowtype; v uuid; entry jsonb; code text; qty integer;
        image_url text; i integer:=0; variant_count integer;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_request_id is null then raise exception 'REQUEST_ID_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
  select * into p from public.products where id=p_request_id;
  if found then return jsonb_build_object('product_id',p.id,'name',p.name,'sku',p.sku,'barcode',p.barcode,'status',p.status,'replayed',true); end if;
  if length(btrim(coalesce(p_name,''))) not between 2 and 180 then raise exception 'NAME_REQUIRED'; end if;
  if p_price is null or p_price<=0 or p_price>99999999 or p_price::text in ('NaN','Infinity','-Infinity') then raise exception 'PRICE_REQUIRED'; end if;
  if p_quantity is null or p_quantity<0 then raise exception 'INVALID_QUANTITY'; end if;
  if not exists(select 1 from public.categories where id=p_category_id and is_active) then raise exception 'CATEGORY_REQUIRED'; end if;
  if coalesce(cardinality(p_images),0)>10 then raise exception 'MAX_TEN_IMAGES'; end if;
  if p_variants is null or jsonb_typeof(p_variants)<>'array' then raise exception 'INVALID_VARIANTS'; end if;
  variant_count:=jsonb_array_length(p_variants);
  if variant_count>50 then raise exception 'MAX_FIFTY_VARIANTS'; end if;
  code:=coalesce(nullif(btrim(p_barcode),''),public.next_internal_barcode());
  if code !~ '^[A-Za-z0-9._/-]{3,80}$' then raise exception 'INVALID_BARCODE'; end if;
  perform pg_advisory_xact_lock(hashtextextended(code,1));
  if exists(select 1 from public.products where barcode=code) or exists(select 1 from public.product_variants where barcode=code) then raise exception 'DUPLICATE_BARCODE'; end if;
  insert into public.products(id,name,slug,category_id,price,barcode,status,stock,cover_image_url)
  values(p_request_id,btrim(p_name),coalesce(nullif(trim(both '-' from regexp_replace(lower(btrim(p_name)),'[^a-z0-9]+','-','g')),''),'producto')||'-'||p_request_id::text,p_category_id,round(p_price,2),code,'draft',0,p_images[1]) returning * into p;
  if variant_count=0 then
    insert into public.product_variants(product_id,title,sku,barcode,price,stock,is_default,is_active)
    values(p.id,'Única',p.sku,code,p.price,0,true,true) returning id into v;
    if p_quantity>0 then perform public.admin_inventory_adjust(v,p_quantity,'Existencia inicial · alta rápida móvil','restock'); end if;
  else
    for entry in select value from jsonb_array_elements(p_variants) loop
      if length(btrim(coalesce(entry->>'title',''))) not between 1 and 100 then raise exception 'VARIANT_TITLE_REQUIRED'; end if;
      qty:=(entry->>'quantity')::integer;
      if qty is null or qty<0 then raise exception 'INVALID_QUANTITY'; end if;
      code:=coalesce(nullif(btrim(entry->>'barcode'),''),public.next_internal_barcode());
      if code !~ '^[A-Za-z0-9._/-]{3,80}$' then raise exception 'INVALID_BARCODE'; end if;
      perform pg_advisory_xact_lock(hashtextextended(code,1));
      if exists(select 1 from public.products where barcode=code) or exists(select 1 from public.product_variants where barcode=code) then raise exception 'DUPLICATE_BARCODE'; end if;
      insert into public.product_variants(product_id,title,sku,barcode,attributes,price,stock,is_default,is_active)
      values(p.id,btrim(entry->>'title'),public.next_variant_sku(p.id,coalesce(entry->'attributes','{}'::jsonb)),code,coalesce(entry->'attributes','{}'::jsonb),p.price,0,false,true) returning id into v;
      if qty>0 then perform public.admin_inventory_adjust(v,qty,'Existencia inicial · alta rápida móvil','restock'); end if;
    end loop;
  end if;
  foreach image_url in array coalesce(p_images,'{}'::text[]) loop
    if image_url is null or image_url !~ '^https://' then raise exception 'INVALID_IMAGE'; end if;
    i:=i+1;
    insert into public.product_images(product_id,image_url,alt_text,sort_order,is_primary)
    values(p.id,image_url,p.name||' · imagen '||i,i,i=1);
  end loop;
  -- Variant triggers can synchronize the product barcode during capture.
  select * into p from public.products where id=p_request_id;
  return jsonb_build_object('product_id',p.id,'name',p.name,'sku',p.sku,'barcode',p.barcode,'status','draft','replayed',false);
end $$;

-- Identifier counters are internal administrative state.
alter table public.category_sku_counters enable row level security;
create policy category_sku_counters_admin on public.category_sku_counters
for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke execute on function public.next_internal_barcode() from public,anon;
revoke execute on function public.next_category_sku(uuid) from public,anon;
revoke execute on function public.next_variant_sku(uuid,jsonb) from public,anon;
grant execute on function public.next_internal_barcode() to authenticated;
grant execute on function public.next_category_sku(uuid) to authenticated;
grant execute on function public.next_variant_sku(uuid,jsonb) to authenticated;
