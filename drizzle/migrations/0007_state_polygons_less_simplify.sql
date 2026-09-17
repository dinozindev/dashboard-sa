create or replace view public.state_polygons_geo as
  select id, uf, name, source, updated_at,
    st_asgeojson(st_simplifypreservetopology(geom, 0.0001::double precision))::json as geojson
  from public.state_polygons;

grant select on public.state_polygons_geo to anon, authenticated;
grant all on public.state_polygons_geo to service_role;