import type { Loja } from "./freight";

/** Canvas colors used by Leaflet (mirrors the design tokens in styles.css). */
export const LOJA_COLORS: Record<Loja, string> = {
  Aricanduva: "#e8703a",
  Suzano: "#1f9c9c",
};

/** Opacity ramp by radius band — inner bands are denser. */
export const FAIXA_OPACITY: Record<string, number> = {
  "5KM": 0.62,
  "10KM": 0.5,
  "15KM": 0.38,
  "20KM": 0.28,
  "25KM": 0.2,
  "30KM": 0.13,
};

export const faixaOpacity = (faixa: string | null | undefined) =>
  (faixa ? FAIXA_OPACITY[faixa] : undefined) ?? 0.35;
