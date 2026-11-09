begin;
create or replace function public.pos21_issue_promotion_approval(
 p_cashier_employee_id uuid,p_items jsonb,p_reason text
) returns uuid language plpgsql security definer set search_path='' as $approve$
declare admin_employee public.pos_employees%rowtype;
declare cashier_employee public.pos_employees%rowtype;
declare item jsonb;
declare product public.products%rowtype;
declare variant public.product_variants%rowtype;
declare qty integer;
declare variant_id uuid;
declare base numeric(12,2);
declare price_after numeric(12,2);
declare total_discount numeric(12,2):=0;
declare sub_total numeric(12,2):=0;
declare issued uuid;
begin
 select * into admin_employee from public.pos_employees
 where auth_user_id=auth.uid() and status='active' and role='pos_admin';
 if not found then raise exception 'POS_ADMIN_REQUIRED';end if;
 if length(btrim(coalesce(p_reason,'')))<6 then raise exception 'PROMOTION_APPROVAL_REASON_REQUIRED';end if;
 select * into cashier_employee from public.pos_employees
 where id=p_cashier_employee_id and status='active';
 if not found then raise exception 'INVALID_CASHIER';end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then
   raise exception 'SALE_ITEMS_REQUIRED';
 end if;
 if exists(select 1 from jsonb_array_elements(p_items) as duplicate(value)
    group by (duplicate.value->>'product_id')::uuid,
             nullif(duplicate.value->>'variant_id','')::uuid
    having count(*)>1) then raise exception 'DUPLICATE_SALE_ITEM';end if;
 for item in select value from jsonb_array_elements(p_items) loop
   begin
     qty=(item->>'quantity')::integer;
     variant_id=nullif(item->>'variant_id','')::uuid;
   exception when others then raise exception 'INVALID_SALE_ITEM';end;
   if qty is null or qty<1 then raise exception 'INVALID_SALE_ITEM';end if;
   select * into product from public.products where id=(item->>'product_id')::uuid
       and status='active' and pos_visible=true;
   if not found then raise exception 'PRODUCT_NOT_AVAILABLE';end if;
   if variant_id is not null then
     select * into variant from public.product_variants
       where id=variant_id and product_id=product.id and is_active=true;
     if not found then raise exception 'VARIANT_NOT_AVAILABLE';end if;
   else
     if exists(select 1 from public.product_variants where product_id=product.id)
       then raise exception 'VARIANT_REQUIRED';end if;
   end if;
   base:=round(case when variant_id is null
      then coalesce(product.sale_price,product.price,0)
      else coalesce(variant.sale_price,variant.price,product.sale_price,product.price,0)
     end,2);
   price_after:=public.pos21_promotional_unit_price(base,item->>'promotion_mode',
       case when lower(coalesce(item->>'promotion_mode','none'))='none' then null
          else (item->>'promotion_value')::numeric end);
   total_discount:=round(total_discount+(base-price_after)*qty,2);
   sub_total:=round(sub_total+base*qty,2);
 end loop;
 if total_discount<=0 then raise exception 'NO_PROMOTION_TO_APPROVE';end if;
 if total_discount>=sub_total then raise exception 'ZERO_OR_NEGATIVE_TOTAL_NOT_ALLOWED';end if;
 insert into public.pos21_promotion_approvals(cashier_employee_id,approved_by,items,approved_discount,reason)
 values(cashier_employee.id,admin_employee.id,p_items,total_discount,btrim(p_reason))
 returning token into issued;
 return issued;
end;
$approve$;
commit;