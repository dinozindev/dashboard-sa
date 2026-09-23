create table if not exists public.policy_cells (
  store text not null,
  modality text not null,
  status text not null default 'Não informada',
  note text not null default '',
  primary key (store, modality)
);

create table if not exists public.modalities (
  name text primary key,
  position integer not null default 0
);

grant select, insert, update, delete on public.policy_cells, public.modalities to anon, authenticated;
grant all on public.policy_cells, public.modalities to service_role;
alter table public.policy_cells enable row level security;
alter table public.modalities enable row level security;
drop policy if exists "policy_cells_public" on public.policy_cells;
drop policy if exists "modalities_public" on public.modalities;
create policy "policy_cells_public" on public.policy_cells for all using (true) with check (true);
create policy "modalities_public" on public.modalities for all using (true) with check (true);

alter table public.polygons add column if not exists kind text not null default 'Entrega';
alter table public.polygons drop constraint if exists polygons_kind_check;
alter table public.polygons add constraint polygons_kind_check check (kind in ('Entrega','Retira'));

alter table public.stores drop constraint if exists stores_region_check;
alter table public.stores add constraint stores_region_check check (region ~ '^[A-Z]{2}$');

alter table public.freight_tables add column if not exists polygon_name text;

drop view if exists public.polygons_geo;
create view public.polygons_geo as
 select id, client_id, store_id, policy_id, district, uf, band, radius,
    r_min, r_max, area_km2, center_lng, center_lat,
    st_asgeojson(st_simplifypreservetopology(geom, 0.0008::double precision))::json as geojson,
    kind
   from public.polygons;
grant select on public.polygons_geo to anon, authenticated;
grant all on public.polygons_geo to service_role;

create table if not exists public.state_polygons (
  id uuid primary key default gen_random_uuid(),
  uf text not null unique,
  name text not null,
  polygon_name text,
  source text,
  geom geometry(MultiPolygon, 4326) not null,
  updated_at timestamptz not null default now()
);
create index if not exists state_polygons_geom_idx on public.state_polygons using gist (geom);
create unique index if not exists state_polygons_polygon_name_key on public.state_polygons (polygon_name);
grant select, insert, update, delete on public.state_polygons to anon, authenticated;
grant all on public.state_polygons to service_role;
alter table public.state_polygons enable row level security;
drop policy if exists "state_polygons_all" on public.state_polygons;
create policy "state_polygons_all" on public.state_polygons
  for all to anon, authenticated using (true) with check (true);

drop view if exists public.state_polygons_geo;
create view public.state_polygons_geo as
  select id, uf, name, polygon_name, source, updated_at,
    st_asgeojson(st_simplifypreservetopology(geom, 0.0001::double precision))::json as geojson
  from public.state_polygons;
grant select on public.state_polygons_geo to anon, authenticated;
grant all on public.state_polygons_geo to service_role;

create or replace function public.insert_polygons(payload jsonb)
returns integer
language plpgsql
as $function$
declare
  x jsonb;
  inserted integer := 0;
begin
  for x in select * from jsonb_array_elements(payload) loop
    begin
      insert into public.polygons (
        client_id, store_id, policy_id, kind, district, uf, band, radius,
        r_min, r_max, area_km2, center_lng, center_lat, geom
      ) values (
        x->>'clientId',
        (x->>'storeId')::uuid,
        coalesce(
          (select p.id from public.policies p where p.client_id = x->>'policyId'),
          nullif(x->>'policyId','')::uuid
        ),
        coalesce(nullif(x->>'kind',''), 'Entrega'),
        nullif(x->>'district',''),
        nullif(x->>'uf',''),
        nullif(x->>'band',''),
        (x->>'radius')::double precision,
        (x->>'rMin')::double precision,
        (x->>'rMax')::double precision,
        (x->>'areaKm2')::double precision,
        (x->>'centerLng')::double precision,
        (x->>'centerLat')::double precision,
        st_multi(st_geomfromgeojson(x->>'geojson'))
      )
      on conflict (client_id) do nothing;
      if found then inserted := inserted + 1; end if;
    exception when others then
      null;
    end;
  end loop;
  return inserted;
end;
$function$;

create or replace function public.upsert_state_polygon(payload jsonb)
returns integer
language plpgsql
as $function$
declare
  v_name text := coalesce(nullif(payload->>'name',''), payload->>'uf');
  v_polygon_name text := coalesce(
    nullif(payload->>'polygonName',''),
    upper(regexp_replace(translate(v_name,
      'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
      'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'),
      '[^a-zA-Z0-9]+', '_', 'g')) || '_RETIRA'
  );
begin
  insert into public.state_polygons (uf, name, polygon_name, source, geom, updated_at)
  values (
    payload->>'uf',
    v_name,
    v_polygon_name,
    nullif(payload->>'source',''),
    st_multi(st_geomfromgeojson(payload->>'geojson')),
    now()
  )
  on conflict (uf) do update
    set name = excluded.name,
        polygon_name = excluded.polygon_name,
        source = excluded.source,
        geom = excluded.geom,
        updated_at = now();
  return 1;
end;
$function$;

drop function if exists public.get_freight_snapshot();
create function public.get_freight_snapshot()
returns json
language sql
stable
as $function$
  select json_build_object(
    'stores', (
      select coalesce(json_agg(json_build_object(
        'name', s.name, 'region', s.region, 'note', s.note,
        'center', case when s.center_lng is null or s.center_lat is null then null
                  else json_build_array(s.center_lng, s.center_lat) end,
        'polygonCount', coalesce(pc.cnt, 0)
      ) order by s.name), '[]'::json)
      from public.stores s
      left join (select store_id, count(*) as cnt from public.polygons group by store_id) pc
        on pc.store_id = s.id
    ),
    'policies', (
      select coalesce(json_agg(json_build_object(
        'clientId', p.client_id, 'store', s.name, 'data', p.data, 'updatedAt', p.updated_at
      ) order by p.created_at), '[]'::json)
      from public.policies p
      join public.stores s on s.id = p.store_id
    ),
    'freightTables', (
      select coalesce(json_agg(json_build_object(
        'id', t.id, 'store', s.name, 'policyClientId', pol.client_id,
        'name', t.name, 'source', t.source, 'fileName', t.file_name,
        'polygonName', t.polygon_name,
        'bands', (
          select coalesce(json_agg(json_build_object(
            'ws', b.ws, 'we', b.we, 'amc', b.amc, 'pew', b.pew,
            'pct', b.pct, 'maxVol', b.max_vol, 'time', b.time,
            'country', b.country, 'minIns', b.min_ins
          ) order by b.band_index), '[]'::json)
          from public.freight_bands b where b.table_id = t.id
        )
      )), '[]'::json)
      from public.freight_tables t
      join public.stores s on s.id = t.store_id
      left join public.policies pol on pol.id = t.policy_id
    ),
    'polygons', (
      select coalesce(json_agg(json_build_object(
        'id', g.client_id, 'store', s.name, 'district', g.district, 'uf', g.uf,
        'band', g.band, 'radius', g.radius, 'rMin', g.r_min, 'rMax', g.r_max,
        'areaKm2', g.area_km2, 'kind', g.kind,
        'center', case when g.center_lng is null or g.center_lat is null then null
                  else json_build_array(g.center_lng, g.center_lat) end,
        'policyClientId', pol.client_id,
        'geojson', g.geojson
      )), '[]'::json)
      from public.polygons_geo g
      join public.stores s on s.id = g.store_id
      left join public.policies pol on pol.id = g.policy_id
    ),
    'statePolygons', (
      select coalesce(json_agg(json_build_object(
        'uf', sp.uf, 'name', sp.name, 'polygonName', sp.polygon_name, 'source', sp.source,
        'updatedAt', sp.updated_at, 'geojson', sp.geojson
      ) order by sp.uf), '[]'::json)
      from public.state_polygons_geo sp
    ),
    'dockLinks', (
      select coalesce(json_agg(json_build_object(
        'store', s.name, 'dock', d.dock, 'policyClientId', p.client_id
      )), '[]'::json)
      from public.policy_docks d
      join public.stores s on s.id = d.store_id
      join public.policies p on p.id = d.policy_id
    ),
    'policyCells', (
      select coalesce(json_agg(json_build_object(
        'store', c.store, 'modality', c.modality, 'status', c.status, 'note', c.note
      )), '[]'::json)
      from public.policy_cells c
    ),
    'customModalities', (
      select coalesce(json_agg(m.name order by m.position, m.name), '[]'::json)
      from public.modalities m
    ),
    'audit', (
      select coalesce(json_agg(json_build_object(
        'id', a.id, 'at', a.at, 'store', a.store, 'module', a.module,
        'field', a.field, 'before', a.before, 'after', a.after,
        'action', a.action, 'description', a.description
      ) order by a.at desc), '[]'::json)
      from (select * from public.audit_log order by at desc limit 2000) a
    )
  );
$function$;

grant execute on function public.insert_polygons(jsonb) to anon, authenticated, service_role;
grant execute on function public.get_freight_snapshot() to anon, authenticated, service_role;
grant execute on function public.upsert_state_polygon(jsonb) to anon, authenticated, service_role;
