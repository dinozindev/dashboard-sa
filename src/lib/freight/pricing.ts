/**
 * CÁLCULO DE PREÇO DE FRETE
 * ==========================
 * 
 * Regra aplicada:
 * - O AbsoluteMoneyCost da faixa cobre o peso até o início dela (Weight_Start - 1).
 * - Cada kg acima desse ponto custa PriceByExtraWeight.
 * 
 * Fórmula geral: price = amc + max(0, peso - (ws - 1)) * pew
 * onde:
 *   amc = AbsoluteMoneyCost (preço base da faixa)
 *   ws  = Weight_Start (início da faixa)
 *   pew = PriceByExtraWeight (preço por kg adicional)
 */

import type { WeightBand } from "./types";

// ============================================================================
// 1. MENSAGENS E CONSTANTES
// ============================================================================

/** Mensagem padrão quando nenhuma regra de frete é encontrada */
export const NO_RULE = "Regra de frete não encontrada";

// ============================================================================
// 2. RESULTADO DE CÁLCULO
// ============================================================================

/**
 * Resultado detalhado do cálculo de preço.
 * 
 * Decomposição da fórmula passo-a-passo para exibir ao usuário,
 * facilitando auditoria e compreensão.
 * 
 * Exemplo (10kg, banda 5-20kg):
 *   ok: true
 *   basePrice: 15.00 (amc)
 *   includedWeight: 10 (min(10, 20))
 *   extraWeight: 0
 *   extraRate: 0
 *   total: 15.00
 * 
 * Contra-exemplo (25kg, mesma banda):
 *   ok: true
 *   basePrice: 15.00
 *   includedWeight: 20
 *   extraWeight: 5 (25 - 20)
 *   extraRate: 2.00 (pew)
 *   total: 25.00 (15 + 5*2)
 */
export interface PriceBreakdown {
  /** Sucesso do cálculo? */
  ok: boolean;
  /** Mensagem de erro (se ok=false) */
  message?: string;
  /** A banda selecionada (se ok=true) */
  band?: WeightBand;
  /** 1. Preço base (AbsoluteMoneyCost) */
  basePrice: number;
  /** 2. Peso coberto pela faixa (min(peso, Weight_End)) */
  includedWeight: number;
  /** 3. Peso acima do limite (max(0, peso - Weight_End)) */
  extraWeight: number;
  /** 4. Preço por kg adicional (PriceByExtraWeight) */
  extraRate: number;
  /** 5. Preço total calculado */
  total: number;
}

/**
 * Retorna PriceBreakdown com erro (ok=false).
 * Função auxiliar para manter o código DRY.
 */
const invalid = (message: string): PriceBreakdown => ({
  ok: false,
  message,
  basePrice: 0,
  includedWeight: 0,
  extraWeight: 0,
  extraRate: 0,
  total: 0,
});

// ============================================================================
// 3. SELEÇÃO DE BANDA
// ============================================================================

/**
 * Seleciona a banda aplicável para um peso.
 * 
 * Algoritmo:
 * 1. Filtra apenas bandas com dados válidos (ws e we não null)
 * 2. Tenta encontrar banda que contém o peso (ws <= peso <= we)
 * 3. Se não encontra, usa a última banda (interpolação para pesos acima)
 * 4. Se nenhuma banda, retorna undefined
 * 
 * Exemplo com bandas: [0-5, 5-10, 10-20, 20-50]
 *   - peso 3 → retorna banda 0-5
 *   - peso 8 → retorna banda 5-10
 *   - peso 15 → retorna banda 10-20
 *   - peso 60 → retorna banda 20-50 (última, interpolada)
 * 
 * @param bands - Array de WeightBand (tarifas de um polígono)
 * @param weight - Peso a precificar (kg)
 * @returns Banda selecionada ou undefined se lista vazia
 */
export function findBand(bands: WeightBand[] | undefined, weight: number): WeightBand | undefined {
  if (!bands || bands.length === 0) return undefined;
  // Filtra apenas bandas com dados completos
  const valid = bands.filter((b) => b.ws !== null && b.we !== null);
  if (valid.length === 0) return undefined;
  // Tenta encontrar banda que contém o peso
  const hit = valid.find((b) => weight >= (b.ws as number) && weight <= (b.we as number));
  if (hit) return hit;
  // Se peso está acima de todas as bandas, usa a última
  const sorted = [...valid].sort((a, b) => (a.we as number) - (b.we as number));
  const last = sorted[sorted.length - 1];
  if (last && weight > (last.we as number)) return last;
  // Fallback: usa a primeira banda (peso abaixo de todas)
  return sorted[0];
}

// ============================================================================
// 4. CÁLCULO DE PREÇO
// ============================================================================

/**
 * Calcula preço com decomposição detalhada.
 * 
 * Processo:
 * 1. Localiza banda aplicável via findBand()
 * 2. Valida dados completos (amc, ws, we)
 * 3. Calcula peso excedente (peso > we)
 * 4. Valida se precisa pew quando há excedente
 * 5. Retorna breakdown com fórmula decomposta
 * 
 * @param bands - Array de WeightBand | undefined
 * @param weight - Peso a precificar (kg)
 * @returns PriceBreakdown com resultado ou erro
 */
export function calcPrice(bands: WeightBand[] | undefined, weight: number): PriceBreakdown {
  const band = findBand(bands, weight);
  if (!band) return invalid(NO_RULE);
  if (band.amc === null || band.ws === null || band.we === null) {
    return invalid("Dados incompletos na planilha para esta faixa");
  }
  // O preço base (amc) cobre o peso até o início da faixa; a partir daí
  // cada kg adicional é cobrado por PriceByExtraWeight.
  const threshold = band.ws > 0 ? band.ws - 1 : 0;
  const extraWeight = weight > threshold ? weight - threshold : 0;
  const extraRate = band.pew ?? 0;
  if (extraWeight > 0 && band.pew === null) {
    return invalid("Peso excedente sem PriceByExtraWeight na planilha");
  }
  return {
    ok: true,
    band,
    basePrice: band.amc,
    includedWeight: Math.min(weight, threshold),
    extraWeight,
    extraRate,
    total: band.amc + extraWeight * extraRate,
  };
}

/**
 * Calcula preço para cada banda individualmente.
 * 
 * Útil para tabelas de comparação (qual seria o preço em cada banda).
 * 
 * @param bands - Array de bandas
 * @param weight - Peso a simular
 * @returns Array de { band, price }
 */
export function bandPrices(bands: WeightBand[] | undefined, weight: number) {
  if (!bands) return [];
  return bands.map((b) => ({ band: b, price: calcPrice([b], weight) }));
}

// ============================================================================
// 5. FORMATAÇÃO
// ============================================================================

/**
 * Formata número como moeda BRL (Real).
 * 
 * Exemplo: 12.5 → "R$ 12,50"
 * 
 * @param v - Valor numérico
 * @returns String formatada em português
 */
export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Formata peso em kg.
 * 
 * Exemplo: 10.5 → "10,50 kg", null → "—"
 * 
 * @param v - Peso em kg ou null
 * @returns String formatada ou "—" se null
 */
export const kg = (v: number | null) =>
  v === null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg`;
