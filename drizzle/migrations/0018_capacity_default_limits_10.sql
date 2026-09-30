-- Toda loja nova nasce com capacidade de 10 pedidos por dia (domingo fechado)
create or replace function public.create_store_capacity() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.capacity_settings (store_id) values (new.id)
    on conflict (store_id) do nothing;
  insert into public.capacity_policies (store_id, policy, is_primary, limits)
    values (new.id, 'Ecommerce', true,
      '{"mon":10,"tue":10,"wed":10,"thu":10,"fri":10,"sat":10,"sun":0}'::jsonb)
    on conflict (store_id, policy) do nothing;
  return new;
end $$;

drop trigger if exists trg_stores_capacity on public.stores;
create trigger trg_stores_capacity after insert on public.stores
for each row execute function public.create_store_capacity();

-- Rede de segurança: preenche lojas existentes sem configuração ou sem a política principal
insert into public.capacity_settings (store_id)
select s.id from public.stores s
on conflict (store_id) do nothing;

insert into public.capacity_policies (store_id, policy, is_primary, limits)
select s.id, 'Ecommerce', true,
  '{"mon":10,"tue":10,"wed":10,"thu":10,"fri":10,"sat":10,"sun":0}'::jsonb
from public.stores s
on conflict (store_id, policy) do nothing;