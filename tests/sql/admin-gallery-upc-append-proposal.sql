-- A3.7 PROPOSAL ONLY, for disposable PostgreSQL QA. NOT a Supabase migration.
-- Do not apply to hosted Supabase or invoke from ADMIN until staging RLS/Storage
-- compatibility and the legacy gallery editor have been approved separately.
-- Existing product_images rows, product data, SKUs, stock and history untouched.

create or replace function public.admin_append_upc_photos_atomic(
  p_product_id uuid,
  p_image_urls text[]
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_name text;
  v_url text;
  v_count integer;
  v_sort integer;
  v_added integer := 0;
  v_existing integer := 0;
begin
  if (select auth.uid()) is null or not (select public.is_admin()) then
    raise exception 'ADMIN_REQUIRED';
  end if;
  if p_product_id is null then raise exception 'PRODUCT_REQUIRED'; end if;
  if p_image_urls is null or cardinality(p_image_urls) not between 1 and 10 then
    raise exception 'INVALID_GALLERY_BATCH';
  end if;

  -- Serialize ONLY UPC-photo append calls for this product until transaction end.
  -- A direct legacy INSERT/DELETE does not participate in this advisory lock;
  -- that remaining cross-writer risk must be audited before release.
  perform pg_advisory_xact_lock(hashtextextended(p_product_id::text, 17));
  select name into v_name from public.products where id = p_product_id;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;

  select count(*)::integer, coalesce(max(sort_order), 0)::integer
    into v_count, v_sort from public.product_images where product_id = p_product_id;

  foreach v_url in array p_image_urls loop
    if v_url is null or v_url !~ '^https://[^/]+/storage/v1/object/public/product-media/products/upc/'
      or position('/products/upc/' || p_product_id::text || '/' in v_url) = 0
      or v_url !~ '\.jpg$' then
      raise exception 'INVALID_UPC_PHOTO_URL';
    end if;
    -- A lost HTTP response followed by a retry must never duplicate an image.
    if exists (
      select 1 from public.product_images
       where product_id = p_product_id and image_url = v_url
    ) then
      v_existing := v_existing + 1;
      continue;
    end if;
    if v_count >= 10 then raise exception 'GALLERY_LIMIT_EXCEEDED'; end if;

    v_sort := v_sort + 1;
    insert into public.product_images
      (product_id, image_url, alt_text, sort_order, is_primary)
    values
      (p_product_id, v_url, left(v_name, 130) || ' · fotografía por UPC',
       v_sort, v_count = 0);
    v_count := v_count + 1;
    v_added := v_added + 1;
  end loop;

  return jsonb_build_object('ok', true, 'inserted', v_added,
    'replayed', v_existing, 'total', v_count);
end $$;

-- Supabase defaults function EXECUTE to PUBLIC, including anon. Do not expose
-- this administrative RPC without revoking that default grant.
revoke all on function public.admin_append_upc_photos_atomic(uuid, text[]) from public;
grant execute on function public.admin_append_upc_photos_atomic(uuid, text[]) to authenticated;
