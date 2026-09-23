CREATE OR REPLACE FUNCTION public.get_freight_snapshot()
RETURNS json
LANGUAGE sql
STABLE
AS $function$
  SELECT json_build_object(
    'stores', (
      SELECT coalesce(json_agg(json_build_object(
        'name', s.name, 'region', s.region, 'note', s.note,
        'center', CASE WHEN s.center_lng IS NULL OR s.center_lat IS NULL THEN NULL
                  ELSE json_build_array(s.center_lng, s.center_lat) END,
        'polygonCount', coalesce(pc.cnt, 0)
      ) ORDER BY s.name), '[]'::json)
      FROM public.stores s
      LEFT JOIN (SELECT store_id, count(*) AS cnt FROM public.polygons GROUP BY store_id) pc
        ON pc.store_id = s.id
    ),
    'policies', (
      SELECT coalesce(json_agg(json_build_object(
        'clientId', p.client_id, 'store', s.name, 'data', p.data, 'updatedAt', p.updated_at
      ) ORDER BY p.created_at), '[]'::json)
      FROM public.policies p
      JOIN public.stores s ON s.id = p.store_id
    ),
    'freightTables', (
      SELECT coalesce(json_agg(json_build_object(
        'id', t.id, 'store', s.name, 'policyClientId', pol.client_id,
        'name', t.name, 'source', t.source, 'fileName', t.file_name,
        'polygonName', t.polygon_name,
        'bands', (
          SELECT coalesce(json_agg(json_build_object(
            'ws', b.ws, 'we', b.we, 'amc', b.amc, 'pew', b.pew,
            'pct', b.pct, 'maxVol', b.max_vol, 'time', b.time,
            'country', b.country, 'minIns', b.min_ins
          ) ORDER BY b.band_index), '[]'::json)
          FROM public.freight_bands b WHERE b.table_id = t.id
        )
      )), '[]'::json)
      FROM public.freight_tables t
      JOIN public.stores s ON s.id = t.store_id
      LEFT JOIN public.policies pol ON pol.id = t.policy_id
    ),
    'polygons', (
      SELECT coalesce(json_agg(json_build_object(
        'id', g.client_id, 'store', s.name, 'district', g.district, 'uf', g.uf,
        'band', g.band, 'radius', g.radius, 'rMin', g.r_min, 'rMax', g.r_max,
        'areaKm2', g.area_km2, 'kind', g.kind,
        'center', CASE WHEN g.center_lng IS NULL OR g.center_lat IS NULL THEN NULL
                  ELSE json_build_array(g.center_lng, g.center_lat) END,
        'policyClientId', pol.client_id,
        'geojson', g.geojson
      )), '[]'::json)
      FROM public.polygons_geo g
      JOIN public.stores s ON s.id = g.store_id
      LEFT JOIN public.policies pol ON pol.id = g.policy_id
    ),
    'statePolygons', (
      SELECT coalesce(json_agg(json_build_object(
        'uf', sp.uf, 'name', sp.name, 'polygonName', sp.polygon_name, 'source', sp.source,
        'updatedAt', sp.updated_at, 'geojson', sp.geojson
      ) ORDER BY sp.uf), '[]'::json)
      FROM public.state_polygons_geo sp
    ),
    'pickupPoints', (
      SELECT coalesce(json_agg(json_build_object(
        'id', pp.id, 'store', s.name, 'kind', pp.kind, 'name', pp.name,
        'active', pp.active, 'instructions', pp.instructions,
        'address', pp.address, 'tags', pp.tags, 'hours', pp.hours,
        'center', CASE WHEN s.center_lng IS NULL OR s.center_lat IS NULL THEN NULL
                  ELSE json_build_array(s.center_lng, s.center_lat) END
      ) ORDER BY s.name, pp.kind DESC), '[]'::json)
      FROM public.pickup_points pp
      JOIN public.stores s ON s.id = pp.store_id
    ),
    'dockLinks', (
      SELECT coalesce(json_agg(json_build_object(
        'store', s.name, 'dock', d.dock, 'policyClientId', p.client_id
      )), '[]'::json)
      FROM public.policy_docks d
      JOIN public.stores s ON s.id = d.store_id
      JOIN public.policies p ON p.id = d.policy_id
    ),
    'policyCells', (
      SELECT coalesce(json_agg(json_build_object(
        'store', c.store, 'modality', c.modality, 'status', c.status, 'note', c.note
      )), '[]'::json)
      FROM public.policy_cells c
    ),
    'customModalities', (
      SELECT coalesce(json_agg(m.name ORDER BY m.position, m.name), '[]'::json)
      FROM public.modalities m
    ),
    'audit', (
      SELECT coalesce(json_agg(json_build_object(
        'id', a.id, 'at', a.at, 'store', a.store, 'module', a.module,
        'field', a.field, 'before', a.before, 'after', a.after,
        'action', a.action, 'description', a.description
      ) ORDER BY a.at DESC), '[]'::json)
      FROM (SELECT * FROM public.audit_log ORDER BY at DESC LIMIT 2000) a
    )
  );
$function$;

GRANT EXECUTE ON FUNCTION public.get_freight_snapshot() TO anon, authenticated, service_role;