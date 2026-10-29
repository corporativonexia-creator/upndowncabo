-- A product can remain active and sellable in the physical POS without appearing online.
-- Existing products retain their current online presence.
alter table public.products
  add column if not exists online_visible boolean not null default true;

comment on column public.products.online_visible is
  'True: visible in online catalog when active. False: physical store/POS only; stock unaffected.';

create index if not exists idx_products_public_online_catalog
  on public.products (created_at desc)
  where status = 'active' and online_visible = true;
