-- A3.4: automatic SKU allocation only. Preserve every existing SKU, its category
-- mask (e.g. WED-0001), the counter table, barcode rules, and function signatures.
-- The file is staged in the protected candidate; do not apply to hosted Supabase.

create or replace function public.next_category_sku(p_category_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  pref text;
  n integer;
  candidate text;
begin
  select upper(sku_prefix) into pref
    from public.categories where id = p_category_id;
  if pref is null or pref !~ '^[A-Z0-9]{3}$' then
    raise exception 'CATEGORY_SKU_PREFIX_REQUIRED';
  end if;

  loop
    -- ON CONFLICT locks the category counter row until transaction end.
    -- A skipped candidate remains consumed, so it cannot be offered again.
    insert into public.category_sku_counters(category_id, last_number)
      values (p_category_id, 1)
    on conflict (category_id) do update
      set last_number = public.category_sku_counters.last_number + 1,
          updated_at = now()
    returning last_number into n;

    candidate := pref || '-' || lpad(n::text, 4, '0');
    exit when not exists (
      select 1 from public.products where lower(sku) = lower(candidate)
    ) and not exists (
      select 1 from public.product_variants where lower(sku) = lower(candidate)
    );
  end loop;

  return candidate;
end $$;

create or replace function public.next_variant_sku(p_product_id uuid, p_attributes jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare
  base text;
  suff text;
  candidate text;
  n integer := 1;
begin
  -- Serialize generated variants for the same product until commit, including
  -- callers of the existing mobile-create and inventory-save RPCs.
  perform pg_advisory_xact_lock(hashtextextended(p_product_id::text, 2));

  select sku into base from public.products where id = p_product_id;
  if base is null then raise exception 'PRODUCT_NOT_FOUND'; end if;
  suff := public.variant_auto_suffix(coalesce(p_attributes, '{}'::jsonb));

  if suff is null then
    -- Preserve historical increasing -Vnn numbering and minimum 2 digits.
    select coalesce(max((regexp_match(sku, '-V([0-9]+)$'))[1]::integer), 0) + 1
      into n
      from public.product_variants
      where product_id = p_product_id and sku ~ '-V[0-9]+$';
  end if;

  loop
    if suff is null then
      candidate := base || '-V' || lpad(n::text, 2, '0');
    elsif n = 1 then
      candidate := base || '-' || suff;
    else
      candidate := base || '-' || suff || lpad(n::text, 2, '0');
    end if;

    exit when not exists (
      select 1 from public.products where lower(sku) = lower(candidate)
    ) and not exists (
      select 1 from public.product_variants where lower(sku) = lower(candidate)
    );
    n := n + 1;
  end loop;

  return candidate;
end $$;
