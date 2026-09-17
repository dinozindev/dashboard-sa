/**
 * MATRIZ LOJA × MODALIDADE (ABA "POLÍTICAS DE ENVIO")
 * ===================================================
 *
 * Para cada loja, o status de cada modalidade de envio. Os dados vivem no
 * banco (tabelas `policy_cells` e `modalities`), então a matriz é a mesma
 * para todas as pessoas.
 */

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { commitLocal, getLive, refreshLive, subscribeLive } from "./live";
import {
  addCustomModality,
  removeCustomModality,
  replaceMatrixData,
  resetMatrixData,
  updatePolicyCell,
} from "./remote.functions";
import { logAudit } from "./audit-log";
import {
  SHIPPING_POLICY_DEFINITIONS,
  policies as basePolicies,
  type PolicyStatus,
} from "./policies";

export interface PolicyRow {
  modality: string;
  status: PolicyStatus;
  note: string;
}

export interface PolicyDataset {
  modalities: string[];
  stores: Array<{ name: string; rows: PolicyRow[] }>;
}

/** Modalidades padrão (definições fixas + customizadas no banco). */
export const BASE_MODALITIES = SHIPPING_POLICY_DEFINITIONS.map((d) => d.name);
export const BASE_STORES = basePolicies.stores.map((s) => s.nome);
export const DEFAULT_STATUS: PolicyStatus = "Não informada";

interface CellPayload {
  store: string;
  modality: string;
  status: string;
  note: string;
}

/** Status base definido em `shipping-policies.json` (dados originais). */
const baseStatus = new Map<string, string>();
for (const store of basePolicies.stores) {
  for (const [modality, cell] of Object.entries(store.cells)) {
    if (cell?.status === "Ativa") baseStatus.set(`${store.nome}||${modality}`, "Ativa");
  }
}

function buildDataset(live: ReturnType<typeof getLive>): PolicyDataset {
  const cellMap = new Map<string, { status: string; note: string }>();
  for (const c of live?.snapshot.policyCells ?? []) {
    cellMap.set(`${c.store}||${c.modality}`, { status: c.status, note: c.note ?? "" });
  }

  const custom: string[] = [];
  for (const m of live?.snapshot.customModalities ?? []) {
    if (!BASE_MODALITIES.includes(m)) custom.push(m);
  }

  const stores = BASE_STORES.map((name) => ({
    name,
    rows: [...BASE_MODALITIES, ...custom].map((modality) => {
      const cell = cellMap.get(`${name}||${modality}`);
      return {
        modality,
        status: (cell?.status ?? baseStatus.get(`${name}||${modality}`) ?? DEFAULT_STATUS) as PolicyStatus,
        note: cell?.note ?? "",
      };
    }),
  }));

  return { modalities: [...BASE_MODALITIES, ...custom], stores };
}

export function usePolicyMatrix() {
  useEffect(() => {
    void refreshLive();
  }, []);
  const live = useSyncExternalStore(subscribeLive, getLive, () => null);
  return useMemo(() => buildDataset(live), [live]);
}

export function getPolicyMatrix(): PolicyDataset {
  return buildDataset(getLive());
}

/** Atualiza o status/observação de uma célula (gravação otimista + banco). */
export function updateCell(
  storeName: string,
  modality: string,
  cell: Partial<Pick<PolicyRow, "status" | "note">>,
  options: { silent?: boolean; previous?: PolicyRow } = {},
) {
  const current = getLive()?.snapshot.policyCells.find(
    (c) => c.store === storeName && c.modality === modality,
  );
  const before = current ?? { status: DEFAULT_STATUS as string, note: "" };
  const next: CellPayload = {
    store: storeName,
    modality,
    status: cell.status ?? before.status,
    note: cell.note ?? before.note,
  };

  commitLocal((state) => {
    const cells = state.snapshot.policyCells;
    const index = cells.findIndex((c) => c.store === storeName && c.modality === modality);
    if (index >= 0) cells[index] = next;
    else cells.push(next);
    state.snapshot = { ...state.snapshot, policyCells: [...cells] };
  });

  void updatePolicyCell({ data: next })
    .then(() => refreshLive())
    .catch((err) => {
      console.error("Falha ao salvar status da política", err);
      void refreshLive();
    });

  if (options.silent) return;

  const statusChanged = next.status !== before.status;
  const noteChanged = next.note !== before.note;
  if (statusChanged || noteChanged) {
    const field = [statusChanged ? `Status ${modality}` : null, noteChanged ? `Observação ${modality}` : null]
      .filter(Boolean)
      .join(" + ");
    logAudit({
      store: storeName,
      module: "Políticas de Envio",
      field,
      before: [statusChanged ? before.status : null, noteChanged ? before.note || "—" : null]
        .filter(Boolean)
        .join(" / "),
      after: [statusChanged ? next.status : null, noteChanged ? next.note || "—" : null]
        .filter(Boolean)
        .join(" / "),
      action: statusChanged
        ? next.status === "Ativa"
          ? "Ativação"
          : "Desativação"
        : "Edição",
      description: `${modality} da loja ${storeName}`,
    });
  }
}

/** Cria uma nova modalidade customizada para todas as lojas. */
export function addPolicyModality(
  modality: string,
  activeStoreName: string,
): "created" | "exists" | "empty" {
  const name = modality.trim();
  if (!name) return "empty";
  const live = getLive();
  const customs = live?.snapshot.customModalities ?? [];
  if (BASE_MODALITIES.includes(name) || customs.includes(name)) return "exists";

  commitLocal((state) => {
    if (!state.snapshot.customModalities.includes(name)) {
      state.snapshot.customModalities = [...state.snapshot.customModalities, name];
    }
  });
  void addCustomModality({ data: { name } })
    .then(() => refreshLive())
    .catch(() => void refreshLive());

  logAudit({
    store: activeStoreName || "Todas",
    module: "Políticas de Envio",
    field: `Modalidade "${name}"`,
    before: "—",
    after: "Adicionada",
    action: "Adição",
    description: "Nova modalidade criada e adicionada a todas as lojas",
  });
  return "created";
}

export type RemoveModalityResult = "removed" | "not-found" | "protected";

/** Remove uma modalidade customizada (modalidades base não podem ser removidas). */
export function removePolicyModality(modality: string): RemoveModalityResult {
  if (BASE_MODALITIES.includes(modality)) return "protected";
  const live = getLive();
  if (!live?.snapshot.customModalities.includes(modality)) return "not-found";

  commitLocal((state) => {
    state.snapshot.customModalities = state.snapshot.customModalities.filter((m) => m !== modality);
    state.snapshot.policyCells = state.snapshot.policyCells.filter((c) => c.modality !== modality);
    state.snapshot = { ...state.snapshot };
  });
  void removeCustomModality({ data: { name: modality } })
    .then(() => refreshLive())
    .catch(() => void refreshLive());

  logAudit({
    store: "Todas",
    module: "Políticas de Envio",
    field: `Modalidade "${modality}"`,
    before: "Cadastrada",
    after: "—",
    action: "Remoção",
    description: "Modalidade customizada removida de todas as lojas",
  });
  return "removed";
}

/** Substitui toda a matriz (importação de arquivo JSON). */
export function replaceMatrix(data: unknown): { ok: boolean; error?: string } {
  if (!data || typeof data !== "object" || !Array.isArray((data as { stores?: unknown }).stores)) {
    return { ok: false, error: "Estrutura inválida" };
  }
  const raw = data as {
    modalities?: string[];
    stores?: Array<{ name?: string; rows?: Array<{ modality?: string; status?: string; note?: string }> }>;
  };
  const cells: CellPayload[] = [];
  for (const store of raw.stores ?? []) {
    if (!store?.name) continue;
    for (const row of store.rows ?? []) {
      if (!row?.modality) continue;
      cells.push({
        store: store.name,
        modality: row.modality,
        status: row.status ?? DEFAULT_STATUS,
        note: row.note ?? "",
      });
    }
  }
  const customs = (raw.modalities ?? []).filter((m) => m && !BASE_MODALITIES.includes(m));

  commitLocal((state) => {
    state.snapshot.policyCells = cells.map((c) => ({ ...c }));
    state.snapshot.customModalities = customs;
    state.snapshot = { ...state.snapshot };
  });
  void replaceMatrixData({ data: { modalities: [...BASE_MODALITIES, ...customs], cells } })
    .then(() => refreshLive())
    .catch(() => void refreshLive());
  return { ok: true };
}

/** Limpa a matriz inteira (volta ao padrão "Não informada"). */
export function resetMatrix() {
  commitLocal((state) => {
    state.snapshot.policyCells = [];
    state.snapshot.customModalities = [];
    state.snapshot = { ...state.snapshot };
  });
  void resetMatrixData()
    .then(() => refreshLive())
    .catch(() => void refreshLive());
}
