/**
 * SIMULADOR DE ENVIO
 * Dado um ponto (lng, lat) e um peso, lista todas as opções de frete:
 * - Entrega: polígonos de todas as lojas que cobrem o ponto × tabelas de
 *   Entrega da loja (valor base + incremento por kg, igual ao painel).
 * - Retira: malha estadual que contém o ponto × tabelas de Retira (valor único).
 */
import type { LiveState } from "./live";
import { normalizePolygonName } from "./live";
import { pointInPolygon } from "./geo";
import { calcPrice, type PriceBreakdown } from "./pricing";
import { statePolygons as staticStatePolygons } from "./state-polygons";
import type { PolygonRecord, WeightBand } from "./types";

export interface SimOption {
  id: string;
  kind: "Entrega" | "Retira";
  store: string;
  modality: string;
  table: string;
  polygon: string;
  price: PriceBreakdown;
  time: string | null;
}

const LEGACY_MODALITY = "Entrega Normal";

/** Converte TimeCost ("2.00:00:00" ou "02:00:00:00") em texto legível. */
export function formatTimeCost(raw: string | null | undefined): string {
  if (!raw) return "—";
  const s = String(raw).trim();
  const m = s.match(/^(?:(\d+)[.:])?(\d{1,2}):(\d{2}):(\d{2})$/);
  if (!m) return s;
  const d = Number(m[1] ?? 0);
  const h = Number(m[2]);
  const min = Number(m[3]);
  const parts: string[] = [];
  if (d) parts.push(`${d} ${d === 1 ? "dia" : "dias"}`);
  if (h) parts.push(`${h} h`);
  if (min) parts.push(`${min} min`);
  return parts.length ? parts.join(" ") : "Imediato";
}

function tablePolygonNames(table: { name: string; polygonName?: string | null }) {
  const own = normalizePolygonName(table.polygonName);
  const suffix = table.name.includes(" · ") ? normalizePolygonName(table.name.split(" · ").at(-1)) : "";
  return new Set([own, suffix].filter(Boolean));
}

export function simulate(live: LiveState, lng: number, lat: number, weight: number) {
  const options: SimOption[] = [];
  const draftById = new Map(live.drafts.map((d) => [d.id, d]));

  // ---------- ENTREGA ----------
  const hits: PolygonRecord[] = live.polygons.filter(
    (p) => p.kind !== "Retira" && pointInPolygon(lng, lat, p),
  );
  const hitsByStore = new Map<string, PolygonRecord[]>();
  for (const p of hits) hitsByStore.set(p.store, [...(hitsByStore.get(p.store) ?? []), p]);

  for (const [store, polys] of hitsByStore) {
    // menor polígono primeiro (mais específico)
    polys.sort((a, b) => a.areaKm2 - b.areaKm2);
    for (const table of live.snapshot.freightTables) {
      if (table.store !== store) continue;
      const draft = table.policyClientId ? draftById.get(table.policyClientId) : undefined;
      if (draft && draft.policyType === "Retira") continue;
      if (table.policyClientId && !draft) continue;
      const names = tablePolygonNames(table);
      let poly: PolygonRecord | undefined = polys[0];
      if (names.size) {
        poly = polys.find((p) => names.has(normalizePolygonName(p.id.split("|").pop())));
        if (!poly) continue;
      }
      if (!poly) continue;
      const modalities = draft ? (draft.modalities.length ? draft.modalities : ["—"]) : [LEGACY_MODALITY];
      const price = calcPrice(table.bands as WeightBand[], weight);
      for (const modality of modalities) {
        options.push({
          id: `${table.id}-${modality}-${poly.id}`,
          kind: "Entrega",
          store,
          modality,
          table: table.name,
          polygon: poly.id.split("|").pop() ?? poly.id,
          price,
          time: (price.band?.time as string | null | undefined) ?? null,
        });
      }
    }
  }

  // ---------- RETIRA ----------
  const states = live.statePolygons.length ? live.statePolygons : staticStatePolygons;
  const state = states.find((s) =>
    pointInPolygon(lng, lat, { geom: s.geom } as unknown as PolygonRecord),
  );
  if (state?.polygonName) {
    const statePolygonName = state.polygonName;
    for (const table of live.snapshot.freightTables) {
      if (table.polygonName !== state.polygonName) continue;
      const draft = table.policyClientId ? draftById.get(table.policyClientId) : undefined;
      if (!draft || draft.policyType !== "Retira") continue;
      const first = (table.bands as WeightBand[])[0];
      const amc = first?.amc ?? null;
      const price: PriceBreakdown =
        amc == null
          ? { ok: false, message: "Tabela sem valor", basePrice: 0, includedWeight: 0, extraWeight: 0, extraRate: 0, total: 0 }
          : { ok: true, band: first as WeightBand, basePrice: amc, includedWeight: weight, extraWeight: 0, extraRate: 0, total: amc };
      for (const modality of draft.modalities.length ? draft.modalities : ["Retira"]) {
        options.push({
          id: `${table.id}-${modality}`,
          kind: "Retira",
          store: table.store,
          modality,
          table: table.name,
          polygon: statePolygonName,
          price,
          time: (first?.time as string | null | undefined) ?? null,
        });
      }
    }
  }

  options.sort((a, b) => {
    if (a.price.ok !== b.price.ok) return a.price.ok ? -1 : 1;
    return a.price.total - b.price.total;
  });
  return { options, hits, state: state ?? null };
}
