/**
 * DOCAS POR LOJA
 * ==============
 *
 * Cada loja possui 3 docas fixas. As associações entre docas e políticas de
 * envio ficam salvas em JSON no navegador (localStorage), sem backend.
 */

import { useEffect, useSyncExternalStore } from "react";
import { logAudit } from "./audit-log";

export const DOCKS = ["Doca Principal", "Doca Televendas", "Doca Venda Assistida"] as const;
export type DockName = (typeof DOCKS)[number];

/** chave: `${loja}||${doca}` → ids de políticas associadas */
export type DockLinks = Record<string, string[]>;

export const DOCK_LINKS_STORAGE_KEY = "freight.dock-links.v1";

const EMPTY: DockLinks = {};

let links: DockLinks = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

const emit = () => {
  for (const l of listeners) l();
};

export const dockKey = (store: string, dock: DockName) => `${store}||${dock}`;

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DOCK_LINKS_STORAGE_KEY, JSON.stringify(links));
  } catch {
    /* storage indisponível */
  }
}

function normalize(value: unknown): DockLinks {
  if (!value || typeof value !== "object") return {};
  const out: DockLinks = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (Array.isArray(v)) out[k] = v.filter((x): x is string => typeof x === "string");
  }
  return out;
}

export function hydrateDockLinks() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(DOCK_LINKS_STORAGE_KEY);
    if (!raw) return;
    const parsed = normalize(JSON.parse(raw));
    if (Object.keys(parsed).length) {
      links = parsed;
      emit();
    }
  } catch {
    /* JSON inválido */
  }
}

export const subscribeDockLinks = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export const getDockLinks = () => links;

export const getDockPolicies = (store: string, dock: DockName) => links[dockKey(store, dock)] ?? [];

/** Vincula ou desvincula uma política de uma doca, registrando na auditoria. */
export function toggleDockPolicy(
  store: string,
  dock: DockName,
  policyId: string,
  policyLabel: string,
) {
  const key = dockKey(store, dock);
  const current = links[key] ?? [];
  const linked = current.includes(policyId);
  const next = linked ? current.filter((id) => id !== policyId) : [...current, policyId];
  links = { ...links, [key]: next };
  persist();
  emit();

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
  const next: DockLinks = {};
  for (const [k, v] of Object.entries(links)) {
    const filtered = v.filter((id) => id !== policyId);
    if (filtered.length !== v.length) changed = true;
    next[k] = filtered;
  }
  if (!changed) return;
  links = next;
  persist();
  emit();
}

export function useDockLinks() {
  useEffect(() => {
    hydrateDockLinks();
  }, []);
  return useSyncExternalStore(subscribeDockLinks, getDockLinks, () => EMPTY);
}
