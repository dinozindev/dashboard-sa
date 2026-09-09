import raw from "@/data/shipping-policies.json";

export type PolicyStatus = "Ativa" | "Inativa" | "Em construção" | "Não informada" | "—";

export interface PolicyCell {
  status: PolicyStatus;
  note: string;
}

export interface PolicyStore {
  centro: number | null;
  tipo: string;
  nome: string;
  uf: string;
  cidade: string;
  cells: Record<string, PolicyCell>;
}

export interface PolicyDataset {
  source: string;
  modalities: string[];
  stores: PolicyStore[];
}

export const policies = raw as unknown as PolicyDataset;

export const STATUS_ICON: Record<PolicyStatus, string> = {
  Ativa: "🟢",
  Inativa: "🔴",
  "Em construção": "🛠",
  "—": "—",
};

export const STATUS_CLASS: Record<PolicyStatus, string> = {
  Ativa: "bg-success/15 text-success",
  Inativa: "bg-danger/15 text-danger",
  "Em construção": "bg-warning/20 text-warning-foreground",
  "—": "text-muted-foreground",
};

/** Modalidades de Retira ativas para uma loja (usado na sugestão de retirada). */
export function activePickupModalities(storeName: string) {
  const s = policies.stores.find((x) => x.nome.toLowerCase() === storeName.toLowerCase());
  if (!s) return [];
  return policies.modalities.filter(
    (m) => /retira|clique/i.test(m) && s.cells[m]?.status === "Ativa",
  );
}
