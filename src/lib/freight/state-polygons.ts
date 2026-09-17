/**
 * POLÍGONOS ESTADUAIS (modalidade Retira)
 * =======================================
 *
 * Na modalidade Retira usamos um polígono único por estado, em vez dos
 * polígonos individuais de cada loja. As geometrias vêm de
 * `src/data/state-polygons.json`, no mesmo formato GeoJSON MultiPolygon já
 * usado pelos polígonos de loja.
 *
 * Enquanto o arquivo oficial não estiver disponível, a lista fica vazia e a
 * interface avisa "Polígono estadual não carregado" — nenhum contorno é
 * inventado ou aproximado.
 */

import raw from "@/data/state-polygons.json";
import type { Region } from "./types";

export interface StatePolygon {
  /** UF do polígono (SP, RJ) */
  uf: Region;
  /** Nome do estado */
  name: string;
  /** GeoJSON MultiPolygon: [polígono][anel][ponto][lng,lat] */
  geom: number[][][][];
}

interface StatePolygonFile {
  source: string;
  states: StatePolygon[];
}

const file = raw as unknown as StatePolygonFile;

export const STATE_POLYGON_SOURCE = file.source;

export const statePolygons: StatePolygon[] = Array.isArray(file.states) ? file.states : [];

/** Polígonos estaduais das UFs informadas (vazio = arquivo ainda não carregado). */
export function statePolygonsFor(ufs: Region[]): StatePolygon[] {
  return statePolygons.filter((s) => ufs.includes(s.uf));
}
