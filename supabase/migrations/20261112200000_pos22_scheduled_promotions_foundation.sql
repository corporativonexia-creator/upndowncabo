-- POS 2.2: calendario auditable de promociones (preparación, sin alterar ventas vigentes).
begin;
create table if not exists public.pos22_promotions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 3 and 120),
  target_type text not null check (target_type in ('category','code')),
  category_id uuid references public.categories(id),
  code text,
  discount_percent numeric(6,2) not null check (discount_percent>0 and discount_percent<=100),
  start_date date not null,
  end_date date not null,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pos22_promotion_dates check (end_date>=start_date),
  constraint pos22_promotion_target check (
    (target_type='category' and category_id is not null and code is null) or
    (target_type='code' and category_id is null and nullif(btrim(code),'') is not null)
  )
);
create index if not exists pos22_promotions_active_idx on public.pos22_promotions(active,start_date,end_date);
alter table public.pos22_promotions enable row level security;
revoke all on public.pos22_promotions from public, anon, authenticated;

create or replace function public.pos22_manage_promotion(
  p_action text, p_id uuid default null, p_name text default null,
  p_target_type text default null, p_category_id uuid default null,
  p_code text default null, p_discount_percent numeric default null,
  p_start_date date default null, p_end_date date default null,
  p_active boolean default true
) returns uuid language plpgsql security definer set search_path='' as $f$
declare v_id uuid; v_actor uuid:=auth.uid();
begin
  if v_actor is null or not public.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;
  if p_action='deactivate' then
    update public.pos22_promotions set active=false,updated_at=now() where id=p_id returning id into v_id;
    if v_id is null then raise exception 'PROMOTION_NOT_FOUND'; end if;
    return v_id;
  end if;
  if p_action not in ('create','update') then raise exception 'INVALID_ACTION'; end if;
  if length(btrim(coalesce(p_name,''))) not between 3 and 120
    or p_target_type not in ('category','code')
    or p_discount_percent is null or p_discount_percent<=0 or p_discount_percent>100
    or p_start_date is null or p_end_date is null or p_end_date<p_start_date then
    raise exception 'INVALID_PROMOTION';
  end if;
  if (p_target_type='category' and
      (p_category_id is null or p_code is not null or
       not exists(select 1 from public.categories where id=p_category_id and is_active=true)))
     or (p_target_type='code' and
      (p_category_id is not null or nullif(btrim(coalesce(p_code,'')),'') is null)) then
    raise exception 'INVALID_PROMOTION_TARGET';
  end if;
  if p_action='create' then
    insert into public.pos22_promotions
      (name,target_type,category_id,code,discount_percent,start_date,end_date,active,created_by)
    values
      (btrim(p_name),p_target_type,p_category_id,nullif(upper(btrim(p_code)),''),
       p_discount_percent,p_start_date,p_end_date,coalesce(p_active,true),v_actor)
    returning id into v_id;
  else
    update public.pos22_promotions
    set name=btrim(p_name), target_type=p_target_type,
        category_id=p_category_id,code=nullif(upper(btrim(p_code)),''),
        discount_percent=p_discount_percent,start_date=p_start_date,
        end_date=p_end_date,active=coalesce(p_active,true),updated_at=now()
    where id=p_id returning id into v_id;
    if v_id is null then raise exception 'PROMOTION_NOT_FOUND'; end if;
  end if;
  return v_id;
end;$f$;
revoke all on function public.pos22_manage_promotion(text,uuid,text,text,uuid,text,numeric,date,date,boolean) from public,anon;
grant execute on function public.pos22_manage_promotion(text,uuid,text,text,uuid,text,numeric,date,date,boolean) to authenticated;

create or replace function public.pos22_list_promotions()
returns table (
 id uuid,name text,target_type text,category_id uuid,code text,
 discount_percent numeric,start_date date,end_date date,active boolean
) language plpgsql security definer set search_path='' as $f$
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
 return query select p.id,p.name,p.target_type,p.category_id,p.code,
   p.discount_percent,p.start_date,p.end_date,p.active
 from public.pos22_promotions p order by p.created_at desc;
end;$f$;
revoke all on function public.pos22_list_promotions() from public,anon;
grant execute on function public.pos22_list_promotions() to authenticated;
commit;
