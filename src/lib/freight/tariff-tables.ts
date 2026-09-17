/**
 * TABELAS DE FRETE COMPLETAS POR LOJA
 * ===================================
 *
 * A tabela de frete é enviada por completo (sem separação por raio de
 * atendimento) e vinculada à política de envio. As tabelas vêm do banco.
 */

import { getLive } from "./live";

export interface TariffTableRef {
  /** índice em dataset.tariffs */
  index: number;
  store: string;
  label: string;
  bandCount: number;
  polygonIds: string[];
  tableIndexes: number[];
}

/** Todas as tabelas de frete cadastradas para a loja (uma por política). */
export function tariffTablesForStore(store: string): TariffTableRef[] {
  const live = getLive();
  if (!live) return [];
  const out: TariffTableRef[] = [];
  for (const table of live.snapshot.freightTables) {
    if (table.store !== store) continue;
    const index = live.tableIndexById.get(table.id);
    if (index == null) continue;
    out.push({
      index,
      store,
      label: table.name,
      bandCount: table.bands?.length ?? 0,
      polygonIds: live.polygons.filter((p) => p.store === store).map((p) => p.id),
      tableIndexes: [index],
    });
  }
  return out;
}
