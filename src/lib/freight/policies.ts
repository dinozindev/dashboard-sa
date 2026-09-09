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

// ============================================================================
// 2. DADOS CARREGADOS
// ============================================================================

/** Dataset completo de políticas importado do JSON */
export const policies = raw as unknown as PolicyDataset;

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
