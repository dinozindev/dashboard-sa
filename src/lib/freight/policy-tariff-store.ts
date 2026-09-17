/**
 * ASSOCIAÇÃO TABELA DE FRETE ↔ POLÍTICA DE ENVIO
 * ==============================================
 *
 * Cada política de envio (do tipo Entrega) pode ter sua própria tabela de
 * frete, mesmo que duas políticas sejam da mesma loja. A associação também
 * guarda os polígonos da loja aos quais a tabela se aplica.
 *
 * Persistido em localStorage, sem backend real.
 */

import { useEffect, useSyncExternalStore } from "react";

export interface PolicyTariffLink {
  policyId: string;
  store: string;
  modality: string;
  /** Índice da tabela em dataset.tariffs */
  tableIndex: number;
  /** Nome exibido da tabela (ou do arquivo "enviado") */
  tableName: string;
  /** Origem: tabela já carregada ou upload simulado */
  source: "existente" | "upload";
  bandCount: number;
  polygonIds: string[];
  at: string;
}

export const POLICY_TARIFFS_STORAGE_KEY = "freight.policy-tariffs.v1";

const EMPTY: Record<string, PolicyTariffLink> = {};

let items: Record<string, PolicyTariffLink> = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(POLICY_TARIFFS_STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* storage indisponível — mantém em memória */
  }
}

export function hydratePolicyTariffs() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(POLICY_TARIFFS_STORAGE_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      items = parsed as Record<string, PolicyTariffLink>;
      emit();
    }
  } catch {
    /* JSON inválido — ignora */
  }
}

export const subscribePolicyTariffs = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export const getPolicyTariffs = () => items;

export const getPolicyTariff = (policyId: string): PolicyTariffLink | undefined =>
  items[policyId];

export function setPolicyTariff(link: PolicyTariffLink) {
  items = { ...items, [link.policyId]: link };
  persist();
  emit();
}

export function removePolicyTariff(policyId: string) {
  if (!items[policyId]) return;
  const { [policyId]: _removed, ...rest } = items;
  items = rest;
  persist();
  emit();
}

export function usePolicyTariffs() {
  useEffect(() => {
    hydratePolicyTariffs();
  }, []);
  return useSyncExternalStore(subscribePolicyTariffs, getPolicyTariffs, () => EMPTY);
}
