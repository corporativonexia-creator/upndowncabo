-- A product can remain active and sellable in the physical POS without appearing online.
-- Existing products retain their current online presence.
alter table public.products
  add column if not exists online_visible boolean not null default true;

comment on column public.products.online_visible is
  'True: visible in online catalog when active. False: physical store/POS only; stock unaffected.';

create index if not exists idx_products_public_online_catalog
  on public.products (created_at desc)
  where status = 'active' and online_visible = true;

-- Online-only merchandise can remain in the website but not the physical POS.
alter table public.products
  add column if not exists pos_visible boolean not null default true;

comment on column public.products.pos_visible is
  'True: sellable in the physical POS. False: online only. Stock remains shared.';

-- Ensure existing products remain available in at least one sales channel.
alter table public.products
  add constraint products_at_least_one_sales_channel
  check (online_visible or pos_visible);

create index if not exists idx_products_pos_catalog
  on public.products (name)
  where status = 'active' and pos_visible = true;
