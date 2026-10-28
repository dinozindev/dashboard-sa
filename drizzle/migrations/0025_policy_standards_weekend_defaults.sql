update public.policy_standards
set rules = rules || '{"saturday":false,"sunday":false,"holidays":false}'::jsonb,
    updated_at = now()
where store_id is null
  and modality = 'Pequenos Volumes';
