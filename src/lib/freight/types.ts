export type StoreName = "Aricanduva" | "Suzano";
export type StoreSelection = StoreName | "Ambas";
export type Modality = "Entrega" | "Retira";

/** Faixa de peso lida da planilha (somente leitura). */
export interface WeightBand {
  /** Weight_Start */
  ws: number | null;
  /** Weight_End */
  we: number | null;
  /** AbsoluteMoneyCost */
  amc: number | null;
  /** PriceByExtraWeight */
  pew: number | null;
}

export interface PolygonRecord {
  id: string;
  store: StoreName;
  district: string | null;
  uf: string | null;
  band: string;
  radius: number;
  rMin: number;
  rMax: number;
  areaKm2: number;
  center: [number, number];
  /** índice na lista de tabelas de tarifa; null = sem regra correspondente */
  tariff: number | null;
  /** MultiPolygon: [poligono][anel][ponto][lng,lat] */
  geom: number[][][][];
}

export interface StoreRef {
  name: StoreName;
  center: [number, number];
  note: string;
}

export interface FreightDataset {
  generatedAt: string;
  sources: { geojson: string[]; excel: string };
  joinKey: string;
  stores: StoreRef[];
  tariffs: WeightBand[][];
  polygons: PolygonRecord[];
}
