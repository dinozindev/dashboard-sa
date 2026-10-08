CREATE TABLE public.holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date,
  scope text NOT NULL DEFAULT 'nacional' CHECK (scope IN ('nacional','estadual')),
  state text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.holidays TO anon, authenticated;
GRANT ALL ON public.holidays TO service_role;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
CREATE POLICY holidays_public ON public.holidays FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.delivery_capacity_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  modality text NOT NULL,
  day date NOT NULL,
  delivery_time text NOT NULL DEFAULT '',
  capacity integer NOT NULL DEFAULT 0,
  reserved integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, modality, day)
);
CREATE INDEX delivery_capacity_days_store_day_idx ON public.delivery_capacity_days (store_id, day);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_capacity_days TO anon, authenticated;
GRANT ALL ON public.delivery_capacity_days TO service_role;
ALTER TABLE public.delivery_capacity_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY delivery_capacity_days_public ON public.delivery_capacity_days FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);