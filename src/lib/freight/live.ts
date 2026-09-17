/**
 * ESTADO COMPARTILHADO (BANCO) NO NAVEGADOR
 * =========================================
 *
 * Um único snapshot do banco alimenta todos os painéis: lojas, políticas,
 * tabelas de frete, polígonos, docas, matriz de políticas e auditoria.
 *
 * - Leitura: `useLive()` (useSyncExternalStore) — recarrega ao montar e a cada
 *   25s, então cadastros feitos por outra pessoa aparecem sem precisar de login.
 * - Escrita: cada módulo (policy-registry, docks-store, ...) aplica a mudança
 *   localmente (otimista) e envia ao banco via `remote.functions.ts`.
 */

import { useEffect, useSyncExternalStore } from "react";
import {
  getFreightSnapshot,
  type FreightSnapshotDto,
} from "./remote.functions";
import { dataset, pushTariffTable, resetLiveTariffs } from "./dataset";
import type { PolygonRecord, Region, WeightBand } from "./types";
import type { ShippingPolicyDraft } from "./policy-registry";
import type { AuditEntry } from "./audit-log";

export type { FreightSnapshotDto };

export interface LiveState {
  /** Versão incrementada a cada atualização (útil em deps de useMemo) */
  version: number;
  snapshot: FreightSnapshotDto;
  /** Políticas normalizadas (mesma forma de ShippingPolicyDraft) */
  drafts: ShippingPolicyDraft[];
  /** Polígonos do banco já convertidos para PolygonRecord */
  polygons: PolygonRecord[];
  /** Índice em dataset.tariffs de cada tabela de frete (id → índice) */
  tableIndexById: Map<string, number>;
  /** Tabela de frete vinculada a cada política (clientId → id da tabela) */
  tableByPolicy: Map<string, string>;
  /** Modalidades de cada política (clientId → modalidades) */
  modalitiesByPolicy: Map<string, string[]>;
  /** Tipo de cada política (clientId → "Entrega" | "Retira") */
  policyTypeByPolicy: Map<string, string>;
  /** Malhas estaduais (modalidade Retira) gravadas no banco */
  statePolygons: Array<{ uf: Region; name: string; source: string | null; geom: number[][][][] }>;
  /** Registros de auditoria */
  audit: AuditEntry[];
}

let current: LiveState | null = null;
let inflight: Promise<void> | null = null;
let version = 0;
const listeners = new Set<() => void>();

const emit = () => {
  for (const l of listeners) l();
};

function normalizeDraft(raw: object): ShippingPolicyDraft {
  const d = raw as Partial<ShippingPolicyDraft>;
  return {
    id: typeof d.id === "string" ? d.id : `pol-${Math.random().toString(36).slice(2)}`,
    createdAt: typeof d.createdAt === "string" ? d.createdAt : new Date(0).toISOString(),
    store: typeof d.store === "string" ? d.store : "",
    active: d.active !== false,
    policyType: d.policyType === "Retira" ? "Retira" : "Entrega",
    assistedSale: !!d.assistedSale,
    scheduledDelivery: {
      enabled: false,
      maxDays: 0,
      capacityEnabled: false,
      unit: "Itens",
      windows: [],
      ...(d.scheduledDelivery ?? {}),
    },
    modalities: Array.isArray(d.modalities) ? d.modalities : [],
    dimensions: {
      sumOfDimensions: 0,
      largestEdge: 0,
      cubicWeightFactor: 0,
      minimumWeightFactor: 0,
      ...(d.dimensions ?? {}),
    },
    weekend: { saturday: true, sunday: false, holidays: false, ...(d.weekend ?? {}) },
    pickup: { enabled: false, seller: "", ...(d.pickup ?? {}) },
    scheduleMode: d.scheduleMode === "coleta" ? "coleta" : "janela",
    shippingWindows: Array.isArray(d.shippingWindows) ? d.shippingWindows : [],
    pickupTimes: Array.isArray(d.pickupTimes) ? d.pickupTimes : [],
  };
}

function applySnapshot(raw: FreightSnapshotDto) {
  // Tabelas de frete do banco entram no fim de dataset.tariffs (as estáticas
  // vêm antes); `tariffFor()` continua funcionando sem alteração.
  resetLiveTariffs();
  const tableIndexById = new Map<string, number>();
  for (const t of raw.freightTables ?? []) {
    tableIndexById.set(t.id, pushTariffTable((t.bands ?? []) as WeightBand[]));
  }

  const policyIdByClient = new Map<string, { tableId: string | null; draft: ShippingPolicyDraft }>();
  const tableByPolicy = new Map<string, string>();
  const modalitiesByPolicy = new Map<string, string[]>();
  const policyTypeByPolicy = new Map<string, string>();
  const drafts: ShippingPolicyDraft[] = [];
  for (const p of raw.policies ?? []) {
    const draft = normalizeDraft((p.data ?? {}) as object);
    drafts.push(draft);
    modalitiesByPolicy.set(p.clientId, draft.modalities);
    policyTypeByPolicy.set(p.clientId, draft.policyType);
    policyIdByClient.set(p.clientId, { tableId: null, draft });
  }

  for (const t of raw.freightTables ?? []) {
    if (t.policyClientId) tableByPolicy.set(t.policyClientId, t.id);
  }

  const polygons: PolygonRecord[] = [];
  for (const p of raw.polygons ?? []) {
    const geomRaw = p.geojson;
    let geom: number[][][][] = [];
    if (geomRaw?.coordinates) {
      geom =
        geomRaw.type === "MultiPolygon"
          ? (geomRaw.coordinates as unknown as number[][][][])
          : geomRaw.type === "Polygon"
            ? [geomRaw.coordinates as unknown as number[][][]]
            : [];
    }
    // Polígono com política → tabela vinculada à política; sem política →
    // tabela padrão da loja (seed das tabelas estáticas, sem policyClientId).
    const linkedTableId = p.policyClientId
      ? (tableByPolicy.get(p.policyClientId) ?? null)
      : ((raw.freightTables ?? []).find(
          (t) => t.store === p.store && !t.policyClientId,
        )?.id ?? null);
    const tableIdx = linkedTableId ? (tableIndexById.get(linkedTableId) ?? null) : null;
    polygons.push({
      id: p.id,
      store: p.store,
      district: p.district,
      uf: p.uf,
      band: p.band ?? "—",
      radius: p.radius ?? 0,
      rMin: p.rMin ?? 0,
      rMax: p.rMax ?? 0,
      areaKm2: p.areaKm2 ?? 0,
      center: (p.center ?? [0, 0]) as [number, number],
      tariff: tableIdx,
      geom,
      policyClientId: p.policyClientId,
      kind: p.kind === "Retira" ? "Retira" : "Entrega",
    });
  }

  const statePolygons = (raw.statePolygons ?? []).map((s) => {
    const g = s.geojson;
    const geom: number[][][][] = g?.coordinates
      ? g.type === "MultiPolygon"
        ? (g.coordinates as unknown as number[][][][])
        : g.type === "Polygon"
          ? [g.coordinates as unknown as number[][][]]
          : []
      : [];
    return { uf: s.uf as Region, name: s.name, source: s.source, geom };
  });

  const audit: AuditEntry[] = (raw.audit ?? []).map((a) => ({
    id: a.id,
    at: a.at,
    store: a.store,
    module: a.module as AuditEntry["module"],
    field: a.field,
    before: a.before ?? "",
    after: a.after ?? "",
    action: a.action as AuditEntry["action"],
    description: a.description ?? "",
  }));

  version += 1;
  current = {
    version,
    snapshot: raw,
    drafts,
    polygons,
    tableIndexById,
    tableByPolicy,
    modalitiesByPolicy,
    policyTypeByPolicy,
    statePolygons,
    audit,
  };
  emit();
}

/** Busca o estado do banco (deduplicada). */
export function refreshLive(): Promise<void> {
  if (!inflight) {
    inflight = getFreightSnapshot()
      .then((raw) => applySnapshot(raw))
      .catch((err) => {
        console.error("Falha ao carregar dados do banco", err);
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export const getLive = () => current;
export const subscribeLive = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

/** Atualização otimista: muta o estado atual e notifica os listeners. */
export function commitLocal(mutate: (state: LiveState) => void) {
  if (!current) return;
  const next: LiveState = {
    ...current,
    drafts: [...current.drafts],
    polygons: [...current.polygons],
    audit: [...current.audit],
    tableIndexById: new Map(current.tableIndexById),
    tableByPolicy: new Map(current.tableByPolicy),
    modalitiesByPolicy: new Map(current.modalitiesByPolicy),
    policyTypeByPolicy: new Map(current.policyTypeByPolicy),
    version: current.version + 1,
  };
  current = next;
  mutate(next);
  version = next.version;
  emit();
}

/** Hook principal: estado do banco + recarga automática. */
export function useLive(): LiveState | null {
  useEffect(() => {
    void refreshLive();
    const timer = window.setInterval(() => void refreshLive(), 25_000);
    return () => window.clearInterval(timer);
  }, []);
  return useSyncExternalStore(subscribeLive, getLive, () => null);
}

// ============================================================================
// DERIVADOS
// ============================================================================

/** Lojas existentes no banco. */
export function liveStores(state: LiveState | null) {
  return state?.snapshot.stores ?? [];
}

/** Lojas com polígonos cadastrados (liberadas no painel). */
export function availableStoreNames(state: LiveState | null): string[] {
  return liveStores(state)
    .filter((s) => s.polygonCount > 0)
    .map((s) => s.name);
}

export function storeRegionOf(state: LiveState | null, name: string): Region | null {
  const found = liveStores(state).find((s) => s.name === name);
  return found ? found.region : null;
}

/** Região de uma loja conforme o banco (null quando a loja não existe). */
export function regionForStore(name: string): Region | null {
  return storeRegionOf(getLive(), name);
}
