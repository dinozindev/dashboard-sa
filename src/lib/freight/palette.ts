import type { StoreName } from "./types";

/**
 * Regra 9 — cada faixa de raio recebe uma cor categórica própria (matiz distinto),
 * e cada loja tem sua própria paleta + padrão de contorno.
 */
export const BAND_ORDER = ["5KM", "10KM", "15KM", "20KM", "25KM", "30KM"] as const;

export const PALETTE: Record<StoreName, Record<string, string>> = {
  Aricanduva: {
    "5KM": "#e11d48",
    "10KM": "#f97316",
    "15KM": "#eab308",
    "20KM": "#22c55e",
    "25KM": "#06b6d4",
    "30KM": "#2563eb",
  },
  Suzano: {
    "5KM": "#7c3aed",
    "10KM": "#db2777",
    "15KM": "#0d9488",
    "20KM": "#84cc16",
    "25KM": "#f59e0b",
    "30KM": "#0ea5e9",
  },
};

export const STORE_DASH: Record<StoreName, string | undefined> = {
  Aricanduva: undefined,
  Suzano: "6 4",
};

export const bandColor = (store: StoreName, band: string) =>
  PALETTE[store]?.[band] ?? "#64748b";
