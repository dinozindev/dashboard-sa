/**
 * MAPA INTERATIVO DE COBERTURA
 * =============================
 * 
 * Renderiza GeoJSON dos polígonos de entrega usando Leaflet.
 * 
 * Recursos:
 * - Click em polígono: seleciona e abre preço/detalhes
 * - Hover: opacidade aumenta para destaque
 * - Cores por faixa de raio (5km, 10km, etc)
 * - Padrões por loja (sólido, tracejado, pontilhado, etc)
 * - Markers das lojas com nomes e notas
 * - Basemap: Google Maps (se chave configurada) ou OpenStreetMap
 * 
 * Coordenadas: WGS84 [lng, lat] → Leaflet [lat, lng] (cuidado com ordem!)
 */

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { PolygonRecord } from "@/lib/freight/types";
import { bandColor, STORE_DASH } from "@/lib/freight/palette";
import { boundsOf } from "@/lib/freight/geo";
import { stores } from "@/lib/freight/dataset";

/**
 * Props do mapa.
 * 
 * @param visible - Polígonos a renderizar (já filtrados)
 * @param selectedId - ID do polígono selecionado (para destaque)
 * @param tooltipFor - Função que gera HTML do tooltip (passed from parent)
 * @param onSelect - Callback ao clicar em polígono
 * @param onMapClick - Callback ao clicar no mapa (fora de polígono)
 * @param fitKey - Key para re-ajustar o zoom (trigger externo)
 */
interface Props {
  visible: PolygonRecord[];
  selectedId: string | null;
  tooltipFor: (rec: PolygonRecord) => string;
  onSelect: (rec: PolygonRecord) => void;
  onMapClick: (lng: number, lat: number) => void;
  fitKey: string;
}

/**
 * Chave de API do Google Maps (opcional, env variable).
 * Se não fornecida, usa OpenStreetMap como basemap.
 */
const GOOGLE_KEY = import.meta.env['VITE_GOOGLE_MAPS_API_KEY'] as string | undefined;

export default function FreightMap({
  visible,
  selectedId,
  tooltipFor,
  onSelect,
  onMapClick,
  fitKey,
}: Props) {
  // ============================================================================
  // REFS: Mapa e camadas
  // ============================================================================
  
  /** Ref do elemento DOM do mapa */
  const elRef = useRef<HTMLDivElement | null>(null);
  
  /** Ref da instância Leaflet Map */
  const mapRef = useRef<L.Map | null>(null);
  
  /** Ref da camada que contém todos os polígonos */
  const layerRef = useRef<L.LayerGroup | null>(null);
  
  /**
   * Ref de callbacks atualizados.
   * Necessário porque eventualmente Leaflet usa versão "old" de funções
   * se não forem atualizadas via ref (closures em React).
   */
  const cb = useRef({ onSelect, onMapClick, tooltipFor });
  cb.current = { onSelect, onMapClick, tooltipFor };

  // ============================================================================
  // INICIALIZAÇÃO DO MAPA
  // ============================================================================
  
  /**
   * Inicializa mapa Leaflet uma única vez.
   * 
   * Processo:
   * 1. Cria mapa centrado em São Paulo (lat -23.55, lng -46.4), zoom 10
   * 2. Adiciona basemap (Google Maps ou OpenStreetMap)
   * 3. Adiciona markers das lojas (nome + nota)
   * 4. Configura eventos (click no mapa)
   * 5. Cria LayerGroup para polígonos
   * 
   * Cleanup: Remove mapa ao desmontar componente.
   */
  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current, { zoomControl: true }).setView(
      [-23.55, -46.4],
      10,
    );

    // Escolhe basemap: Google (se chave) ou OpenStreetMap
    const url = GOOGLE_KEY
      ? "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&key=" + GOOGLE_KEY
      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
    L.tileLayer(url, {
      maxZoom: 19,
      attribution: GOOGLE_KEY ? "&copy; Google" : "&copy; OpenStreetMap",
    }).addTo(map);

    // Camada de markers das lojas (preenchida conforme as lojas ativas)
    markersRef.current = L.layerGroup().addTo(map);

    // Click no mapa dispara callback (usado para comparação)
    map.on("click", (e: L.LeafletMouseEvent) => cb.current.onMapClick(e.latlng.lng, e.latlng.lat));
    
    // Cria grupo de camadas para polígonos
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    
    // Força redimensionamento (necessário para renderização correta)
    setTimeout(() => map.invalidateSize(), 120);
    
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ============================================================================
  // RENDERIZAÇÃO DE POLÍGONOS
  // ============================================================================
  
  /**
   * Renderiza polígonos sempre que lista `visible` ou `selectedId` muda.
   * 
   * Processo:
   * 1. Limpa camada anterior
   * 2. Ordena polígonos por raio (maior primeiro, para layering)
   * 3. Para cada polígono:
   *    - Obtém cor da banda
   *    - Converte coordenadas GeoJSON (lng, lat) → Leaflet (lat, lng)
   *    - Cria polígono com cor, peso, opacidade
   *    - Adiciona tooltip com detalhes
   *    - Configura eventos hover e click
   * 4. Adiciona à camada
   */
  useEffect(() => {
    const group = layerRef.current;
    if (!group) return;
    group.clearLayers();
    
    // Ordena por raio decrescente (maiores primeiro = layering visual correto)
    const ordered = [...visible].sort((a, b) => b.radius - a.radius);
    
    for (const rec of ordered) {
      const color = bandColor(rec.store, rec.band);
      
      // Converte coordenadas GeoJSON [lng, lat] → Leaflet [lat, lng]
      const latlngs = rec.geom.map((poly) =>
        poly.map((ring) => ring.map(([lng, lat]) => [lat, lng] as [number, number])),
      );
      
      // Cria polígono com estilo condicional (selecionado = mais visível)
      const layer = L.polygon(latlngs, {
        color,
        weight: rec.id === selectedId ? 3.5 : 1.2,
        opacity: 0.95,
        dashArray: STORE_DASH[rec.store],
        fillColor: color,
        fillOpacity: rec.id === selectedId ? 0.55 : 0.28,
      });
      
      // Tooltip com HTML (ID, loja, faixa, preço)
      layer.bindTooltip(cb.current.tooltipFor(rec), { sticky: true, className: "freight-tooltip" });
      
      // Hover: aumenta opacidade e peso
      layer.on("mouseover", () => layer.setStyle({ fillOpacity: 0.6, weight: 2.5 }));
      layer.on("mouseout", () =>
        layer.setStyle({
          fillOpacity: rec.id === selectedId ? 0.55 : 0.28,
          weight: rec.id === selectedId ? 3.5 : 1.2,
        }),
      );
      
      // Click: seleciona polígono E registra ponto (para comparação)
      layer.on("click", (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        cb.current.onSelect(rec);
        cb.current.onMapClick(e.latlng.lng, e.latlng.lat);
      });
      
      group.addLayer(layer);
    }
  }, [visible, selectedId]);

  // ============================================================================
  // AJUSTE DE ZOOM
  // ============================================================================
  
  /**
   * Re-ajusta zoom/pan para englobar todos os polígonos visíveis.
   * 
   * Disparado quando:
   * - Usuário troca região
   * - Usuário troca filtro de lojas
   * - fitKey muda (external trigger)
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const b = boundsOf(visible);
    if (b) map.fitBounds(b as L.LatLngBoundsExpression, { padding: [24, 24] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  return <div ref={elRef} className="h-full w-full" />;
}
