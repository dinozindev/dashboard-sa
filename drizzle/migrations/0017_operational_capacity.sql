-- Configuração de capacidade operacional por loja
create table if not exists public.capacity_settings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  status text not null default 'active' check (status in ('active','paused')),
  unit text not null default 'orders' check (unit in ('orders')),
  unlimited boolean not null default false,
  -- Regra ao atingir a capacidade máxima do dia
  overflow_rule text not null default 'continue_next_days'
    check (overflow_rule in ('continue_next_days','pause_until_end_of_day')),
  -- Sempre D+3 por enquanto
  overflow_days integer not null default 3 check (overflow_days = 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id)
);
grant select, insert, update, delete on public.capacity_settings to anon, authenticated;
grant all on public.capacity_settings to service_role;
alter table public.capacity_settings enable row level security;
drop policy if exists capacity_settings_public on public.capacity_settings;
create policy capacity_settings_public on public.capacity_settings for all to anon, authenticated using (true) with check (true);

-- Capacidade por política comercial e por dia da semana (unidade = pedidos)
create table if not exists public.capacity_policies (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  policy text not null check (policy in ('Ecommerce','Televendas','Venda Assistida','App')),
  -- Política principal (Ecommerce) é obrigatória para toda loja
  is_primary boolean not null default false,
  enabled boolean not null default true,
  limits jsonb not null default '{"mon":0,"tue":0,"wed":0,"thu":0,"fri":0,"sat":0,"sun":0}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, policy)
);
grant select, insert, update, delete on public.capacity_policies to anon, authenticated;
grant all on public.capacity_policies to service_role;
alter table public.capacity_policies enable row level security;
drop policy if exists capacity_policies_public on public.capacity_policies;
create policy capacity_policies_public on public.capacity_policies for all to anon, authenticated using (true) with check (true);

-- Consumo diário de pedidos (inclui transbordo de dias anteriores)
create table if not exists public.capacity_consumption (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  policy text not null,
  day date not null,
  orders integer not null default 0,
  carried_over integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, policy, day)
);
grant select, insert, update, delete on public.capacity_consumption to anon, authenticated;
grant all on public.capacity_consumption to service_role;
alter table public.capacity_consumption enable row level security;
drop policy if exists capacity_consumption_public on public.capacity_consumption;
create policy capacity_consumption_public on public.capacity_consumption for all to anon, authenticated using (true) with check (true);

create index if not exists capacity_consumption_store_day_idx on public.capacity_consumption (store_id, day);

-- Toda loja nasce com configuração e com a política principal Ecommerce
create or replace function public.create_store_capacity() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.capacity_settings (store_id) values (new.id)
    on conflict (store_id) do nothing;
  insert into public.capacity_policies (store_id, policy, is_primary, limits)
    values (new.id, 'Ecommerce', true,
      '{"mon":50,"tue":50,"wed":50,"thu":50,"fri":50,"sat":30,"sun":0}'::jsonb)
    on conflict (store_id, policy) do nothing;
  return new;
end $$;
drop trigger if exists trg_stores_capacity on public.stores;
create trigger trg_stores_capacity after insert on public.stores
for each row execute function public.create_store_capacity();

-- Backfill das lojas já cadastradas
insert into public.capacity_settings (store_id)
select s.id from public.stores s
on conflict (store_id) do nothing;

insert into public.capacity_policies (store_id, policy, is_primary, limits)
select s.id, 'Ecommerce', true,
  '{"mon":50,"tue":50,"wed":50,"thu":50,"fri":50,"sat":30,"sun":0}'::jsonb
from public.stores s
on conflict (store_id, policy) do nothing;