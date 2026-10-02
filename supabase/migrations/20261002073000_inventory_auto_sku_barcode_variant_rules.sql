-- Up & Down inventory identifiers: category SKU + barcode + variant rules
alter table public.categories add column if not exists sku_prefix text;
alter table public.categories add column if not exists variant_schema jsonb not null default '[]'::jsonb;

update public.categories set sku_prefix = case slug
 when 'drivers' then 'DRI' when 'maderas' then 'MAD' when 'hibridos' then 'HIB' when 'hierros' then 'HIE'
 when 'wedges' then 'WED' when 'putters' then 'PUT' when 'bolsas' then 'BOL' when 'carritos' then 'CAR'
 when 'zapatos' then 'ZAP' when 'guantes' then 'GUA' when 'pelotas' then 'PEL' when 'accesorios' then 'ACC'
 when 'ropa' then 'ROP' else upper(left(regexp_replace(name,'[^A-Za-z0-9]','','g'),3)) end
where sku_prefix is null;

update public.categories set variant_schema = case slug
 when 'ropa' then '["talla","color","genero"]'::jsonb
 when 'zapatos' then '["talla","color","genero"]'::jsonb
 when 'guantes' then '["talla","mano","color"]'::jsonb
 when 'drivers' then '["mano","loft","flex"]'::jsonb
 when 'maderas' then '["mano","loft","flex"]'::jsonb
 when 'hibridos' then '["mano","loft","flex"]'::jsonb
 when 'hierros' then '["mano","flex"]'::jsonb
 when 'wedges' then '["mano","loft"]'::jsonb
 when 'putters' then '["mano","longitud"]'::jsonb
 else '[]'::jsonb end;

create unique index if not exists categories_sku_prefix_uidx on public.categories (upper(sku_prefix)) where sku_prefix is not null;
create table if not exists public.category_sku_counters(category_id uuid primary key references public.categories(id) on delete cascade,last_number integer not null default 0 check(last_number>=0),updated_at timestamptz not null default now());
create sequence if not exists public.updown_barcode_seq start with 1 increment by 1;

create or replace function public.updown_ean13(p_n bigint) returns text language plpgsql immutable set search_path='' as $$
declare base text; s integer:=0; i integer; d integer; check_digit integer;
begin
 base := '200' || lpad((p_n % 1000000000)::text,9,'0');
 for i in 1..12 loop d:=substr(base,i,1)::integer; s:=s + case when mod(i,2)=0 then d*3 else d end; end loop;
 check_digit := mod(10-mod(s,10),10); return base || check_digit::text;
end $$;

create or replace function public.next_category_sku(p_category_id uuid) returns text language plpgsql security definer set search_path='' as $$
declare pref text; n integer;
begin
 select upper(sku_prefix) into pref from public.categories where id=p_category_id;
 if pref is null or pref !~ '^[A-Z0-9]{3}$' then raise exception 'CATEGORY_SKU_PREFIX_REQUIRED'; end if;
 insert into public.category_sku_counters(category_id,last_number) values(p_category_id,1)
 on conflict(category_id) do update set last_number=public.category_sku_counters.last_number+1,updated_at=now() returning last_number into n;
 return pref || '-' || lpad(n::text,4,'0');
end $$;

create or replace function public.product_auto_identifiers() returns trigger language plpgsql set search_path='' as $$
begin
 if new.sku is null or btrim(new.sku)='' then new.sku:=public.next_category_sku(new.category_id); end if;
 if new.barcode is null or btrim(new.barcode)='' then new.barcode:=public.updown_ean13(nextval('public.updown_barcode_seq')); end if;
 return new;
end $$;
drop trigger if exists trg_product_auto_identifiers on public.products;
create trigger trg_product_auto_identifiers before insert on public.products for each row execute function public.product_auto_identifiers();

create or replace function public.variant_auto_suffix(p_attributes jsonb) returns text language plpgsql immutable set search_path='' as $$
declare c text; s text; m text; l text; f text; outv text;
begin
 c:=upper(regexp_replace(coalesce(p_attributes->>'color',''),'[^A-Za-z0-9]','','g')); s:=upper(regexp_replace(coalesce(p_attributes->>'talla',p_attributes->>'size',''),'[^A-Za-z0-9]','','g')); m:=upper(regexp_replace(coalesce(p_attributes->>'mano',''),'[^A-Za-z0-9]','','g')); l:=upper(regexp_replace(coalesce(p_attributes->>'loft',''),'[^A-Za-z0-9]','','g')); f:=upper(regexp_replace(coalesce(p_attributes->>'flex',''),'[^A-Za-z0-9]','','g'));
 outv:=left(c,2)||left(s,2)||left(m,1)||left(l,2)||left(f,1); return nullif(left(outv,6),'');
end $$;

create or replace function public.next_variant_sku(p_product_id uuid,p_attributes jsonb) returns text language plpgsql security definer set search_path='' as $$
declare base text; suff text; candidate text; n integer:=1;
begin
 select sku into base from public.products where id=p_product_id; if base is null then raise exception 'PRODUCT_NOT_FOUND'; end if;
 suff:=public.variant_auto_suffix(coalesce(p_attributes,'{}'::jsonb));
 if suff is null then select coalesce(max((regexp_match(sku,'-V([0-9]+)$'))[1]::integer),0)+1 into n from public.product_variants where product_id=p_product_id and sku ~ '-V[0-9]+$'; return base||'-V'||lpad(n::text,2,'0'); end if;
 candidate:=base||'-'||suff; while exists(select 1 from public.product_variants where lower(sku)=lower(candidate)) loop n:=n+1; candidate:=base||'-'||suff||lpad(n::text,2,'0'); end loop; return candidate;
end $$;

create or replace function public.admin_inventory_save_variant(p_product_id uuid,p_variant_id uuid default null,p_title text default 'Única',p_sku text default null,p_barcode text default null,p_attributes jsonb default '{}'::jsonb,p_price numeric default null,p_sale_price numeric default null,p_low_stock_threshold integer default 2,p_is_active boolean default true)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_is_default boolean; v_stock integer; v_sku text; v_barcode text;
begin
 if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if; if not exists(select 1 from public.products where id=p_product_id) then raise exception 'PRODUCT_NOT_FOUND'; end if;
 if p_variant_id is null then
  v_sku:=public.next_variant_sku(p_product_id,coalesce(p_attributes,'{}'::jsonb)); v_barcode:=coalesce(nullif(btrim(p_barcode),''),public.updown_ean13(nextval('public.updown_barcode_seq')));
  insert into public.product_variants(product_id,title,sku,barcode,attributes,price,sale_price,stock,low_stock_threshold,is_default,is_active) values(p_product_id,coalesce(nullif(btrim(p_title),''),'Variante'),v_sku,v_barcode,coalesce(p_attributes,'{}'::jsonb),p_price,p_sale_price,0,greatest(coalesce(p_low_stock_threshold,2),0),false,coalesce(p_is_active,true)) returning id,is_default,stock into v_id,v_is_default,v_stock;
 else
  update public.product_variants set title=coalesce(nullif(btrim(p_title),''),title),barcode=coalesce(nullif(btrim(p_barcode),''),barcode),attributes=coalesce(p_attributes,attributes),price=p_price,sale_price=p_sale_price,low_stock_threshold=greatest(coalesce(p_low_stock_threshold,2),0),is_active=coalesce(p_is_active,true),updated_at=now() where id=p_variant_id and product_id=p_product_id returning id,is_default,stock,sku,barcode into v_id,v_is_default,v_stock,v_sku,v_barcode;
  if v_id is null then raise exception 'VARIANT_NOT_FOUND'; end if;
 end if;
 return jsonb_build_object('ok',true,'variant_id',v_id,'sku',coalesce(v_sku,(select sku from public.product_variants where id=v_id)),'barcode',coalesce(v_barcode,(select barcode from public.product_variants where id=v_id)),'stock',v_stock,'is_default',v_is_default);
end $$;

grant execute on function public.next_category_sku(uuid) to authenticated;
