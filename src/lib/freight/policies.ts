/**
 * POLÍTICAS DE ENVIO E RETIRADA
 * ==============================
 * 
 * Dados de políticas por loja e modalidade.
 * Carregado do arquivo shipping-policies.json.
 */

import raw from "@/data/shipping-policies.json";

// ============================================================================
// 1. TIPOS E INTERFACES
// ============================================================================

/**
 * Estados possíveis de uma política.
 * 
 * - "Ativa": Implementada e funcionando
 * - "Inativa": Desativada/suspensa
 * - "Em construção": Em desenvolvimento
 * - "Não informada": Informação não fornecida
 * - "—": Não aplicável (vazio)
 */
export type PolicyStatus = "Ativa" | "Inativa" | "Em construção" | "Não informada" | "—";

/**
 * Célula da grade de políticas (um campo por modalidade/loja).
 * 
 * @param status - Status atual da política
 * @param note - Anotações/observações adicionais
 */
export interface PolicyCell {
  status: PolicyStatus;
  note: string;
}

/**
 * Dados de uma loja na matriz de políticas.
 * 
 * @param centro - ID interno (ou null)
 * @param tipo - Tipo de loja (Depósito, Agência, etc)
 * @param nome - Nome da loja
 * @param uf - Estado (SP, RJ, etc)
 * @param cidade - Município
 * @param cells - Grade: { modalidade → PolicyCell }
 */
export interface PolicyStore {
  centro: number | null;
  tipo: string;
  nome: string;
  uf: string;
  cidade: string;
  cells: Record<string, PolicyCell>;
}

/**
 * Dataset completo de políticas (estrutura do JSON).
 * 
 * @param source - Origem/versão dos dados
 * @param modalities - Lista de todas as modalidades (Entrega, Retira, etc)
 * @param stores - Array de lojas com células de política
 */
export interface PolicyDataset {
  source: string;
  modalities: string[];
  stores: PolicyStore[];
}

export interface ShippingPolicyDefinition {
  name: string;
  deliveryName: string;
  pickupName: string;
  id: number | null;
}

export const SHIPPING_POLICY_DEFINITIONS: ShippingPolicyDefinition[] = [
  { name: "Pequenos Volumes", deliveryName: "Entrega Rápida - Peq_Volumes", pickupName: "Entrega Econômica", id: 71 },
  { name: "Retira Fácil (Clique & Retira)", deliveryName: "", pickupName: "", id: 40 },
  { name: "Retira Televendas", deliveryName: "", pickupName: "", id: 3 },
  { name: "Retira Imediata", deliveryName: "Retira Imediata na Loja (VA)", pickupName: "Retira fácil na loja", id: 1 },
  { name: "Saldo Borderô", deliveryName: "Retira Saldo Borderô", pickupName: "Retira Saldo Borderô", id: 5 },
  { name: "Retira H+4 Ecommerce", deliveryName: "", pickupName: "", id: null },
  { name: "Entrega Normal", deliveryName: "", pickupName: "", id: 10 },
  { name: "Entrega Conforto Manhã", deliveryName: "ENTREGA_CONFORTO_TLV_VA_MANHA", pickupName: "ENTREGA CONFORTO_MANHA", id: 14 },
  { name: "Entrega Conforto Tarde", deliveryName: "ENTREGA_CONFORTO_TLV_VA_TARDE", pickupName: "ENTREGA CONFORTO_TARDE", id: 16 },
  { name: "ENTREGA TLV_VA_FRETE GRATIS", deliveryName: "", pickupName: "", id: null },
  { name: "Entrega Agendada", deliveryName: "Entrega Agendada (TLV_VA)", pickupName: "Entrega Agendada", id: 30 },
];

export const shippingPolicyDefinition = (name: string) =>
  SHIPPING_POLICY_DEFINITIONS.find((definition) => definition.name === name);

const MODALITY_ALIASES: Record<string, string> = {
  "ENTREGA CONFORTO MANHÃ": "Entrega Conforto Manhã",
  "ENTREGA CONFORTO TARDE": "Entrega Conforto Tarde",
};

export function normalizePolicyDataset(dataset: PolicyDataset): PolicyDataset {
  const standardModalities = SHIPPING_POLICY_DEFINITIONS.map((definition) => definition.name);
  const customModalities = dataset.modalities
    .map((modality) => MODALITY_ALIASES[modality] ?? modality)
    .filter((modality) => !standardModalities.includes(modality));
  const modalities = [...standardModalities, ...customModalities];
  const stores = dataset.stores.map((store) => {
    const cells = Object.fromEntries(
      Object.entries(store.cells).map(([modality, cell]) => [
        MODALITY_ALIASES[modality] ?? modality,
        cell,
      ]),
    );
    return {
      ...store,
      cells: Object.fromEntries(
        modalities.map((modality) => [
          modality,
          cells[modality] ?? { status: "Não informada" as PolicyStatus, note: "" },
        ]),
      ),
    };
  });
  return { ...dataset, modalities, stores };
}

// ============================================================================
// 2. DADOS CARREGADOS
// ============================================================================

/** Dataset completo de políticas importado do JSON */
export const policies = normalizePolicyDataset(raw as unknown as PolicyDataset);

// ============================================================================
// 3. VISUALIZAÇÃO
// ============================================================================

/**
 * Ícones para cada status (emoji).
 * Usado para exibição rápida na tabela.
 * 
 * - Ativa: 🟢 (verde)
 * - Inativa: 🔴 (vermelho)
 * - Em construção: 🛠 (obra)
 * - Não informada: ⚪ (branco)
 * - —: — (travessão)
 */
export const STATUS_ICON: Record<PolicyStatus, string> = {
  Ativa: "🟢",
  Inativa: "🔴",
  "Em construção": "🛠",
  "Não informada": "⚪",
  "—": "—",
};

/**
 * Classes Tailwind para estilizar cada status.
 * Usa cores: success (verde), danger (vermelho), warning (amarelo), muted (cinza).
 */
export const STATUS_CLASS: Record<PolicyStatus, string> = {
  Ativa: "bg-success/15 text-success",
  Inativa: "bg-danger/15 text-danger",
  "Em construção": "bg-warning/20 text-warning-foreground",
  "Não informada": "bg-muted text-muted-foreground",
  "—": "text-muted-foreground",
};

// ============================================================================
// 4. FUNÇÕES DE ACESSO
// ============================================================================

/**
 * Retorna as modalidades de retirada (Retira, Click & Collect, etc) ativas.
 * 
 * Usado para sugerir opções de retirada ao usuário.
 * Filtra:
 * - Modalidades que contêm "retira" ou "clique" (case-insensitive)
 * - Status = "Ativa"
 * 
 * @param storeName - Nome da loja
 * @returns Array de nomes de modalidades de retirada ativas
 */
export function activePickupModalities(storeName: string) {
  const s = policies.stores.find((x) => x.nome.toLowerCase() === storeName.toLowerCase());
  if (!s) return [];
  return policies.modalities.filter(
    (m) => /retira|clique/i.test(m) && s.cells[m]?.status === "Ativa",
  );
}
