import type { StoreName } from "./types";

/**
 * Paleta unificada: a cor identifica SOMENTE a faixa de raio (5KM a 30KM)
 * e é a mesma para todas as lojas. A loja é distinguida pelo padrão do contorno.
 */
export const BAND_ORDER = ["5KM", "10KM", "15KM", "20KM", "25KM", "30KM"] as const;

export const BAND_COLORS: Record<string, string> = {
  "5KM": "#e11d48",
  "10KM": "#f97316",
  "15KM": "#eab308",
  "20KM": "#22c55e",
  "25KM": "#06b6d4",
  "30KM": "#2563eb",
};

export const STORE_DASH: Record<StoreName, string | undefined> = {
  Aricanduva: undefined,
  Suzano: "6 4",
  Mooca: "2 4",
  "Praia Grande": "10 4",
  Piracicaba: "8 3 2 3",
  Benfica: "1 3",
  "Duque de Caxias": "12 4 2 4",
  Guadalupe: "4 2",
  Jacarepagua: "14 5",
  Mesquita: "3 3 8 3",
  Niteroi: "2 6",
};

export const STORE_DASH_LABEL: Record<StoreName, string> = {
  Aricanduva: "contorno sólido",
  Suzano: "tracejado médio",
  Mooca: "pontilhado",
  "Praia Grande": "tracejado longo",
  Piracicaba: "traço-ponto",
  Benfica: "pontilhado fino",
  "Duque de Caxias": "traço longo-ponto",
  Guadalupe: "tracejado curto",
  Jacarepagua: "traço extra longo",
  Mesquita: "ponto-traço longo",
  Niteroi: "pontilhado espaçado",
};

export const bandColor = (_store: StoreName, band: string) =>
  BAND_COLORS[band] ?? "#64748b";
