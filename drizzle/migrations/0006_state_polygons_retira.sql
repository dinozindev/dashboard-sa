create table if not exists public.state_polygons (
  id uuid primary key default gen_random_uuid(),
  uf text not null unique,
  name text not null,
  source text,
  geom geometry(MultiPolygon, 4326) not null,
  updated_at timestamptz not null default now()
);

create index if not exists state_polygons_geom_idx on public.state_polygons using gist (geom);

grant select, insert, update, delete on public.state_polygons to anon, authenticated;
grant all on public.state_polygons to service_role;

alter table public.state_polygons enable row level security;

drop policy if exists "state_polygons_all" on public.state_polygons;
create policy "state_polygons_all" on public.state_polygons
  for all to anon, authenticated using (true) with check (true);

create or replace view public.state_polygons_geo as
  select id, uf, name, source, updated_at,
    st_asgeojson(st_simplifypreservetopology(geom, 0.0008::double precision))::json as geojson
  from public.state_polygons;

grant select on public.state_polygons_geo to anon, authenticated;
grant all on public.state_polygons_geo to service_role;

create or replace function public.upsert_state_polygon(payload jsonb)
returns integer
language plpgsql
as $function$
begin
  insert into public.state_polygons (uf, name, source, geom, updated_at)
  values (
    payload->>'uf',
    coalesce(nullif(payload->>'name',''), payload->>'uf'),
    nullif(payload->>'source',''),
    st_multi(st_geomfromgeojson(payload->>'geojson')),
    now()
  )
  on conflict (uf) do update
    set name = excluded.name,
        source = excluded.source,
        geom = excluded.geom,
        updated_at = now();
  return 1;
end;
$function$;

grant execute on function public.upsert_state_polygon(jsonb) to anon, authenticated, service_role;

create or replace function public.get_freight_snapshot()
returns jsonb
language sql
stable
as $function$
  select jsonb_build_object(
    'stores', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', s.name, 'region', s.region, 'note', s.note,
        'center', case when s.center_lng is null or s.center_lat is null then null
                  else jsonb_build_array(s.center_lng, s.center_lat) end,
        'polygonCount', coalesce(pc.cnt, 0)
      ) order by s.name), '[]'::jsonb)
      from public.stores s
      left join (select store_id, count(*) as cnt from public.polygons group by store_id) pc
        on pc.store_id = s.id
    ),
    'policies', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'clientId', p.client_id, 'store', s.name, 'data', p.data, 'updatedAt', p.updated_at
      ) order by p.created_at), '[]'::jsonb)
      from public.policies p
      join public.stores s on s.id = p.store_id
    ),
    'freightTables', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', t.id, 'store', s.name, 'policyClientId', pol.client_id,
        'name', t.name, 'source', t.source, 'fileName', t.file_name,
        'bands', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'ws', b.ws, 'we', b.we, 'amc', b.amc, 'pew', b.pew,
            'pct', b.pct, 'maxVol', b.max_vol, 'time', b.time,
            'country', b.country, 'minIns', b.min_ins
          ) order by b.band_index), '[]'::jsonb)
          from public.freight_bands b where b.table_id = t.id
        )
      )), '[]'::jsonb)
      from public.freight_tables t
      join public.stores s on s.id = t.store_id
      left join public.policies pol on pol.id = t.policy_id
    ),
    'polygons', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', g.client_id, 'store', s.name, 'district', g.district, 'uf', g.uf,
        'band', g.band, 'radius', g.radius, 'rMin', g.r_min, 'rMax', g.r_max,
        'areaKm2', g.area_km2, 'kind', g.kind,
        'center', case when g.center_lng is null or g.center_lat is null then null
                  else jsonb_build_array(g.center_lng, g.center_lat) end,
        'policyClientId', pol.client_id,
        'geojson', g.geojson
      )), '[]'::jsonb)
      from public.polygons_geo g
      join public.stores s on s.id = g.store_id
      left join public.policies pol on pol.id = g.policy_id
    ),
    'statePolygons', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'uf', sp.uf, 'name', sp.name, 'source', sp.source,
        'updatedAt', sp.updated_at, 'geojson', sp.geojson
      ) order by sp.uf), '[]'::jsonb)
      from public.state_polygons_geo sp
    ),
    'dockLinks', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'store', s.name, 'dock', d.dock, 'policyClientId', p.client_id
      )), '[]'::jsonb)
      from public.policy_docks d
      join public.stores s on s.id = d.store_id
      join public.policies p on p.id = d.policy_id
    ),
    'policyCells', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'store', c.store, 'modality', c.modality, 'status', c.status, 'note', c.note
      )), '[]'::jsonb)
      from public.policy_cells c
    ),
    'customModalities', (
      select coalesce(jsonb_agg(m.name order by m.position, m.name), '[]'::jsonb)
      from public.modalities m
    ),
    'audit', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id, 'at', a.at, 'store', a.store, 'module', a.module,
        'field', a.field, 'before', a.before, 'after', a.after,
        'action', a.action, 'description', a.description
      ) order by a.at desc), '[]'::jsonb)
      from (select * from public.audit_log order by at desc limit 2000) a
    )
  );
$function$;