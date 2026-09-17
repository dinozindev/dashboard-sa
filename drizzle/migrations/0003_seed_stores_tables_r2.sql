-- Corrige a RPC: aceita policyId como client_id (texto) ou uuid; conta só linhas realmente inseridas
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
        coalesce(
          (select p.id from public.policies p where p.client_id = x->>'policyId'),
          nullif(x->>'policyId','')::uuid
        ),
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
$$;

grant execute on function public.insert_polygons(jsonb) to anon, authenticated;

-- Seed: 11 lojas + tabelas de frete padrão (dados originais) — polígonos nas migrações seguintes
insert into public.stores (name, region, note, center_lng, center_lat) values ('Aricanduva', 'SP', 'Ponto de referencia calculado como centroide ponderado dos poligonos da faixa 5KM do GeoJSON.', -46.50443, -23.56425) on conflict (name) do nothing;
insert into public.stores (name, region, note, center_lng, center_lat) values ('Suzano', 'SP', 'Ponto de referencia calculado como centroide ponderado dos poligonos da faixa 5KM do GeoJSON.', -46.29299, -23.53124) on conflict (name) do nothing;
insert into public.stores (name, region, note, center_lng, center_lat) values ('Jacarepagua', 'RJ', 'Ponto de referencia calculado como centroide ponderado dos poligonos de 5 km do GeoJSON da loja.', -43.37882, -22.96105) on conflict (name) do nothing;
insert into public.stores (name, region, note, center_lng, center_lat) values ('Guadalupe', 'RJ', 'Ponto de referencia calculado como centroide ponderado dos poligonos de 5 km do GeoJSON da loja.', -43.37096, -22.84484) on conflict (name) do nothing;
insert into public.stores (name, region, note, center_lng, center_lat) values ('Duque de Caxias', 'RJ', 'Ponto de referencia calculado como centroide ponderado dos poligonos de 5 km do GeoJSON da loja.', -43.28866, -22.71125) on conflict (name) do nothing;
insert into public.stores (name, region, note, center_lng, center_lat) values ('Benfica', 'RJ', 'Ponto de referencia calculado como centroide ponderado dos poligonos de 5 km do GeoJSON da loja.', -43.24371, -22.88381) on conflict (name) do nothing;
insert into public.stores (name, region, note, center_lng, center_lat) values ('Mesquita', 'RJ', 'Ponto de referencia calculado como centroide ponderado dos poligonos de 5 km do GeoJSON da loja.', -43.40387, -22.77364) on conflict (name) do nothing;
insert into public.stores (name, region, note, center_lng, center_lat) values ('Niteroi', 'RJ', 'Ponto de referencia calculado como centroide ponderado dos poligonos de 5 km do GeoJSON da loja.', -43.07776, -22.83702) on conflict (name) do nothing;
insert into public.stores (name, region, note, center_lng, center_lat) values ('Praia Grande', 'SP', 'Ponto de referencia calculado como centroide ponderado dos poligonos de 5 km do GeoJSON da loja.', -46.42736, -23.99638) on conflict (name) do nothing;
insert into public.stores (name, region, note, center_lng, center_lat) values ('Piracicaba', 'SP', 'Ponto de referencia calculado como centroide ponderado dos poligonos de 5 km do GeoJSON da loja.', -47.58791, -22.75539) on conflict (name) do nothing;
insert into public.stores (name, region, note, center_lng, center_lat) values ('Mooca', 'SP', 'Ponto de referencia calculado como centroide ponderado dos poligonos de 5 km do GeoJSON da loja.', -46.6113, -23.56175) on conflict (name) do nothing;
