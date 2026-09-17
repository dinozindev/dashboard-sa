/**
 * TABELAS DE FRETE DISPONÍVEIS POR LOJA
 * =====================================
 *
 * As tabelas vêm das planilhas já carregadas no projeto (freight-data.json).
 * Aqui apenas agrupamos os polígonos por tabela de tarifa, sem criar nem
 * inventar nenhum dado novo.
 */

import { dataset, polygons } from "./dataset";

export interface TariffTableRef {
  /** Índice em dataset.tariffs */
  index: number;
  store: string;
  /** Rótulo legível (loja + faixas atendidas) */
  label: string;
  /** Quantidade de faixas de peso da tabela */
  bandCount: number;
  /** Polígonos da loja que usam esta tabela */
  polygonIds: string[];
}

/** Tabelas de frete carregadas para uma loja específica. */
export function tariffTablesForStore(store: string): TariffTableRef[] {
  const byIndex = new Map<number, { ids: string[]; bands: Set<string> }>();
  for (const p of polygons) {
    if (p.store !== store || p.tariff === null || p.tariff === undefined) continue;
    const entry = byIndex.get(p.tariff) ?? { ids: [], bands: new Set<string>() };
    entry.ids.push(p.id);
    entry.bands.add(p.band);
    byIndex.set(p.tariff, entry);
  }
  return [...byIndex.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, entry]) => {
      const bandCount = dataset.tariffs[index]?.length ?? 0;
      const faixas = [...entry.bands].sort().join(", ");
      return {
        index,
        store,
        label: `${store} — tabela ${index} (${faixas})`,
        bandCount,
        polygonIds: entry.ids,
      };
    });
}
