import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, GeoJSON as LeafletGeoJSON, Layer, PathOptions } from "leaflet";
import { boundsOf, type PolygonFeature } from "@/lib/freight";
import { LOJA_COLORS, faixaOpacity } from "@/lib/palette";

interface Props {
  features: PolygonFeature[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  tooltipHtml: (f: PolygonFeature) => string;
}

export function FreightMap({ features, selectedId, onSelect, tooltipHtml }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LeafletGeoJSON | null>(null);
  const [ready, setReady] = useState(false);
  const handlers = useRef({ onSelect, tooltipHtml });
  handlers.current = { onSelect, tooltipHtml };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;
      const map = L.map(containerRef.current, {
        center: [-23.56, -46.4],
        zoom: 10,
        zoomControl: true,
        preferCanvas: true,
      });
      // Mapa-base de ruas OpenStreetMap. Para usar o Google Maps como base,
      // basta conectar uma API Key e trocar esta camada por gridlayer-googlemutant.
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      const map = mapRef.current;
      if (cancelled || !map) return;

      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
      if (!features.length) return;

      const style = (f?: PolygonFeature): PathOptions => {
        const p = f?.properties;
        const color = (p && LOJA_COLORS[p.loja]) || "#888888";
        const isSel = !!p && p.id === selectedId;
        return {
          color: isSel ? "#111827" : color,
          weight: isSel ? 2.5 : 0.8,
          fillColor: color,
          fillOpacity: faixaOpacity(p?.faixa),
        };
      };

      const layer = L.geoJSON(features as never, {
        style: style as never,
        onEachFeature: (feature: unknown, lyr: Layer) => {
          const f = feature as PolygonFeature;
          lyr.bindTooltip(handlers.current.tooltipHtml(f), { sticky: true, className: "freight-tooltip" });
          lyr.on({
            mouseover: () => (lyr as never as { setStyle: (o: PathOptions) => void }).setStyle({ weight: 2.5, color: "#111827" }),
            mouseout: () => layerRef.current?.resetStyle(lyr as never),
            click: () => handlers.current.onSelect(f.properties.id),
          });
        },
      });
      layer.addTo(map);
      layerRef.current = layer;

      const b = boundsOf(features);
      if (b) map.fitBounds(b, { padding: [24, 24] });
    })();
    return () => {
      cancelled = true;
    };
  }, [features, ready, selectedId]);

  return <div ref={containerRef} className="h-full w-full" aria-label="Mapa das áreas de frete" />;
}

export default FreightMap;
