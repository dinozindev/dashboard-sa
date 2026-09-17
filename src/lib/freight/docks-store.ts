/**
 * DOCAS POR LOJA
 * ==============
 *
 * Cada loja possui 3 docas fixas. As associações entre docas e políticas de
 * envio ficam gravadas no banco — visíveis para todas as pessoas.
 */

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { commitLocal, getLive, refreshLive, regionForStore, subscribeLive } from "./live";
import { removePolicyFromAllDocks, setDockLink } from "./remote.functions";
import { logAudit } from "./audit-log";

export const DOCKS = ["Doca Principal", "Doca Televendas", "Doca Venda Assistida"] as const;
export type DockName = (typeof DOCKS)[number];

/** chave: `${loja}||${doca}` → ids de políticas associadas */
export type DockLinks = Record<string, string[]>;

/** Mantido por compatibilidade com importações antigas. */
export const DOCK_LINKS_STORAGE_KEY = "freight.dock-links.v1";

export const dockKey = (store: string, dock: DockName) => `${store}||${dock}`;

export function hydrateDockLinks() {
  void refreshLive();
}

export const subscribeDockLinks = subscribeLive;

function buildLinks(live: ReturnType<typeof getLive>): DockLinks {
  const out: DockLinks = {};
  for (const link of live?.snapshot.dockLinks ?? []) {
    const key = `${link.store}||${link.dock}`;
    (out[key] ??= []).push(link.policyClientId);
  }
  return out;
}

export function getDockLinks(): DockLinks {
  return buildLinks(getLive());
}

export function getDockPolicies(store: string, dock: DockName) {
  return getDockLinks()[dockKey(store, dock)] ?? [];
}

export function useDockLinks() {
  useEffect(() => {
    void refreshLive();
  }, []);
  const live = useSyncExternalStore(subscribeLive, getLive, () => null);
  return useMemo(() => buildLinks(live), [live]);
}

/** Vincula ou desvincula uma política de uma doca, registrando na auditoria. */
export function toggleDockPolicy(
  store: string,
  dock: DockName,
  policyId: string,
  policyLabel: string,
) {
  const current = getDockPolicies(store, dock);
  const linked = current.includes(policyId);
  commitLocal((state) => {
    if (linked) {
      state.snapshot.dockLinks = state.snapshot.dockLinks.filter(
        (l) => !(l.store === store && l.dock === dock && l.policyClientId === policyId),
      );
    } else {
      state.snapshot.dockLinks.push({ store, dock, policyClientId: policyId });
    }
  });

  void setDockLink({
    data: { store, region: regionForStore(store) ?? "SP", dock, policyClientId: policyId, linked: !linked },
  })
    .then(() => refreshLive())
    .catch((err) => {
      console.error("Falha ao associar política à doca", err);
      void refreshLive();
    });

  logAudit({
    store,
    module: "Docas",
    field: `Associação — ${dock}`,
    before: linked ? policyLabel : "—",
    after: linked ? "—" : policyLabel,
    action: linked ? "Remoção" : "Adição",
    description: linked
      ? `Política "${policyLabel}" desvinculada da ${dock} na loja ${store}`
      : `Política "${policyLabel}" vinculada à ${dock} na loja ${store}`,
  });
  return !linked;
}

/** Remove uma política de todas as docas (usado ao excluir a política). */
export function removePolicyFromDocks(policyId: string) {
  let changed = false;
  commitLocal((state) => {
    const before = state.snapshot.dockLinks.length;
    state.snapshot.dockLinks = state.snapshot.dockLinks.filter(
      (l) => l.policyClientId !== policyId,
    );
    changed = state.snapshot.dockLinks.length !== before;
  });
  if (!changed) return;
  void removePolicyFromAllDocks({ data: { policyClientId: policyId } })
    .then(() => refreshLive())
    .catch(() => void refreshLive());
}
