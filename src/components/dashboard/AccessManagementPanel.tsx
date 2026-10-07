import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABELS, type AppRole } from "@/lib/auth/roles";
import { logAudit } from "@/lib/freight/audit-log";

type Row = { user_id: string; email: string; full_name: string | null; role: AppRole; created_at: string };

/** Gestão de acessos: auditores alteram o perfil de cada colaborador. */
export function AccessManagementPanel({ currentUserId, currentEmail }: { currentUserId: string; currentEmail: string }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, email, full_name, role, created_at")
        .order("created_at");
      if (error) throw error;
      return data as Row[];
    },
  });

  const change = useMutation({
    mutationFn: async ({ row, role }: { row: Row; role: AppRole }) => {
      const { error } = await supabase.from("user_roles").update({ role }).eq("user_id", row.user_id);
      if (error) throw error;
      void logAudit({
        store: "—",
        module: "Gestão de Acessos",
        field: "Perfil",
        before: ROLE_LABELS[row.role],
        after: ROLE_LABELS[role],
        action: "Edição",
        description: `${currentEmail} alterou o perfil de ${row.email}`,
      });
    },
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ["user-roles"] });
    },
    onError: (e: Error) => setError(e.message.includes("último auditor") ? "Não é possível remover o último auditor." : e.message),
  });

  return (
    <section className="surface p-4">
      <h2 className="section-title text-lg">Gestão de Acessos</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Colaboradores que já entraram no sistema. Novos acessos começam como Consultor.
      </p>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-2">Nome</th>
              <th>E-mail</th>
              <th>Primeiro acesso</th>
              <th>Perfil</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} className="py-3 text-muted-foreground">Carregando…</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.user_id} className="border-t border-border">
                  <td className="py-2">{r.full_name ?? "—"}{r.user_id === currentUserId ? " (você)" : ""}</td>
                  <td>{r.email}</td>
                  <td>{new Date(r.created_at).toLocaleDateString("pt-BR")}</td>
                  <td>
                    <select
                      className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                      value={r.role}
                      disabled={change.isPending}
                      onChange={(e) => {
                        const role = e.target.value as AppRole;
                        if (role === "auditor" && !window.confirm(`Promover ${r.email} a Auditor?`)) return;
                        change.mutate({ row: r, role });
                      }}
                    >
                      {(Object.keys(ROLE_LABELS) as AppRole[]).map((k) => (
                        <option key={k} value={k}>{ROLE_LABELS[k]}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
