create extension if not exists postgis;

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  region text not null check (region in ('SP','RJ')),
  note text,
  center_lng double precision,
  center_lat double precision,
  created_at timestamptz not null default now()
);

create table if not exists public.policies (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique,
  store_id uuid not null references public.stores(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  data jsonb not null
);

create table if not exists public.freight_tables (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  policy_id uuid references public.policies(id) on delete set null,
  name text not null,
  source text not null default 'existente',
  file_name text,
  created_at timestamptz not null default now(),
  unique (store_id, name)
);

create table if not exists public.freight_bands (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.freight_tables(id) on delete cascade,
  band_index integer not null,
  ws numeric,
  we numeric,
  amc numeric,
  pew numeric,
  pct numeric,
  max_vol numeric,
  time text,
  country text,
  min_ins numeric
);
create index if not exists freight_bands_table_idx on public.freight_bands(table_id, band_index);

create table if not exists public.polygons (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique,
  store_id uuid not null references public.stores(id) on delete cascade,
  policy_id uuid references public.policies(id) on delete cascade,
  district text,
  uf text,
  band text,
  radius double precision,
  r_min double precision,
  r_max double precision,
  area_km2 double precision,
  center_lng double precision,
  center_lat double precision,
  geom geometry(MultiPolygon, 4326) not null,
  created_at timestamptz not null default now()
);
create index if not exists polygons_geom_idx on public.polygons using gist(geom);
create index if not exists polygons_store_policy_idx on public.polygons(store_id, policy_id);

create table if not exists public.policy_docks (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  dock text not null,
  policy_id uuid not null references public.policies(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (store_id, dock, policy_id)
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  store text not null,
  module text not null,
  field text not null,
  before text,
  after text,
  action text not null,
  description text
);
create index if not exists audit_log_at_idx on public.audit_log(at desc);

drop view if exists public.polygons_geo;
create view public.polygons_geo as
select
  id,
  client_id,
  store_id,
  policy_id,
  district,
  uf,
  band,
  radius,
  r_min,
  r_max,
  area_km2,
  center_lng,
  center_lat,
  st_asgeojson(st_simplifypreservetopology(geom, 0.0008))::json as geojson
from public.polygons;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.stores, public.policies, public.freight_tables, public.freight_bands, public.polygons, public.policy_docks, public.audit_log to anon, authenticated;
grant select on public.polygons_geo to anon, authenticated;
grant all on public.stores, public.policies, public.freight_tables, public.freight_bands, public.polygons, public.policy_docks, public.audit_log to service_role;

alter table public.stores enable row level security;
alter table public.policies enable row level security;
alter table public.freight_tables enable row level security;
alter table public.freight_bands enable row level security;
alter table public.polygons enable row level security;
alter table public.policy_docks enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists "stores_public" on public.stores;
drop policy if exists "policies_public" on public.policies;
drop policy if exists "freight_tables_public" on public.freight_tables;
drop policy if exists "freight_bands_public" on public.freight_bands;
drop policy if exists "polygons_public" on public.polygons;
drop policy if exists "policy_docks_public" on public.policy_docks;
drop policy if exists "audit_public" on public.audit_log;

create policy "stores_public" on public.stores for all using (true) with check (true);
create policy "policies_public" on public.policies for all using (true) with check (true);
create policy "freight_tables_public" on public.freight_tables for all using (true) with check (true);
create policy "freight_bands_public" on public.freight_bands for all using (true) with check (true);
create policy "polygons_public" on public.polygons for all using (true) with check (true);
create policy "policy_docks_public" on public.policy_docks for all using (true) with check (true);
create policy "audit_public" on public.audit_log for all using (true) with check (true);
