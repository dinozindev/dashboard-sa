/**
 * CORES E PADRÕES VISUAIS
 * =======================
 * 
 * Sistema de codificação visual para polígonos no mapa:
 * - Cor: faixa de raio (5km, 10km, ..., 30km) → mesma cor em todas as lojas
 * - Padrão de contorno (tracejado, pontilhado): loja → diferencia lojas
 * 
 * Assim o usuário vê rapidamente: onde entrega (cor) e qual loja (padrão).
 */

import type { StoreName } from "./types";

// ============================================================================
// 1. ORDENAÇÃO DE BANDAS
// ============================================================================

/**
 * Ordem das bandas de frete (faixas de raio).
 * Usado para ordenar legendas, filtros, e bandas na tabela.
 * 
 * Valores: ["5KM", "10KM", "15KM", "20KM", "25KM", "30KM"]
 */
export const BAND_ORDER = ["5KM", "10KM", "15KM", "20KM", "25KM", "30KM"] as const;

// ============================================================================
// 2. CORES POR FAIXA
// ============================================================================

/**
 * Mapeamento: Banda → Cor (hex).
 * 
 * Paleta:
 * - 5KM:  #e11d48 (vermelho - mais próximo)
 * - 10KM: #f97316 (laranja)
 * - 15KM: #eab308 (amarelo)
 * - 20KM: #22c55e (verde)
 * - 25KM: #06b6d4 (ciano)
 * - 30KM: #2563eb (azul - mais distante)
 * 
 * Progressão de quente (próximo) a frio (distante).
 */
export const BAND_COLORS: Record<string, string> = {
  "5KM": "#FF2D2D",
  "10KM": "#FF941B",
  "15KM": "#FFD466",
  "20KM": "#28C908",
  "25KM": "#2288FF",
  "30KM": "#004DA7",
};

// ============================================================================
// 3. PADRÕES DE CONTORNO POR LOJA
// ============================================================================

/**
 * Padrão SVG strokeDasharray para cada loja.
 * Diferencia lojas visualmente (contorno sólido, tracejado, pontilhado, etc).
 * 
 * Exemplo:
 * - undefined: sólido (Aricanduva, a "principal")
 * - "6 4": tracejado médio (Suzano)
 * - "2 4": pontilhado fino (Mooca)
 * - "10 4": tracejado longo (Praia Grande)
 * 
 * Formato SVG strokeDasharray: "dash gap dash gap ..."
 */
export const STORE_DASH: Record<StoreName, string | undefined> = {
  Aricanduva: undefined,
  Suzano: "6 4",
  Mooca: "2 4",
  "Praia Grande": "10 4",
  Piracicaba: "8 3 2 3",
  Benfica: "1 3",
  "Duque de Caxias": "12 4 2 4",
  Guadalupe: "4 2",
  Jacarepagua: "14 5",
  Mesquita: "3 3 8 3",
  Niteroi: "2 6",
};

/**
 * Rótulos descritivos dos padrões (para legenda).
 * 
 * Aricanduva sempre usa contorno sólido (referência).
 * Outras lojas têm padrões únicos (tracejado, pontilhado, etc).
 */
export const STORE_DASH_LABEL: Record<StoreName, string> = {
  Aricanduva: "contorno sólido",
  Suzano: "tracejado médio",
  Mooca: "pontilhado",
  "Praia Grande": "tracejado longo",
  Piracicaba: "traço-ponto",
  Benfica: "pontilhado fino",
  "Duque de Caxias": "traço longo-ponto",
  Guadalupe: "tracejado curto",
  Jacarepagua: "traço extra longo",
  Mesquita: "ponto-traço longo",
  Niteroi: "pontilhado espaçado",
};

// ============================================================================
// 4. FUNÇÃO DE ACESSO
// ============================================================================

/**
 * Retorna a cor para um polígono (loja + banda).
 * Atualmente ignora loja (todos usam a mesma paleta de cores por banda).
 * 
 * @param _store - StoreName (não usado, mantido para compatibilidade)
 * @param band - Nome da banda (5KM, 10KM, etc)
 * @returns Cor hex (ex: "#e11d48") ou fallback "#64748b" (cinza)
 */
export const bandColor = (_store: StoreName, band: string) =>
  BAND_COLORS[band] ?? "#777777";
