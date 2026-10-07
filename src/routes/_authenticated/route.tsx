import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { isLocalDevelopment } from "@/lib/auth/local-development";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    if (isLocalDevelopment()) return { user: null, isLocalDevelopment: true };

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user, isLocalDevelopment: false };
  },
  component: () => <Outlet />,
});
