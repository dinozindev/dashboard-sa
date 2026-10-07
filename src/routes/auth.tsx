import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { isCorporateEmail } from "@/lib/auth/roles";

const title = "Entrar · Obramax Dashboard de Frete";
const description = "Acesso restrito a colaboradores Obramax com e-mail corporativo.";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      if (!isCorporateEmail(data.user.email)) {
        await supabase.auth.signOut();
        setError("Acesso permitido apenas para e-mails @obramax.com.br ou @ext.obramax.com.br.");
        return;
      }
      setRedirecting(true);
      await navigate({ to: "/", replace: true });
    };
    void check();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") void check();
    });
    // Erros vindos do retorno do Google (ex.: domínio bloqueado no cadastro)
    const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search);
    if (params.get("error")) {
      const desc = (params.get("error_description") ?? "").replace(/\+/g, " ");
      setError(
        /obramax|corporativ/i.test(desc)
          ? "Acesso permitido apenas para e-mails @obramax.com.br ou @ext.obramax.com.br."
          : `Não foi possível entrar: ${desc || params.get("error")}`,
      );
    }
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const signIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/auth`,
      });
      if (result && "error" in result && result.error) {
        setError("Não foi possível entrar. Use seu e-mail corporativo Obramax.");
      }
    } catch {
      setError("Não foi possível entrar. Use seu e-mail corporativo Obramax.");
    } finally {
      setLoading(false);
    }
  };

  if (redirecting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-gradient px-4">
        <div className="surface w-full max-w-sm space-y-5 p-8 text-center">
          <span
            aria-hidden
            className="mx-auto block h-9 w-9 animate-spin rounded-full border-2 border-primary/20 border-t-primary"
          />
          <div>
            <h1 className="font-display text-lg font-semibold text-foreground">Entrando…</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Preparando seu dashboard, só um instante.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-gradient px-4">
      <div className="surface w-full max-w-sm space-y-6 p-8 text-center">
        <span className="bg-accent-gradient mx-auto flex h-12 w-12 items-center justify-center rounded-lg font-display text-lg font-bold text-primary-foreground shadow-brand">
          OX
        </span>
        <div>
          <h1 className="font-display text-xl font-bold text-foreground">Dashboard de Frete</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Entre com seu e-mail corporativo. Você será direcionado ao PingID da Obramax.
          </p>
        </div>
        <button
          type="button"
          onClick={signIn}
          disabled={loading}
          className="btn-primary w-full justify-center"
        >
          {loading ? "Redirecionando…" : "Entrar com e-mail corporativo"}
        </button>
        {error ? (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
            {error}
          </p>
        ) : null}
        <p className="text-[11px] text-muted-foreground">
          Apenas @obramax.com.br e @ext.obramax.com.br
        </p>
      </div>
    </div>
  );
}
