CREATE TYPE public.app_role AS ENUM ('consultor', 'editor', 'auditor');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  role public.app_role NOT NULL DEFAULT 'consultor',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "own role readable" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'auditor'));
CREATE POLICY "auditors update roles" ON public.user_roles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'auditor'))
  WITH CHECK (public.has_role(auth.uid(), 'auditor'));

-- Only the role column may change, and the last auditor cannot be demoted.
CREATE OR REPLACE FUNCTION public.guard_user_role_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.user_id := OLD.user_id;
  NEW.email := OLD.email;
  NEW.created_at := OLD.created_at;
  NEW.updated_at := now();
  IF OLD.role = 'auditor' AND NEW.role <> 'auditor'
     AND (SELECT count(*) FROM public.user_roles WHERE role = 'auditor') <= 1 THEN
    RAISE EXCEPTION 'Não é possível remover o último auditor';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_guard_user_role_update BEFORE UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.guard_user_role_update();

-- Corporate domain gate + initial role on signup.
CREATE OR REPLACE FUNCTION public.handle_corporate_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  dom text := lower(split_part(coalesce(NEW.email, ''), '@', 2));
BEGIN
  IF dom NOT IN ('obramax.com.br', 'ext.obramax.com.br') THEN
    RAISE EXCEPTION 'Acesso permitido apenas para e-mails corporativos Obramax';
  END IF;
  INSERT INTO public.user_roles (user_id, email, full_name, role)
  VALUES (
    NEW.id, lower(NEW.email),
    coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    CASE WHEN lower(NEW.email) = 'lkenji@ext.obramax.com.br' AND NEW.email_confirmed_at IS NOT NULL
         THEN 'auditor'::public.app_role ELSE 'consultor'::public.app_role END
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created_corporate AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_corporate_user();

CREATE OR REPLACE FUNCTION public.promote_initial_auditor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF lower(NEW.email) = 'lkenji@ext.obramax.com.br' THEN
    UPDATE public.user_roles SET role = 'auditor' WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_confirmed_auditor AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.promote_initial_auditor();