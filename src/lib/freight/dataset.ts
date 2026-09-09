/**
 * DATASET DE FRETE - CARREGAMENTO E ÍNDICES
 * ==========================================
 * 
 * Carrega o arquivo freight-data.json e expõe funções de acesso.
 * Cria índices em memória para acesso O(1) em tempo de execução.
 * 
 * Use as funções exported em vez de acessar diretamente dataset.polygons,
 * para manter a lógica de negócio encapsulada.
 */

import raw from "@/data/freight-data.json";
import type { FreightDataset, PolygonRecord, Region, StoreName, WeightBand } from "./types";

// ============================================================================
// 1. DADOS BRUTOS E ÍNDICES PRIMÁRIOS
// ============================================================================

/** Dataset completo carregado do JSON */
export const dataset = raw as unknown as FreightDataset;

/** Lista de todos os polígonos de cobertura */
export const polygons: PolygonRecord[] = dataset.polygons;

/** Referências de todas as lojas */
export const stores = dataset.stores;

// ============================================================================
// 2. MAPEAMENTO DE LOJAS E REGIÕES
// ============================================================================

/**
 * Lista de todas as lojas cadastradas no sistema.
 * Ordem: SP (Aricanduva, Suzano, ...) + RJ (Benfica, ...)
 */
export const STORE_NAMES: StoreName[] = [
  "Aricanduva",
  "Suzano",
  "Mooca",
  "Praia Grande",
  "Piracicaba",
  "Benfica",
  "Duque de Caxias",
  "Guadalupe",
  "Jacarepagua",
  "Mesquita",
  "Niteroi",
];

/**
 * Mapeamento: Loja → Região
 * Usado para filtrar lojas por região (SP/RJ/Todas)
 */
export const STORE_REGION: Record<StoreName, Region> = {
  Aricanduva: "SP",
  Suzano: "SP",
  Mooca: "SP",
  "Praia Grande": "SP",
  Piracicaba: "SP",
  Benfica: "RJ",
  "Duque de Caxias": "RJ",
  Guadalupe: "RJ",
  Jacarepagua: "RJ",
  Mesquita: "RJ",
  Niteroi: "RJ",
};

/**
 * Retorna lojas de uma região específica.
 * 
 * @param region - "SP", "RJ", ou "Todas"
 * @returns Array de StoreName da região
 */
export const storesInRegion = (region: Region | "Todas") =>
  region === "Todas" ? STORE_NAMES : STORE_NAMES.filter((s) => STORE_REGION[s] === region);

// ============================================================================
// 3. LOJAS COM OPERAÇÃO COMPLETA
// ============================================================================

/**
 * Lojas que têm:
 * - Tabela de frete (tarifas por faixa de peso)
 * - Horários configurados
 * - Capacidade operacional
 * 
 * Atualmente: ["Aricanduva", "Suzano"]
 * Outras lojas: apenas polígonos, sem tarifas/horários
 */
export const OPS_STORES: StoreName[] = ["Aricanduva", "Suzano"];

// ============================================================================
// 4. SIMULAÇÃO E OVERRIDES DE PREÇO
// ============================================================================

/**
 * Tipo para armazenar edições temporárias de preços.
 * 
 * Chave: `${polygonId}#${bandIndex}` → WeightBand editada
 * Exemplo: "ari_0_5kg_001#1" → faixa 5-10kg editada
 * 
 * Armazenado no state do Dashboard (não persistido).
 */
export type Overrides = Record<string, WeightBand>;

// ============================================================================
// 5. FUNÇÕES DE ACESSO COM INJEÇÃO DE OVERRIDES
// ============================================================================

/**
 * Obtém tabela de tarifas para um polígono, com overrides aplicados.
 * 
 * Procura:
 * 1. Verifica se polígono tem tariff definido
 * 2. Busca na tabela de tarifas (dataset.tariffs[polygon.tariff])
 * 3. Aplica edições temporárias (overrides) se existirem
 * 
 * @param rec - PolygonRecord ou undefined
 * @param overrides - Edições de preço do simulador
 * @returns Array WeightBand[] ou undefined se sem tabela
 */
export function tariffFor(
  rec: PolygonRecord | undefined | null,
  overrides: Overrides = {},
): WeightBand[] | undefined {
  if (!rec || rec.tariff === null || rec.tariff === undefined) return undefined;
  const base = dataset.tariffs[rec.tariff];
  if (!base) return undefined;
  // Aplica overrides: se existe chave ${id}#${índice}, usa override, senão usa base
  return base.map((b, i) => overrides[`${rec.id}#${i}`] ?? b);
}

/**
 * Verifica se um polígono tem alguma edição de preço no simulador.
 * 
 * @param rec - PolygonRecord ou undefined
 * @param overrides - State de overrides
 * @returns true se existem edições para este polígono
 */
export function hasSimulation(rec: PolygonRecord | undefined | null, overrides: Overrides) {
  if (!rec) return false;
  return Object.keys(overrides).some((k) => k.startsWith(`${rec.id}#`));
}

// ============================================================================
// 6. ÍNDICE PARA ACESSO RÁPIDO (O(1))
// ============================================================================

/**
 * Índice: ID do polígono → PolygonRecord
 * Permite busca O(1) em vez de O(n) com find()
 * 
 * Uso: polygonById.get("ari_0_5kg_001")
 */
export const polygonById = new Map(polygons.map((p) => [p.id, p]));
