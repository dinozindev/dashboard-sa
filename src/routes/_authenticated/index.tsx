import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Dashboard from "@/components/dashboard/Dashboard";
import { supabase } from "@/integrations/supabase/client";
import { isCorporateEmail, type AppRole } from "@/lib/auth/roles";

const title = "Obramax · Dashboard Interativo de Frete";
const description =
  "Mapa interativo de áreas de entrega, tarifas por faixa de peso, políticas de envio, horários e capacidade operacional das lojas Obramax.";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: role, isLoading } = useQuery({
    queryKey: ["my-role", user.id],
    queryFn: async (): Promise<AppRole> => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return (data?.role as AppRole | undefined) ?? "consultor";
    },
  });

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (!isCorporateEmail(user.email)) {
    void signOut();
    return null;
  }

  if (isLoading || !role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-subtle text-sm text-muted-foreground">
        Carregando seu acesso…
      </div>
    );
  }

  return <Dashboard role={role} userEmail={user.email ?? ""} userId={user.id} onSignOut={signOut} />;
}
