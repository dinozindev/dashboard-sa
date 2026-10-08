alter table public.audit_log
  add column if not exists actor text;
