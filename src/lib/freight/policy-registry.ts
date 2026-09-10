/**
 * REGISTRO DE POLÍTICAS DE ENVIO
 * ==============================
 *
 * Guarda as políticas cadastradas na aba "Cadastro de Política de Envio".
 * Os dados são persistidos como JSON no navegador (localStorage) e podem ser
 * exportados/importados como arquivo .json, no mesmo formato usado aqui.
 */

import { useEffect, useSyncExternalStore } from "react";

export interface ShippingWindow {
  id: string;
  day: string;
  start: string;
  end: string;
}

export interface PickupTime {
  id: string;
  day: string;
  time: string;
}

export interface ShippingPolicyDraft {
  id: string;
  createdAt: string;
  store: string;
  /** Modalidades às quais esta política se aplica (Pequenos Volumes, Retira Fácil, ...) */
  modalities: string[];
  dimensions: {
    sumOfDimensions: number;
    largestEdge: number;
    cubicWeightFactor: number;
    minimumWeightFactor: number;
  };
  weekend: {
    saturday: boolean;
    sunday: boolean;
    holidays: boolean;
  };
  pickup: {
    enabled: boolean;
    seller: string;
  };
  scheduleMode: "janela" | "coleta";
  shippingWindows: ShippingWindow[];
  pickupTimes: PickupTime[];
}

export const POLICY_DRAFTS_STORAGE_KEY = "freight.shipping-policy-drafts.v1";

const EMPTY: ShippingPolicyDraft[] = [];

let items: ShippingPolicyDraft[] = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(POLICY_DRAFTS_STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* storage indisponível — mantém apenas em memória */
  }
}

function normalize(list: unknown): ShippingPolicyDraft[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((x): x is ShippingPolicyDraft => !!x && typeof x === "object")
    .map((d) => ({ ...d, modalities: Array.isArray(d.modalities) ? d.modalities : [] }));
}

/** Lê o JSON salvo no navegador. Chamada apenas no cliente. */
export function hydratePolicyDrafts() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(POLICY_DRAFTS_STORAGE_KEY);
    if (!raw) return;
    const parsed = normalize(JSON.parse(raw));
    if (parsed.length) {
      items = parsed;
      emit();
    }
  } catch {
    /* JSON inválido — ignora */
  }
}

export function subscribePolicies(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getPolicyDrafts() {
  return items;
}

export function addPolicyDraft(draft: ShippingPolicyDraft) {
  items = [draft, ...items];
  persist();
  emit();
}

export function upsertPolicyDraft(draft: ShippingPolicyDraft) {
  const existingIndex = items.findIndex(
    (item) =>
      item.id === draft.id ||
      (item.store === draft.store && item.modalities.includes(draft.modalities[0])),
  );

  if (existingIndex === -1) {
    addPolicyDraft(draft);
    return "created" as const;
  }

  items = items.map((item, index) => (index === existingIndex ? draft : item));
  persist();
  emit();
  return "updated" as const;
}

export function removePolicyDraft(id: string) {
  items = items.filter((x) => x.id !== id);
  persist();
  emit();
}

export function removePolicyDraftsByModality(modality: string) {
  const next = items.filter((item) => !item.modalities.includes(modality));
  if (next.length === items.length) return;
  items = next;
  persist();
  emit();
}

export function replacePolicyDrafts(list: unknown) {
  items = normalize(list);
  persist();
  emit();
}

export function usePolicyDrafts() {
  useEffect(() => {
    hydratePolicyDrafts();
  }, []);
  return useSyncExternalStore(subscribePolicies, getPolicyDrafts, () => EMPTY);
}
