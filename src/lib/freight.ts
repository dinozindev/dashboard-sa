import { queryOptions } from "@tanstack/react-query";

export type Loja = "Aricanduva" | "Suzano";

export interface PolygonProps {
  id: string;
  loja: Loja;
  distrito: string | null;
  uf: string | null;
  raio: number | null;
  raioMin: number | null;
  raioMax: number | null;
  faixa: string | null;
}

export interface PolygonFeature {
  type: "Feature";
  properties: PolygonProps;
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] };
}

export interface FeatureCollection {
  type: "FeatureCollection";
  features: PolygonFeature[];
}

export interface WeightBand {
  ws: number | null;
  we: number | null;
  amc: number | null;
  pew: number | null;
}

/** Chave de associação GeoJSON <-> planilha: aba (loja) + PolygonName. */
export const ruleKey = (loja: string, polygonId: string) => `${loja}|${polygonId}`;

export type PricingTable = Record<string, WeightBand[]>;

export interface FreightData {
  features: PolygonFeature[];
  pricing: PricingTable;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao carregar ${url} (${res.status})`);
  return (await res.json()) as T;
}

export const freightQueryOptions = queryOptions({
  queryKey: ["freight-data"],
  staleTime: Infinity,
  queryFn: async (): Promise<FreightData> => {
    const [ari, suz, pricing] = await Promise.all([
      getJson<FeatureCollection>("/data/aricanduva.geojson"),
      getJson<FeatureCollection>("/data/suzano.geojson"),
      getJson<PricingTable>("/data/pricing.json"),
    ]);
    const features = [...ari.features, ...suz.features].filter(
      (f) => f?.geometry?.coordinates && Array.isArray(f.geometry.coordinates) && f.geometry.coordinates.length > 0,
    );
    return { features, pricing };
  },
});

/** Ordered radius bands present in the data. */
export const FAIXAS_RAIO = ["5KM", "10KM", "15KM", "20KM", "25KM", "30KM"] as const;

export interface PriceBreakdown {
  band: WeightBand;
  bandIndex: number;
  base: number;
  weightIncluded: number;
  excessWeight: number;
  extraPerKg: number;
  extraCost: number;
  total: number;
}

/** Sorted, sanitized bands for a polygon. Returns null when no rule exists. */
export function getBands(pricing: PricingTable, loja: string, polygonId: string): WeightBand[] | null {
  const raw = pricing[ruleKey(loja, polygonId)];
  if (!raw || raw.length === 0) return null;
  const valid = raw.filter((b) => b.ws !== null && b.we !== null && b.amc !== null);
  if (valid.length === 0) return null;
  return [...valid].sort((a, b) => (a.ws ?? 0) - (b.ws ?? 0));
}

/**
 * Preço = AbsoluteMoneyCost + (peso excedente ao início da faixa) x PriceByExtraWeight.
 * Pesos acima da última faixa usam a última faixa disponível.
 */
export function computePrice(bands: WeightBand[], weight: number): PriceBreakdown | null {
  if (!bands.length || !Number.isFinite(weight) || weight < 0) return null;
  let index = bands.findIndex((b) => weight >= (b.ws ?? 0) && weight <= (b.we ?? 0));
  const last = bands[bands.length - 1]!;
  if (index === -1) index = weight > (last.we ?? 0) ? bands.length - 1 : 0;
  const band = bands[index]!;
  const base = band.amc ?? 0;
  const start = band.ws ?? 0;
  const extraPerKg = band.pew ?? 0;
  const excessWeight = Math.max(0, weight - start);
  const extraCost = excessWeight * extraPerKg;
  return {
    band,
    bandIndex: index,
    base,
    weightIncluded: start,
    excessWeight,
    extraPerKg,
    extraCost,
    total: base + extraCost,
  };
}

/** Price for a polygon at a given weight, or null when no rule matches. */
export function priceForPolygon(
  pricing: PricingTable,
  loja: string,
  polygonId: string,
  weight: number,
): PriceBreakdown | null {
  const bands = getBands(pricing, loja, polygonId);
  if (!bands) return null;
  return computePrice(bands, weight);
}

export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const kg = (v: number) =>
  `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg`;

/** Approximate area (km²) of a polygon feature using the spherical excess formula. */
export function featureAreaKm2(feature: PolygonFeature): number {
  const R = 6371.0088;
  const ringArea = (ring: number[][]): number => {
    if (ring.length < 3) return 0;
    let total = 0;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]!;
      const b = ring[(i + 1) % ring.length]!;
      const lon1 = a[0] ?? 0, lat1 = a[1] ?? 0, lon2 = b[0] ?? 0, lat2 = b[1] ?? 0;
      total +=
        ((lon2 - lon1) * Math.PI) / 180 *
        (2 + Math.sin((lat1 * Math.PI) / 180) + Math.sin((lat2 * Math.PI) / 180));
    }
    return Math.abs((total * R * R) / 2);
  };
  const polyArea = (poly: number[][][]) =>
    poly.reduce((acc, ring, i) => acc + (i === 0 ? ringArea(ring) : -ringArea(ring)), 0);
  try {
    if (feature.geometry.type === "Polygon") return polyArea(feature.geometry.coordinates as number[][][]);
    return (feature.geometry.coordinates as number[][][][]).reduce((a, p) => a + polyArea(p), 0);
  } catch {
    return 0;
  }
}

/** Bounding box [[south, west], [north, east]] for a set of features. */
export function boundsOf(features: PolygonFeature[]): [[number, number], [number, number]] | null {
  let minLat = Infinity, minLon = Infinity, maxLat = -Infinity, maxLon = -Infinity;
  const visit = (c: unknown) => {
    if (Array.isArray(c) && typeof c[0] === "number" && typeof c[1] === "number") {
      const arr = c as number[];
      const lon = arr[0] as number, lat = arr[1] as number;
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
      minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
      minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon);
    } else if (Array.isArray(c)) c.forEach(visit);
  };
  features.forEach((f) => visit(f.geometry?.coordinates));
  if (!Number.isFinite(minLat) || !Number.isFinite(minLon)) return null;
  return [[minLat, minLon], [maxLat, maxLon]];
}
