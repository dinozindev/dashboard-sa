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
  Mooca: {
    "5KM": "#be123c",
    "10KM": "#c2410c",
    "15KM": "#a16207",
    "20KM": "#15803d",
    "25KM": "#0369a1",
    "30KM": "#4338ca",
  },
  "Praia Grande": {
    "5KM": "#9d174d",
    "10KM": "#7e22ce",
    "15KM": "#1d4ed8",
    "20KM": "#0f766e",
    "25KM": "#4d7c0f",
    "30KM": "#b45309",
  },
  Piracicaba: {
    "5KM": "#ea580c",
    "10KM": "#65a30d",
    "15KM": "#0891b2",
    "20KM": "#7c2d12",
    "25KM": "#9333ea",
    "30KM": "#1e40af",
  },
};

export const STORE_DASH: Record<StoreName, string | undefined> = {
  Aricanduva: undefined,
  Suzano: "6 4",
  Mooca: "2 4",
  "Praia Grande": "10 4",
  Piracicaba: "8 3 2 3",
};

export const bandColor = (store: StoreName, band: string) =>
  PALETTE[store]?.[band] ?? "#64748b";
