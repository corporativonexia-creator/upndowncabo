create sequence if not exists public.internal_barcode_seq start with 1 increment by 1;

create or replace function public.next_internal_barcode()
returns text
language plpgsql
security definer
set search_path=''
as $$
declare
  n bigint; body text; s integer := 0; i integer; d integer; check_digit integer; candidate text;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  loop
    n := nextval('public.internal_barcode_seq');
    if n > 9999999999 then raise exception 'INTERNAL_BARCODE_RANGE_EXHAUSTED'; end if;
    body := '20' || lpad(n::text,10,'0');
    s := 0;
    for i in 1..12 loop
      d := substr(body,i,1)::integer;
      s := s + case when mod(i,2)=0 then d*3 else d end;
    end loop;
    check_digit := mod(10-mod(s,10),10);
    candidate := body || check_digit::text;
    if not exists(select 1 from public.products where barcode=candidate)
       and not exists(select 1 from public.product_variants where barcode=candidate) then return candidate; end if;
  end loop;
end $$;

grant execute on function public.next_internal_barcode() to authenticated;
