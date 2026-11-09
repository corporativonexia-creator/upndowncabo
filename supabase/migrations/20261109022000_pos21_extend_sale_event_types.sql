begin;
alter table public.pos_sale_events drop constraint if exists pos_sale_events_event_type_check;
alter table public.pos_sale_events add constraint pos_sale_events_event_type_check
  check (event_type=any(array[
   'sale_completed','sale_voided','sale_refunded','payment_recorded',
   'refund_recorded','inventory_deducted','inventory_restored','note',
   'price_changed_by_promotion','mixed_payment_recorded'
  ]));
commit;