-- A11.5: POS 2.2 services may acquire a synthetic "Única" variant through
-- catalog management. The service sale path explicitly forbids variant_id,
-- but the generic physical-product guard previously rejected the parent.
-- Keep the variant-required protection for every physical product.
do $a115$
declare
  function_source text;
  original_guard constant text :=
    'if v_variant_id is null and exists(select 1 from public.product_variants where product_id=v_product_id) then';
  service_safe_guard constant text :=
    'if not v_product.is_service and v_variant_id is null and exists(select 1 from public.product_variants where product_id=v_product_id) then';
begin
  select pg_get_functiondef('public.pos_create_sale_v22(text,jsonb,jsonb,numeric,text,uuid)'::regprocedure)
    into function_source;

  -- Do not guess if a later version of the sale engine changed its contract.
  if function_source is null or
    length(function_source) - length(replace(function_source, original_guard, '')) <> length(original_guard)
  then
    raise exception 'POS22_SERVICE_GUARD_VERSION_MISMATCH';
  end if;

  execute replace(function_source, original_guard, service_safe_guard);
end;
$a115$;
