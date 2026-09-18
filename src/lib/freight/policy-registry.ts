/**
 * REGISTRO DE POLÍTICAS DE ENVIO
 * ==============================
 *
 * Guarda as políticas cadastradas na aba "Cadastro de Política de Envio".
 * A fonte de verdade é o banco: todas as pessoas veem as mesmas políticas.
 */

import { useEffect, useSyncExternalStore } from "react";
import {
  commitLocal,
  getLive,
  refreshLive,
  regionForStore,
  subscribeLive,
} from "./live";
import {
  deletePolicies,
  replacePolicies,
  upsertPolicy,
  type PolicyPayload,
} from "./remote.functions";
import { updateCell } from "./policy-status-store";
import { STORE_REGION } from "./dataset";
import type { StoreName } from "./types";

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

/** Tipo da política: entrega no endereço do cliente ou retirada em loja. */
export type PolicyType = "Entrega" | "Retira";

export const DAY_GROUPS = ["Segunda a sexta-feira", "Sábado", "Domingo"] as const;
export type DayGroup = (typeof DAY_GROUPS)[number];

/** Linha de janela de entrega agendada. */
export interface DeliveryWindowRow {
  id: string;
  days: DayGroup;
  capacity: number;
  additional: number;
  start: string;
  end: string;
}

/** Etapa "Entrega Agendada" (apenas para políticas de venda assistida). */
export interface ScheduledDelivery {
  enabled: boolean;
  /** Tempo máximo de entrega, em dias */
  maxDays: number;
  capacityEnabled: boolean;
  unit: "Itens" | "Pedidos";
  windows: DeliveryWindowRow[];
}

export const emptyScheduledDelivery = (): ScheduledDelivery => ({
  enabled: false,
  maxDays: 0,
  capacityEnabled: false,
  unit: "Itens",
  windows: [],
});

export interface ShippingPolicyDraft {
  id: string;
  createdAt: string;
  store: string;
  /** Política em vigor (Ativa) ou apenas cadastrada (Inativa) */
  active: boolean;
  /** Entrega ou Retira */
  policyType: PolicyType;
  /** Política de venda assistida? Habilita a etapa "Entrega Agendada". */
  assistedSale: boolean;
  scheduledDelivery: ScheduledDelivery;
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

/** Mantido por compatibilidade com importações antigas. */
export const POLICY_DRAFTS_STORAGE_KEY = "freight.shipping-policy-drafts.v1";

const EMPTY: ShippingPolicyDraft[] = [];

function normalize(list: unknown): ShippingPolicyDraft[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((x): x is ShippingPolicyDraft => !!x && typeof x === "object")
    .map((d) => ({
      ...d,
      modalities: Array.isArray(d.modalities) ? d.modalities : [],
      active: typeof d.active === "boolean" ? d.active : true,
      policyType: d.policyType === "Retira" ? "Retira" : "Entrega",
      assistedSale: !!d.assistedSale,
      scheduledDelivery: {
        ...emptyScheduledDelivery(),
        ...(d.scheduledDelivery ?? {}),
        windows: Array.isArray(d.scheduledDelivery?.windows) ? d.scheduledDelivery.windows : [],
      },
    }));
}

function toPayload(draft: ShippingPolicyDraft): PolicyPayload {
  const fallbackRegion = STORE_REGION[draft.store as StoreName] ?? null;
  return {
    clientId: draft.id,
    store: draft.store,
    region: regionForStore(draft.store) ?? fallbackRegion ?? "SP",
    data: draft as unknown as object,
  };
}

export function hydratePolicyDrafts() {
  void refreshLive();
}

export const subscribePolicies = subscribeLive;

export function getPolicyDrafts(): ShippingPolicyDraft[] {
  return getLive()?.drafts ?? EMPTY;
}

export function usePolicyDrafts() {
  useEffect(() => {
    void refreshLive();
  }, []);
  return useSyncExternalStore(subscribeLive, getPolicyDrafts, () => EMPTY);
}

/**
 * Reflete a política na matriz "Políticas de Envio": toda política criada
 * entra como Ativa, a não ser que tenha sido marcada como inativa.
 */
function syncMatrixStatus(draft: ShippingPolicyDraft) {
  const status = draft.active ? "Ativa" : "Inativa";
  for (const modality of draft.modalities) {
    updateCell(draft.store, modality, { status }, { silent: true });
  }
}

/** Cria ou atualiza uma política no banco (atualização otimista local). */
export function upsertPolicyDraft(draft: ShippingPolicyDraft): "created" | "updated" {
  let result: "created" | "updated" = "created";
  commitLocal((state) => {
    const index = state.drafts.findIndex(
      (item) =>
        item.id === draft.id ||
        (item.store === draft.store && item.modalities.includes(draft.modalities[0] ?? "")),
    );
    if (index >= 0) {
      result = "updated";
      state.drafts[index] = draft;
    } else {
      state.drafts.unshift(draft);
    }
  });
  void upsertPolicy({ data: { draft: toPayload(draft) } })
    .then(() => refreshLive())
    .catch((err) => {
      console.error("Falha ao salvar política no banco", err);
      void refreshLive();
    });
  return result;
}

export function addPolicyDraft(draft: ShippingPolicyDraft) {
  upsertPolicyDraft(draft);
}

export function removePolicyDraft(id: string) {
  commitLocal((state) => {
    state.drafts = state.drafts.filter((x) => x.id !== id);
  });
  void deletePolicies({ data: { clientIds: [id] } })
    .then(() => refreshLive())
    .catch(() => void refreshLive());
}

export function removePolicyDraftsByModality(modality: string) {
  const ids = getPolicyDrafts()
    .filter((item) => item.modalities.includes(modality))
    .map((item) => item.id);
  if (!ids.length) return;
  commitLocal((state) => {
    state.drafts = state.drafts.filter((item) => !item.modalities.includes(modality));
  });
  void deletePolicies({ data: { clientIds: ids } })
    .then(() => refreshLive())
    .catch(() => void refreshLive());
}

/** Substitui todas as políticas (importação de arquivo JSON). */
export function replacePolicyDrafts(list: unknown) {
  const drafts = normalize(list);
  commitLocal((state) => {
    state.drafts = drafts;
  });
  void replacePolicies({ data: { drafts: drafts.map(toPayload) } })
    .then(() => refreshLive())
    .catch(() => void refreshLive());
}
