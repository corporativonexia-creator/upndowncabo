-- Public storefront copy is read-only; editing is reserved for database administration.
revoke insert, update, delete, truncate, references, trigger on public.storefront_texts from anon, authenticated;
