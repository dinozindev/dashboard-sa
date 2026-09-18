alter table public.freight_tables add column if not exists polygon_name text;

CREATE OR REPLACE FUNCTION public.get_freight_snapshot()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
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
        'polygonName', t.polygon_name,
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
        'uf', sp.uf, 'name', sp.name, 'polygonName', sp.polygon_name, 'source', sp.source,
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