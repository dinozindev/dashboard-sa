create table if not exists public.pickup_points (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  kind text not null check (kind in ('facil','bordero')),
  name text not null,
  active boolean not null default true,
  instructions text not null default '',
  address text,
  tags text[] not null default '{}',
  hours jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, kind)
);
grant select, insert, update, delete on public.pickup_points to anon, authenticated;
grant all on public.pickup_points to service_role;
alter table public.pickup_points enable row level security;
drop policy if exists pickup_points_public on public.pickup_points;
create policy pickup_points_public on public.pickup_points for all to anon, authenticated using (true) with check (true);

create or replace function public.create_store_pickup_points() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.pickup_points (store_id, kind, name) values
    (new.id, 'facil', 'Retira Fácil ' || new.name),
    (new.id, 'bordero', 'Saldo Borderô ' || new.name)
  on conflict (store_id, kind) do nothing;
  return new;
end $$;
drop trigger if exists trg_stores_pickup_points on public.stores;
create trigger trg_stores_pickup_points after insert on public.stores
for each row execute function public.create_store_pickup_points();

update public.stores s set center_lng = v.lng, center_lat = v.lat
from (values
 ('Mooca',-46.6113564654685,-23.56088136326968),
 ('Cariacica',-40.37826047548638,-20.335874741503034),
 ('Uberlândia',-48.23614046189743,-18.90190255740677),
 ('Londrina',-51.217273661776694,-23.292324242915594),
 ('Benfica',-43.2371417624566,-22.881166961761757),
 ('Niteroi',-43.09042409999999,-22.82741676720905),
 ('Duque de Caxias',-43.29116534417861,-22.708789645687467),
 ('Guadalupe',-43.37308029247579,-22.843784672329406),
 ('Jacarepagua',-43.3723945,-22.949549939816514),
 ('Mesquita',-43.404454748299365,-22.77444134842054),
 ('Aricanduva',-46.504631504096785,-23.563469961677562),
 ('Suzano',-46.29744225767144,-23.5381963735397),
 ('Praia Grande',-46.42876150685765,-24.003408684881958),
 ('Piracicaba',-47.596902248090366,-22.753466856244554),
 ('Brasília Sul',-47.945406481011545,-15.788834387383728),
 ('Taguatinga',-48.08120973681927,-15.832893278219895),
 ('Contagem',-44.02637300828415,-19.93789616750126),
 ('Aparecida de Goiânia',-49.24190909278364,-16.753090073544545),
 ('Varzea Grande',-56.10945374441767,-15.622574453758359)
) as v(name,lng,lat) where s.name = v.name;

insert into public.stores (name, region, center_lng, center_lat)
select 'CD Mauá','SP',-46.48108363164709,-23.65655823282433
where not exists (select 1 from public.stores where name = 'CD Mauá');

insert into public.pickup_points (store_id, kind, name)
select s.id, k.kind, case k.kind when 'facil' then 'Retira Fácil ' else 'Saldo Borderô ' end || s.name
from public.stores s cross join (values ('facil'),('bordero')) k(kind)
on conflict (store_id, kind) do nothing;

do $$
begin
  if not exists (select 1 from pg_proc where proname = 'get_freight_snapshot_core' and pronamespace = 'public'::regnamespace) then
    alter function public.get_freight_snapshot() rename to get_freight_snapshot_core;
  end if;
end $$;

create or replace function public.get_freight_snapshot()
returns json language sql stable as $function$
  select (
    public.get_freight_snapshot_core()::jsonb || jsonb_build_object(
      'pickupPoints', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', pp.id, 'store', s.name, 'kind', pp.kind, 'name', pp.name,
          'active', pp.active, 'instructions', pp.instructions,
          'address', pp.address, 'tags', to_jsonb(pp.tags), 'hours', pp.hours,
          'center', case when s.center_lng is null or s.center_lat is null then null
                    else jsonb_build_array(s.center_lng, s.center_lat) end
        ) order by s.name, pp.kind desc), '[]'::jsonb)
        from public.pickup_points pp join public.stores s on s.id = pp.store_id
      )
    )
  )::json;
$function$;
grant execute on function public.get_freight_snapshot() to anon, authenticated, service_role;
grant execute on function public.get_freight_snapshot_core() to anon, authenticated, service_role;