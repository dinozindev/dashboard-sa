create table public.policy_standards (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete cascade,
  modality text not null,
  rules jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create unique index policy_standards_scope_uq
  on public.policy_standards (coalesce(store_id, '00000000-0000-0000-0000-000000000000'::uuid), modality);

grant select, insert, update, delete on public.policy_standards to anon, authenticated;
grant all on public.policy_standards to service_role;
alter table public.policy_standards enable row level security;
create policy "policy_standards public read" on public.policy_standards for select to anon, authenticated using (true);
create policy "policy_standards public insert" on public.policy_standards for insert to anon, authenticated with check (true);
create policy "policy_standards public update" on public.policy_standards for update to anon, authenticated using (true) with check (true);
create policy "policy_standards public delete" on public.policy_standards for delete to anon, authenticated using (true);

insert into public.policy_standards (store_id, modality, rules) values
(null,'Pequenos Volumes','{"largestEdge":220,"sumOfDimensions":null,"cubicWeightFactor":null,"minimumWeightFactor":null,"schedule":{"mode":"coleta","days":"seg-dom","time":"15:00"},"minItems":1}'),
(null,'Retira Fácil (Clique & Retira)','{"schedule":{"mode":"coleta","days":"seg-dom","time":"15:00"},"saturday":true,"minItems":1}'),
(null,'Retira Televendas','{"schedule":{"mode":"coleta","days":"seg-dom","time":"15:00"},"scheduled":{"enabled":true,"maxDays":8,"start":"08:00","end":"21:00"},"saturday":true,"minItems":1}'),
(null,'Retira Imediata','{"schedule":{"mode":"janela","days":"Seg-dom","start":"07:00","end":"21:00"},"saturday":true,"sunday":true,"holidays":true,"minItems":1}'),
(null,'Saldo Borderô','{"schedule":{"mode":"janela","days":"Seg-dom","start":"00:00","end":"23:59"},"saturday":true,"sunday":true,"holidays":true,"minItems":1}'),
(null,'Retira H+4 Ecommerce','{"schedule":{"mode":"janela","days":"Seg-sab","start":"07:00","end":"15:00"},"saturday":true,"minItems":1}'),
(null,'Entrega Normal','{"schedule":{"mode":"coleta","days":"seg-dom","time":"15:00"},"minItems":1}'),
(null,'Entrega Conforto Manhã','{"schedule":{"mode":"coleta","days":"Seg-sab","time":"15:00"},"scheduled":{"enabled":true,"maxDays":7,"start":"08:00","end":"12:00"},"minItems":1}'),
(null,'Entrega Conforto Tarde','{"schedule":{"mode":"coleta","days":"seg-sab","time":"15:00"},"scheduled":{"enabled":true,"maxDays":7,"start":"12:00","end":"18:00"},"minItems":1}'),
(null,'Entrega Agendada','{"schedule":{"mode":"coleta","days":"seg-dom","time":"15:00"},"scheduled":{"enabled":true,"maxDays":8,"start":"07:00","end":"18:00"},"saturday":true,"minItems":1}');