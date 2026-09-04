import type { PolygonRecord } from "./types";

function inRing(lng: number, lat: number, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const pi = ring[i];
    const pj = ring[j];
    if (!pi || !pj) continue;
    const xi = pi[0] as number;
    const yi = pi[1] as number;
    const xj = pj[0] as number;
    const yj = pj[1] as number;
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function pointInPolygon(lng: number, lat: number, rec: PolygonRecord) {
  for (const poly of rec.geom) {
    if (poly.length === 0) continue;
    if (!inRing(lng, lat, poly[0] ?? [])) continue;
    let hole = false;
    for (let i = 1; i < poly.length; i++) if (inRing(lng, lat, poly[i] ?? [])) hole = true;
    if (!hole) return true;
  }
  return false;
}

export function polygonsAtPoint(lng: number, lat: number, list: PolygonRecord[]) {
  return list.filter((p) => pointInPolygon(lng, lat, p));
}

export function boundsOf(list: PolygonRecord[]): [[number, number], [number, number]] | null {
  let minLat = Infinity,
    minLng = Infinity,
    maxLat = -Infinity,
    maxLng = -Infinity;
  for (const p of list)
    for (const poly of p.geom)
      for (const pt of poly[0] ?? []) {
        const lng = pt[0] as number;
        const lat = pt[1] as number;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
      }
  if (!isFinite(minLat)) return null;
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}

/** Contorno aproximado do estado de São Paulo (lng, lat) — usado apenas para
 * classificar um ponto como "dentro de SP" quando ele está fora das áreas de entrega. */
const SP_OUTLINE: [number, number][] = [
  [-53.11, -22.6], [-52.4, -22.15], [-51.6, -21.9], [-50.9, -21.5], [-50.3, -20.9],
  [-49.7, -20.2], [-49.0, -19.9], [-48.2, -19.9], [-47.5, -20.2], [-47.0, -20.6],
  [-46.6, -21.0], [-46.2, -21.6], [-45.5, -22.0], [-44.8, -22.3], [-44.16, -22.9],
  [-44.6, -23.35], [-45.4, -23.8], [-46.4, -24.1], [-47.2, -24.6], [-47.9, -25.0],
  [-48.6, -25.4], [-49.4, -24.6], [-50.2, -24.1], [-51.0, -23.6], [-52.0, -23.1],
  [-53.11, -22.6],
];

export function isInSaoPauloState(lng: number, lat: number) {
  let inside = false;
  for (let i = 0, j = SP_OUTLINE.length - 1; i < SP_OUTLINE.length; j = i++) {
    const [xi, yi] = SP_OUTLINE[i] as [number, number];
    const [xj, yj] = SP_OUTLINE[j] as [number, number];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function distanceKm(a: [number, number], b: [number, number]) {
  const R = 6371;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
