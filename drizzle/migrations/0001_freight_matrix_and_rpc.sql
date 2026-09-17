-- Matriz de políticas (células por loja×modalidade) e modalidades adicionais
create table public.policy_cells (
  store text not null,
  modality text not null,
  status text not null default 'Não informada',
  note text not null default '',
  primary key (store, modality)
);

create table public.modalities (
  name text primary key,
  position integer not null default 0
);

-- Inserção de polígonos em lote, convertendo GeoJSON para PostGIS.
-- Linhas com geometria inválida ou dados ausentes são ignoradas (nada é inventado).
create or replace function public.insert_polygons(payload jsonb)
returns integer
language plpgsql
as $$
declare
  x jsonb;
  inserted integer := 0;
begin
  for x in select * from jsonb_array_elements(payload) loop
    begin
      insert into public.polygons (
        client_id, store_id, policy_id, district, uf, band, radius,
        r_min, r_max, area_km2, center_lng, center_lat, geom
      ) values (
        x->>'clientId',
        (x->>'storeId')::uuid,
        (x->>'policyId')::uuid,
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
      inserted := inserted + 1;
    exception when others then
      null;
    end;
  end loop;
  return inserted;
end;
$$;

-- Leitura completa do estado compartilhado em uma única chamada
create or replace function public.get_freight_snapshot()
returns jsonb
language sql
stable
as $$
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
        'areaKm2', g.area_km2,
        'center', case when g.center_lng is null or g.center_lat is null then null
                  else jsonb_build_array(g.center_lng, g.center_lat) end,
        'policyClientId', pol.client_id,
        'geojson', g.geojson
      )), '[]'::jsonb)
      from public.polygons_geo g
      join public.stores s on s.id = g.store_id
      join public.policies pol on pol.id = g.policy_id
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
$$;

grant select, insert, update, delete on public.policy_cells, public.modalities to anon, authenticated;
grant all on public.policy_cells, public.modalities to service_role;
alter table public.policy_cells enable row level security;
alter table public.modalities enable row level security;
create policy "policy_cells_public" on public.policy_cells for all using (true) with check (true);
create policy "modalities_public" on public.modalities for all using (true) with check (true);

grant execute on function public.insert_polygons(jsonb) to anon, authenticated;
grant execute on function public.get_freight_snapshot() to anon, authenticated;