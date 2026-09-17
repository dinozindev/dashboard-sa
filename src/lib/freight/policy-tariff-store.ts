/**
 * TABELAS DE FRETE VINCULADAS ÀS POLÍTICAS
 * ========================================
 *
 * A associação política → tabela de frete é gravada no banco
 * (`freight_tables.policy_client_id`).
 */

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { commitLocal, getLive, refreshLive, subscribeLive } from "./live";
import { linkFreightTable } from "./remote.functions";

export interface PolicyTariffLink {
  /** id da política (clientId) */
  policyId: string;
  store: string;
  modality: string;
  /** id da tabela no banco */
  tableId?: string;
  /** índice da tabela em `dataset.tariffs` (uso no cálculo) */
  tableIndex: number | null;
  tableName: string;
  source: string;
  bandCount: number;
  polygonIds: string[];
  at: string;
}

/** Mantido por compatibilidade com importações antigas. */
export const POLICY_TARIFFS_STORAGE_KEY = "freight.policy-tariffs.v1";

export function hydratePolicyTariffs() {
  void refreshLive();
}

export const subscribePolicyTariffs = subscribeLive;

export function getPolicyTariffs(): Record<string, PolicyTariffLink> {
  const live = getLive();
  if (!live) return {};
  const out: Record<string, PolicyTariffLink> = {};
  for (const table of live.snapshot.freightTables) {
    if (!table.policyClientId) continue;
    const policy = live.drafts.find((d) => d.id === table.policyClientId);
    out[table.policyClientId] = {
      policyId: table.policyClientId,
      store: table.store,
      modality: policy?.modalities?.[0] ?? "",
      tableId: table.id,
      tableIndex: live.tableIndexById.get(table.id) ?? null,
      tableName: table.name,
      source: table.source,
      bandCount: table.bands?.length ?? 0,
      polygonIds: live.polygons.filter((p) => p.store === table.store).map((p) => p.id),
      at: table.bands?.length ? String(table.bands[0]?.time ?? "") : "",
    };
  }
  return out;
}

export function getPolicyTariff(policyId: string): PolicyTariffLink | null {
  return getPolicyTariffs()[policyId] ?? null;
}

export function usePolicyTariffs() {
  useEffect(() => {
    void refreshLive();
  }, []);
  const live = useSyncExternalStore(subscribeLive, getLive, () => null);
  return useMemo(() => getPolicyTariffs(), [live]);
}

/**
 * Vincula (ou substitui) a tabela de frete de uma política no banco.
 * `link.tableId` pode ser omitido quando só se conhece o índice local.
 */
export function setPolicyTariff(link: PolicyTariffLink) {
  const live = getLive();
  let tableId = link.tableId;
  if (!tableId && link.tableIndex != null) {
    for (const [id, index] of live?.tableIndexById ?? []) {
      if (index === link.tableIndex) tableId = id;
    }
  }

  commitLocal((state) => {
    if (tableId) {
      const table = state.snapshot.freightTables.find((t) => t.id === tableId);
      if (table) table.policyClientId = link.policyId;
      state.snapshot = { ...state.snapshot, freightTables: [...state.snapshot.freightTables] };
    }
  });

  if (!tableId) {
    console.error("Tabela de frete não encontrada no banco para vincular à política");
    return;
  }
  void linkFreightTable({ data: { tableId, policyClientId: link.policyId } })
    .then(() => refreshLive())
    .catch((err) => {
      console.error("Falha ao vincular tabela à política", err);
      void refreshLive();
    });
}

export function removePolicyTariff(policyId: string) {
  const link = getPolicyTariff(policyId);
  if (!link?.tableId) return;
  commitLocal((state) => {
    const table = state.snapshot.freightTables.find((t) => t.id === link.tableId);
    if (table) table.policyClientId = null;
    state.snapshot = { ...state.snapshot, freightTables: [...state.snapshot.freightTables] };
  });
  void linkFreightTable({ data: { tableId: link.tableId, policyClientId: null } })
    .then(() => refreshLive())
    .catch(() => refreshLive());
}
