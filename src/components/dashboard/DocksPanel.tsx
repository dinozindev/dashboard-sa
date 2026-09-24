/**
 * DOCAS POR LOJA
 * ==============
 *
 * Lista as lojas cadastradas no banco e suas 3 docas fixas.
 * Ao abrir uma doca, é possível associar ou desvincular as políticas de envio
 * cadastradas para aquela loja. Tudo salvo no banco — igual para todos.
 */

import { useEffect, useMemo, useState } from "react";
import { useSyncExternalStore } from "react";
import { getLive, liveStores, refreshLive, subscribeLive } from "@/lib/freight/live";
import { usePolicyDrafts, type ShippingPolicyDraft } from "@/lib/freight/policy-registry";
import { type RegionSelection } from "@/lib/freight/types";
import {
  DOCKS,
  dockKey,
  toggleDockPolicy,
  useDockLinks,
  type DockName,
} from "@/lib/freight/docks-store";

const policyLabel = (p: ShippingPolicyDraft) =>
  `${p.modalities.join(" · ") || "Sem modalidade"} (${p.policyType})`;

export function DocksPanel({ canEdit }: { canEdit: boolean }) {
  useEffect(() => {
    void refreshLive();
  }, []);
  const live = useSyncExternalStore(subscribeLive, getLive, () => null);
  const drafts = usePolicyDrafts();
  const links = useDockLinks();
  const [open, setOpen] = useState<{ store: string; dock: DockName } | null>(null);
  const [region, setRegion] = useState<RegionSelection>("Todas");
  const availableRegions = useMemo(
    () => Array.from(new Set(liveStores(live).map((store) => store.region))).sort(),
    [live],
  );

  const stores = useMemo(
    () =>
      liveStores(live)
        .filter((s) => region === "Todas" || s.region === region)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [live, region],
  );

  if (open) {
    const storePolicies = drafts.filter((d) => d.store === open.store);
    const linked = links[dockKey(open.store, open.dock)] ?? [];
    return (
      <div className="space-y-3 surface p-4">
        <button type="button" className="btn-ghost text-xs" onClick={() => setOpen(null)}>
          ← Voltar para as docas
        </button>
        <div>
          <h2 className="section-title text-lg">
            {open.dock} · {open.store}
          </h2>
            <p className="text-xs text-muted-foreground">
              {canEdit
                ? "Associe as políticas de envio desta loja à doca. Uma política pode estar associada a mais de uma doca."
                : "Visualize as políticas de envio associadas a esta doca."}
            </p>
        </div>

        {!storePolicies.length ? (
          <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            Nenhuma política cadastrada para {open.store}. Cadastre uma política na aba “Cadastro de
            Política de Envio”.
          </p>
        ) : (
          <div className="space-y-2">
            {storePolicies.map((p) => {
              const isLinked = linked.includes(p.id);
              return (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-xs"
                >
                  <div>
                    <p className="text-sm font-semibold">{policyLabel(p)}</p>
                    <p className="text-muted-foreground">
                      {p.active ? "Ativa" : "Inativa"}
                      {p.assistedSale ? " · venda assistida" : ""}
                    </p>
                  </div>
                  {canEdit ? (
                    <button
                      type="button"
                      className={
                        "rounded-lg px-3 py-1.5 text-xs font-semibold " +
                        (isLinked
                          ? "border border-danger/50 text-danger hover:bg-danger/10"
                          : "bg-primary text-primary-foreground hover:opacity-90")
                      }
                      onClick={() => toggleDockPolicy(open.store, open.dock, p.id, policyLabel(p))}
                    >
                      {isLinked ? "Desvincular" : "Associar"}
                    </button>
                  ) : (
                    <span className="text-xs font-semibold text-muted-foreground">
                      {isLinked ? "Associada" : "Não associada"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 surface p-4">
      <div>
        <h2 className="section-title text-lg">Docas por loja</h2>
        {/* <p className="text-xs text-muted-foreground">
          Cada loja possui três docas. Clique em uma doca para associar as políticas de envio
          cadastradas.
        </p> */}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="field-label">
          Regional
          <select
            className="input mt-1 w-32"
            value={region}
            onChange={(event) => setRegion(event.target.value as RegionSelection)}
          >
            <option value="Todas">Todas</option>
            {availableRegions.map((availableRegion) => (
              <option key={availableRegion} value={availableRegion}>
                {availableRegion}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {stores.map((s) => (
          <div key={s.name} className="rounded-xl border border-border p-3">
            <p className="text-sm font-semibold">{s.name}</p>
            <p className="text-[11px] text-muted-foreground">
              Regional {s.region}
            </p>
            <div className="mt-2 space-y-1.5">
              {DOCKS.map((dock) => {
                const count = (links[dockKey(s.name, dock)] ?? []).length;
                return (
                  <button
                    key={dock}
                    type="button"
                    onClick={() => setOpen({ store: s.name, dock })}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-left text-xs hover:bg-muted/60"
                  >
                    <span className="font-medium">{dock}</span>
                    <span className="text-muted-foreground">
                      {count} política{count === 1 ? "" : "s"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {!stores.length ? (
        <p className="text-xs text-muted-foreground">
          Nenhuma loja cadastrada no banco para este filtro.
        </p>
      ) : null}
    </div>
  );
}
