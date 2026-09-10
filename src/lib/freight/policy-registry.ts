/**
 * REGISTRO DE POLÍTICAS DE ENVIO (simulação)
 * ==========================================
 *
 * Guarda, em memória, as políticas cadastradas na aba
 * "Cadastro de Política de Envio". Não há backend: os dados
 * seguem o mesmo formato de `shipping-policies.json` para que
 * possam ser exportados e colados no arquivo quando desejado.
 */

import { useSyncExternalStore } from "react";

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

let items: ShippingPolicyDraft[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
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
  emit();
}

export function removePolicyDraft(id: string) {
  items = items.filter((x) => x.id !== id);
  emit();
}

export function usePolicyDrafts() {
  return useSyncExternalStore(subscribePolicies, getPolicyDrafts, () => items);
}
