/**
 * EDIÇÃO DOS STATUS DA MATRIZ DE POLÍTICAS
 * ========================================
 *
 * A matriz original vem de `shipping-policies.json` (somente leitura).
 * As alterações feitas na aba "Políticas de Envio" ficam salvas como JSON
 * no navegador e podem ser exportadas/importadas como arquivo.
 */

import { useEffect, useSyncExternalStore } from "react";
import { policies, type PolicyCell, type PolicyDataset, type PolicyStatus } from "./policies";

export const POLICY_MATRIX_STORAGE_KEY = "freight.shipping-policies.v1";

export const STATUS_OPTIONS: PolicyStatus[] = [
  "Ativa",
  "Inativa",
  "Em construção",
  "Não informada",
  "—",
];

function clone(d: PolicyDataset): PolicyDataset {
  return JSON.parse(JSON.stringify(d)) as PolicyDataset;
}

const BASE = policies;

let current: PolicyDataset = BASE;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(POLICY_MATRIX_STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* storage indisponível */
  }
}

function isDataset(v: unknown): v is PolicyDataset {
  const d = v as PolicyDataset | null;
  return !!d && Array.isArray(d.modalities) && Array.isArray(d.stores);
}

export function hydratePolicyMatrix() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(POLICY_MATRIX_STORAGE_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (isDataset(parsed)) {
      current = parsed;
      emit();
    }
  } catch {
    /* JSON inválido */
  }
}

export function subscribeMatrix(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getMatrix() {
  return current;
}

export function updateCell(storeName: string, modality: string, cell: Partial<PolicyCell>) {
  const next = clone(current);
  const store = next.stores.find((s) => s.nome === storeName);
  if (!store) return;
  const prev = store.cells[modality] ?? { status: "—" as PolicyStatus, note: "" };
  store.cells[modality] = { ...prev, ...cell };
  current = next;
  persist();
  emit();
}

export function addPolicyModality(modalityName: string, activeStoreName: string) {
  const modality = modalityName.trim();
  if (!modality) return "empty" as const;

  const alreadyExists = current.modalities.some(
    (item) => item.toLocaleLowerCase() === modality.toLocaleLowerCase(),
  );
  if (alreadyExists) return "exists" as const;

  const next = clone(current);
  next.modalities.push(modality);
  next.stores = next.stores.map((store) => ({
    ...store,
    cells: {
      ...store.cells,
      [modality]: {
        status: store.nome === activeStoreName ? "Ativa" : "Não informada",
        note: "",
      },
    },
  }));
  current = next;
  persist();
  emit();
  return "created" as const;
}

export function removePolicyModality(modalityName: string) {
  const modality = modalityName.trim();
  if (BASE.modalities.includes(modality)) return "protected" as const;
  if (!current.modalities.includes(modality)) return "not-found" as const;

  const next = clone(current);
  next.modalities = next.modalities.filter((item) => item !== modality);
  next.stores = next.stores.map((store) => {
    const { [modality]: _removed, ...cells } = store.cells;
    return { ...store, cells };
  });
  current = next;
  persist();
  emit();
  return "removed" as const;
}

export function replaceMatrix(data: unknown) {
  if (!isDataset(data)) throw new Error("Arquivo JSON fora do formato esperado.");
  current = data;
  persist();
  emit();
}

export function resetMatrix() {
  current = BASE;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(POLICY_MATRIX_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
  emit();
}

export function usePolicyMatrix() {
  useEffect(() => {
    hydratePolicyMatrix();
  }, []);
  return useSyncExternalStore(subscribeMatrix, getMatrix, () => BASE);
}
