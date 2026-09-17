/**
 * TABELAS DE FRETE DISPONÍVEIS POR LOJA
 * =====================================
 *
 * As tabelas vêm das planilhas já carregadas no projeto (freight-data.json).
 * A tabela da loja é tratada como um documento único e completo: todas as
 * faixas de peso de todos os raios de atendimento da loja ficam juntas,
 * sem separação por faixa/raio.
 */

import { dataset, polygons } from "./dataset";

export interface TariffTableRef {
  /** Índice representativo em dataset.tariffs (primeiro bloco da loja) */
  index: number;
  store: string;
  /** Rótulo legível da tabela completa da loja */
  label: string;
  /** Total de faixas de peso da tabela completa */
  bandCount: number;
  /** Todos os polígonos da loja cobertos pela tabela */
  polygonIds: string[];
  /** Todos os blocos de tarifa que compõem a tabela completa */
  tableIndexes: number[];
}

/** Tabela de frete completa carregada para uma loja específica. */
export function tariffTablesForStore(store: string): TariffTableRef[] {
  const indexes: number[] = [];
  const polygonIds: string[] = [];
  for (const p of polygons) {
    if (p.store !== store || p.tariff === null || p.tariff === undefined) continue;
    polygonIds.push(p.id);
    if (!indexes.includes(p.tariff)) indexes.push(p.tariff);
  }
  if (!indexes.length) return [];
  indexes.sort((a, b) => a - b);
  const bandCount = indexes.reduce((sum, i) => sum + (dataset.tariffs[i]?.length ?? 0), 0);
  return [
    {
      index: indexes[0] as number,
      store,
      label: `${store} — tabela de frete completa`,
      bandCount,
      polygonIds,
      tableIndexes: indexes,
    },
  ];
}

