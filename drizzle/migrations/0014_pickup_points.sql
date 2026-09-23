create table if not exists public.pickup_points (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  kind text not null check (kind in ('facil','bordero')),
  name text not null,
  active boolean not null default true,
  instructions text not null default '',
  address text,
  tags text[] not null default '{}',
  hours jsonb not null default '[
    {"day":"Segunda","enabled":true,"start":"08:00","end":"18:00"},
    {"day":"Terça","enabled":true,"start":"08:00","end":"18:00"},
    {"day":"Quarta","enabled":true,"start":"08:00","end":"18:00"},
    {"day":"Quinta","enabled":true,"start":"08:00","end":"18:00"},
    {"day":"Sexta","enabled":true,"start":"08:00","end":"18:00"},
    {"day":"Sábado","enabled":true,"start":"08:00","end":"18:00"},
    {"day":"Domingo","enabled":false,"start":"08:00","end":"13:00"}
  ]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, kind)
);

grant select, insert, update, delete on public.pickup_points to anon, authenticated;
grant all on public.pickup_points to service_role;
alter table public.pickup_points enable row level security;
drop policy if exists "pickup_points_public" on public.pickup_points;
create policy "pickup_points_public" on public.pickup_points for all using (true) with check (true);

create or replace function public.pickup_point_name(p_kind text, p_store text)
returns text
language sql
immutable
as $function$
  select case when p_kind = 'facil'
    then 'Retira Fácil ' || upper(p_store)
    else 'Retira Saldo Borderô ' || upper(p_store)
  end;
$function$;

create or replace function public.stores_sync_pickup_points()
returns trigger
language plpgsql
as $function$
begin
  if tg_op = 'INSERT' then
    insert into public.pickup_points (store_id, kind, name)
    values (new.id, 'facil', public.pickup_point_name('facil', new.name)),
           (new.id, 'bordero', public.pickup_point_name('bordero', new.name))
    on conflict (store_id, kind) do nothing;
  elsif tg_op = 'UPDATE' and new.name is distinct from old.name then
    update public.pickup_points
      set name = public.pickup_point_name(kind, new.name), updated_at = now()
      where store_id = new.id;
  end if;
  return new;
end;
$function$;

drop trigger if exists stores_create_pickup_points on public.stores;
create trigger stores_create_pickup_points
  after insert on public.stores
  for each row execute function public.stores_sync_pickup_points();

drop trigger if exists stores_rename_pickup_points on public.stores;
create trigger stores_rename_pickup_points
  after update of name on public.stores
  for each row execute function public.stores_sync_pickup_points();

insert into public.pickup_points (store_id, kind, name)
select s.id, k.kind, public.pickup_point_name(k.kind, s.name)
from public.stores s cross join (values ('facil'),('bordero')) as k(kind)
on conflict (store_id, kind) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_freight_snapshot_core'
  ) then
    alter function public.get_freight_snapshot() rename to get_freight_snapshot_core;
  end if;
end $$;

create or replace function public.get_freight_snapshot()
returns json
language sql
stable
as $function$
  select (
    public.get_freight_snapshot_core()::jsonb || jsonb_build_object(
      'pickupPoints', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', pp.id, 'store', s.name, 'kind', pp.kind, 'name', pp.name,
          'active', pp.active, 'instructions', pp.instructions,
          'address', pp.address, 'tags', to_jsonb(pp.tags), 'hours', pp.hours,
          'center', case when s.center_lng is null or s.center_lat is null then null
                    else jsonb_build_array(s.center_lng, s.center_lat) end
        ) order by s.name, pp.kind), '[]'::jsonb)
        from public.pickup_points pp
        join public.stores s on s.id = pp.store_id
      )
    )
  )::json;
$function$;

grant execute on function public.get_freight_snapshot() to anon, authenticated, service_role;
grant execute on function public.get_freight_snapshot_core() to anon, authenticated, service_role;
