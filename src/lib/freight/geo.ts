/**
 * FUNÇÕES GEOMÉTRICAS E GEOGRÁFICAS
 * ==================================
 * 
 * Utilitários para detectar pontos dentro de polígonos,
 * buscar polígonos por coordenadas, e calcular distâncias.
 * 
 * Usa algoritmo Ray Casting para ponto-em-polígono.
 * Coordenadas em [lng, lat] (WGS84 / EPSG:4326).
 */

import type { PolygonRecord } from "./types";

// ============================================================================
// 1. DETECÇÃO PONTO-EM-POLÍGONO
// ============================================================================

/**
 * Algoritmo Ray Casting: verifica se ponto está dentro de um anel (ring).
 * 
 * Dispara um raio infinito a partir do ponto e conta intersecções
 * com as arestas do polígono. Se ímpar = dentro, se par = fora.
 * 
 * @param lng - Longitude (eixo X)
 * @param lat - Latitude (eixo Y)
 * @param ring - Array de [lng, lat] formando um anel fechado
 * @returns true se ponto está dentro do anel
 */
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

/**
 * Verifica se ponto (lng, lat) está dentro de um polígono.
 * 
 * Algoritmo:
 * 1. Para cada MultiPolygon do record
 * 2. Checa se está dentro do contorno externo (anel 0)
 * 3. Verifica se NÃO está dentro de nenhum buraco (anéis 1+)
 * 4. Retorna true se passou em ambas as verificações
 * 
 * @param lng - Longitude (WGS84)
 * @param lat - Latitude (WGS84)
 * @param rec - PolygonRecord com geometria GeoJSON
 * @returns true se ponto está dentro do polígono
 */
export function pointInPolygon(lng: number, lat: number, rec: PolygonRecord) {
  for (const poly of rec.geom) {
    if (poly.length === 0) continue;
    // anel[0] = contorno externo
    if (!inRing(lng, lat, poly[0] ?? [])) continue;
    // anéis[1+] = buracos (holes)
    let hole = false;
    for (let i = 1; i < poly.length; i++) if (inRing(lng, lat, poly[i] ?? [])) hole = true;
    if (!hole) return true;
  }
  return false;
}

/**
 * Encontra todos os polígonos que contêm o ponto.
 * 
 * Percorre lista de polígonos e retorna apenas aqueles
 * que contêm (lng, lat) segundo pointInPolygon().
 * 
 * @param lng - Longitude
 * @param lat - Latitude
 * @param list - Array de PolygonRecord para buscar
 * @returns Array de PolygonRecord que contêm o ponto
 */
export function polygonsAtPoint(lng: number, lat: number, list: PolygonRecord[]) {
  return list.filter((p) => pointInPolygon(lng, lat, p));
}

// ============================================================================
// 2. CÁLCULO DE BOUNDS E LIMITES
// ============================================================================

/**
 * Calcula o bounding box (envelope) de uma lista de polígonos.
 * 
 * Retorna [[minLat, minLng], [maxLat, maxLng]] para usar com Mapbox fitBounds.
 * 
 * @param list - Array de PolygonRecord
 * @returns [[minLat, minLng], [maxLat, maxLng]] ou null se lista vazia
 */
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

// ============================================================================
// 3. DETECÇÃO DE ESTADO (SP/RJ)
// ============================================================================

/**
 * Contorno aproximado do estado de São Paulo.
 * Usado como fallback para classificar um ponto como "dentro de SP"
 * quando ele está fora de qualquer área de entrega.
 * 
 * Coordenadas [lng, lat] em WGS84.
 */
const SP_OUTLINE: [number, number][] = [
  [-53.11, -22.6], [-52.4, -22.15], [-51.6, -21.9], [-50.9, -21.5], [-50.3, -20.9],
  [-49.7, -20.2], [-49.0, -19.9], [-48.2, -19.9], [-47.5, -20.2], [-47.0, -20.6],
  [-46.6, -21.0], [-46.2, -21.6], [-45.5, -22.0], [-44.8, -22.3], [-44.16, -22.9],
  [-44.6, -23.35], [-45.4, -23.8], [-46.4, -24.1], [-47.2, -24.6], [-47.9, -25.0],
  [-48.6, -25.4], [-49.4, -24.6], [-50.2, -24.1], [-51.0, -23.6], [-52.0, -23.1],
  [-53.11, -22.6],
];

/**
 * Verifica se ponto está dentro do estado de São Paulo.
 * Usa Ray Casting como pointInPolygon.
 * 
 * @param lng - Longitude
 * @param lat - Latitude
 * @returns true se dentro de SP (conforme contorno aproximado)
 */
export function isInSaoPauloState(lng: number, lat: number) {
  let inside = false;
  for (let i = 0, j = SP_OUTLINE.length - 1; i < SP_OUTLINE.length; j = i++) {
    const [xi, yi] = SP_OUTLINE[i] as [number, number];
    const [xj, yj] = SP_OUTLINE[j] as [number, number];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ============================================================================
// 4. CÁLCULO DE DISTÂNCIA
// ============================================================================

/**
 * Calcula distância Haversine entre dois pontos geográficos.
 * 
 * Fórmula usada em navegação e mapeamento.
 * Assume Terra como esfera de raio ~6371 km.
 * 
 * @param a - Ponto A [lng, lat]
 * @param b - Ponto B [lng, lat]
 * @returns Distância aproximada em km
 */
export function distanceKm(a: [number, number], b: [number, number]) {
  const R = 6371; // Raio da Terra em km
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
