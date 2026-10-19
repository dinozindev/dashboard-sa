ALTER TABLE public.holidays DROP CONSTRAINT IF EXISTS holidays_scope_check;
ALTER TABLE public.holidays ADD CONSTRAINT holidays_scope_check CHECK (scope IN ('nacional','estadual','municipal'));
ALTER TABLE public.holidays ADD COLUMN IF NOT EXISTS store_ids uuid[] NOT NULL DEFAULT '{}';