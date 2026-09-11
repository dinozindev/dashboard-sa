/**
 * LOJAS ENVIADAS (SIMULAÇÃO DE CADASTRO DE POLÍGONOS)
 * ===================================================
 *
 * Aricanduva e Suzano já estão cadastradas na operação.
 * As demais lojas só aparecem no mapa/dashboard depois de "enviadas"
 * na aba "Envio de Polígonos". A lista de envios é persistida em JSON
 * no navegador (localStorage), então continua valendo ao trocar de aba
 * ou recarregar a página.
 */

import { useEffect, useSyncExternalStore } from "react";
import { STORE_NAMES } from "./dataset";
import type { StoreName } from "./types";

/** Lojas já cadastradas na operação (sempre visíveis) */
export const BASE_STORES: StoreName[] = ["Aricanduva", "Suzano"];

/** Lojas mockadas disponíveis para envio */
export const PENDING_STORES: StoreName[] = STORE_NAMES.filter(
  (s) => !BASE_STORES.includes(s),
);

export const SUBMITTED_STORES_STORAGE_KEY = "freight.submitted-stores.v1";

const EMPTY: StoreName[] = [];

let items: StoreName[] = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

const emit = () => {
  for (const l of listeners) l();
};

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SUBMITTED_STORES_STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* storage indisponível — mantém em memória */
  }
}

function normalize(list: unknown): StoreName[] {
  if (!Array.isArray(list)) return [];
  return list.filter((s): s is StoreName => PENDING_STORES.includes(s as StoreName));
}

export function hydrateSubmittedStores() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(SUBMITTED_STORES_STORAGE_KEY);
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

export const subscribeSubmittedStores = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export const getSubmittedStores = () => items;

/** Registra o envio de todos os polígonos de uma loja. */
export function submitStore(store: StoreName) {
  if (items.includes(store)) return false;
  items = [...items, store];
  persist();
  emit();
  return true;
}

/** Desfaz o envio de uma loja (remove seus polígonos do mapa). */
export function unsubmitStore(store: StoreName) {
  items = items.filter((s) => s !== store);
  persist();
  emit();
}

/** Remove todos os envios simulados. */
export function clearSubmittedStores() {
  items = EMPTY;
  persist();
  emit();
}

export function useSubmittedStores() {
  useEffect(() => {
    hydrateSubmittedStores();
  }, []);
  return useSyncExternalStore(subscribeSubmittedStores, getSubmittedStores, () => EMPTY);
}
