-- A5.3 - LABORATORY ONLY. This is NOT a Supabase migration or production RPC.
-- The surrounding node:test suite installs it only in an isolated disposable DB.
-- A production design still requires a full FK/RLS inventory and separate approval.

create or replace function private.qa_retire_product_contract(
  p_product_id uuid, p_expected_updated_at timestamptz, p_reason text
)
returns jsonb
language plpgsql security definer set search_path = ''
as $retire$
declare
  actor uuid;
  original public.products%rowtype;
  affected integer;
begin
  actor := auth.uid();
  if actor is null or not public.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;
  if p_reason is null or length(btrim(p_reason)) not between 8 and 240 then
    raise exception 'RETIREMENT_REASON_REQUIRED';
  end if;
  if p_expected_updated_at is null then
    raise exception 'EXPECTED_REVISION_REQUIRED';
  end if;

  -- Lock the parent BEFORE auditing. An independent retry must wait and then
  -- observe the committed state, not apply a second mutation.
  select * into original from public.products
    where id = p_product_id for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;

  if original.status = 'archived' and not original.online_visible
     and not original.pos_visible and not original.featured
     and not original.new_arrival_enabled then
    return jsonb_build_object('status','already_archived','product_id',p_product_id);
  end if;
  if original.updated_at is distinct from p_expected_updated_at then
    raise exception 'STALE_PRODUCT_SNAPSHOT';
  end if;

  -- These fixture statuses reflect the relevant versioned repository schema.
  -- Any actual server implementation MUST verify the deployed schema first.
  if exists (
    select 1 from public.checkout_v2_items i
    join public.checkout_v2_reservations r on r.id=i.reservation_id
    where i.product_id=p_product_id and r.status='active'
      and r.expires_at>now()
  ) then raise exception 'ACTIVE_CHECKOUT_RESERVATION'; end if;
  if exists (
    select 1 from public.pos_service_receptions r
    where r.service_product_id=p_product_id and r.status in ('received','ready')
  ) then raise exception 'OPEN_SERVICE_RECEPTION'; end if;
  if exists (
    select 1 from public.order_items i
    join public.orders o on o.id=i.order_id
    where i.product_id=p_product_id and o.status in ('processing','needs_review')
  ) then raise exception 'OPEN_ORDER'; end if;

  insert into private.qa_retirement_events(product_id,actor_id,reason,previous_product)
    values(p_product_id,actor,btrim(p_reason),to_jsonb(original));

  -- Whitelist of publication-only fields; SKU/UPC, prices, stock, variants,
  -- movements, checkout, receipts and images must never be touched here.
  update public.products set
    status='archived', online_visible=false, pos_visible=false,
    featured=false, new_arrival_enabled=false, updated_at=clock_timestamp()
    where id=p_product_id;
  get diagnostics affected = row_count;
  if affected<>1 then raise exception 'RETIREMENT_WRITE_MISMATCH'; end if;

  return jsonb_build_object('status','retired','product_id',p_product_id);
end
$retire$;

-- PostgreSQL grants EXECUTE to PUBLIC by default on new functions. Revoke it.
revoke all on function private.qa_retire_product_contract(uuid,timestamptz,text)
  from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.qa_retire_product_contract(uuid,timestamptz,text)
  to authenticated;
