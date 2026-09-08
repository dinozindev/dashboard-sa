import raw from "@/data/freight-data.json";
import type { FreightDataset, PolygonRecord, Region, StoreName, WeightBand } from "./types";

export const dataset = raw as unknown as FreightDataset;

export const polygons: PolygonRecord[] = dataset.polygons;
export const stores = dataset.stores;

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

/** Regional de cada loja. */
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

export const storesInRegion = (region: Region | "Todas") =>
  region === "Todas" ? STORE_NAMES : STORE_NAMES.filter((s) => STORE_REGION[s] === region);

/** Lojas com tabela de frete, horários e capacidade cadastrados. */
export const OPS_STORES: StoreName[] = ["Aricanduva", "Suzano"];

/** Chave de simulação: `${polygonId}#${bandIndex}` -> faixa editada (memória apenas). */
export type Overrides = Record<string, WeightBand>;

export function tariffFor(
  rec: PolygonRecord | undefined | null,
  overrides: Overrides = {},
): WeightBand[] | undefined {
  if (!rec || rec.tariff === null || rec.tariff === undefined) return undefined;
  const base = dataset.tariffs[rec.tariff];
  if (!base) return undefined;
  return base.map((b, i) => overrides[`${rec.id}#${i}`] ?? b);
}

export function hasSimulation(rec: PolygonRecord | undefined | null, overrides: Overrides) {
  if (!rec) return false;
  return Object.keys(overrides).some((k) => k.startsWith(`${rec.id}#`));
}

export const polygonById = new Map(polygons.map((p) => [p.id, p]));
