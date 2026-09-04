import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { PolygonRecord } from "@/lib/freight/types";
import { bandColor, STORE_DASH } from "@/lib/freight/palette";
import { boundsOf } from "@/lib/freight/geo";
import { stores } from "@/lib/freight/dataset";

interface Props {
  visible: PolygonRecord[];
  selectedId: string | null;
  tooltipFor: (rec: PolygonRecord) => string;
  onSelect: (rec: PolygonRecord) => void;
  onMapClick: (lng: number, lat: number) => void;
  fitKey: string;
}

const GOOGLE_KEY = import.meta.env['VITE_GOOGLE_MAPS_API_KEY'] as string | undefined;

export default function FreightMap({
  visible,
  selectedId,
  tooltipFor,
  onSelect,
  onMapClick,
  fitKey,
}: Props) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const cb = useRef({ onSelect, onMapClick, tooltipFor });
  cb.current = { onSelect, onMapClick, tooltipFor };

  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current, { zoomControl: true }).setView(
      [-23.55, -46.4],
      10,
    );

    // Base: Google Maps quando houver chave configurada; caso contrário OpenStreetMap.
    const url = GOOGLE_KEY
      ? "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&key=" + GOOGLE_KEY
      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
    L.tileLayer(url, {
      maxZoom: 19,
      attribution: GOOGLE_KEY ? "&copy; Google" : "&copy; OpenStreetMap",
    }).addTo(map);

    for (const s of stores) {
      L.marker([s.center[1], s.center[0]], {
        icon: L.divIcon({
          className: "",
          html: `<div class="map-store-marker"><img src="/logo-marker.png" alt="" class="map-store-marker__icon"/><span class="map-store-marker__label">${s.name}</span></div>`,
          iconSize: [0, 0],
        }),
      })
        .addTo(map)
        .bindPopup(`<strong>${s.name}</strong><br/>${s.note}`);
    }

    map.on("click", (e: L.LeafletMouseEvent) => cb.current.onMapClick(e.latlng.lng, e.latlng.lat));
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 120);
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const group = layerRef.current;
    if (!group) return;
    group.clearLayers();
    const ordered = [...visible].sort((a, b) => b.radius - a.radius);
    for (const rec of ordered) {
      const color = bandColor(rec.store, rec.band);
      const latlngs = rec.geom.map((poly) =>
        poly.map((ring) => ring.map(([lng, lat]) => [lat, lng] as [number, number])),
      );
      const layer = L.polygon(latlngs, {
        color,
        weight: rec.id === selectedId ? 3.5 : 1.2,
        opacity: 0.95,
        dashArray: STORE_DASH[rec.store],
        fillColor: color,
        fillOpacity: rec.id === selectedId ? 0.55 : 0.28,
      });
      layer.bindTooltip(cb.current.tooltipFor(rec), { sticky: true, className: "freight-tooltip" });
      layer.on("mouseover", () => layer.setStyle({ fillOpacity: 0.6, weight: 2.5 }));
      layer.on("mouseout", () =>
        layer.setStyle({
          fillOpacity: rec.id === selectedId ? 0.55 : 0.28,
          weight: rec.id === selectedId ? 3.5 : 1.2,
        }),
      );
      layer.on("click", (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        cb.current.onSelect(rec);
        cb.current.onMapClick(e.latlng.lng, e.latlng.lat);
      });
      group.addLayer(layer);
    }
  }, [visible, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const b = boundsOf(visible);
    if (b) map.fitBounds(b as L.LatLngBoundsExpression, { padding: [24, 24] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  return <div ref={elRef} className="h-full w-full" />;
}
