import type { WeightBand } from "./types";

export const NO_RULE = "Regra de frete não encontrada";

export interface PriceBreakdown {
  ok: boolean;
  message?: string;
  band?: WeightBand;
  /** 1. Preço inicial da faixa */
  basePrice: number;
  /** 2. Peso incluído na faixa */
  includedWeight: number;
  /** 3. Peso excedente */
  extraWeight: number;
  /** 4. Custo adicional por kg */
  extraRate: number;
  /** 5. Preço final calculado */
  total: number;
}

const invalid = (message: string): PriceBreakdown => ({
  ok: false,
  message,
  basePrice: 0,
  includedWeight: 0,
  extraWeight: 0,
  extraRate: 0,
  total: 0,
});

/** Localiza a faixa aplicável: a que contém o peso; acima do teto, a última faixa. */
export function findBand(bands: WeightBand[] | undefined, weight: number): WeightBand | undefined {
  if (!bands || bands.length === 0) return undefined;
  const valid = bands.filter((b) => b.ws !== null && b.we !== null);
  if (valid.length === 0) return undefined;
  const hit = valid.find((b) => weight >= (b.ws as number) && weight <= (b.we as number));
  if (hit) return hit;
  const sorted = [...valid].sort((a, b) => (a.we as number) - (b.we as number));
  const last = sorted[sorted.length - 1];
  if (last && weight > (last.we as number)) return last;
  return sorted[0];
}

/**
 * Regra 5:
 *   Weight_Start <= Peso <= Weight_End -> Preço = AbsoluteMoneyCost
 *   Peso > Weight_End -> Preço = AbsoluteMoneyCost + (Peso - Weight_End) * PriceByExtraWeight
 */
export function calcPrice(bands: WeightBand[] | undefined, weight: number): PriceBreakdown {
  const band = findBand(bands, weight);
  if (!band) return invalid(NO_RULE);
  if (band.amc === null || band.ws === null || band.we === null) {
    return invalid("Dados incompletos na planilha para esta faixa");
  }
  const extraWeight = weight > band.we ? weight - band.we : 0;
  const extraRate = band.pew ?? 0;
  if (extraWeight > 0 && band.pew === null) {
    return invalid("Peso excedente sem PriceByExtraWeight na planilha");
  }
  return {
    ok: true,
    band,
    basePrice: band.amc,
    includedWeight: Math.min(weight, band.we),
    extraWeight,
    extraRate,
    total: band.amc + extraWeight * extraRate,
  };
}

export function bandPrices(bands: WeightBand[] | undefined, weight: number) {
  if (!bands) return [];
  return bands.map((b) => ({ band: b, price: calcPrice([b], weight) }));
}

export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const kg = (v: number | null) =>
  v === null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg`;
