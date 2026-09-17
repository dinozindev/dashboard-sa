alter table public.stores drop constraint if exists stores_region_check;
alter table public.stores add constraint stores_region_check check (region ~ '^[A-Z]{2}$');