/**
 * PONTOS DE RETIRADA
 * ==================
 *
 * Cada loja cadastrada gera automaticamente dois pontos de retirada
 * ("Retira Fácil" e "Retira Saldo Borderô"). Aqui é possível editar endereço,
 * instruções, tags e horário de funcionamento de cada ponto.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { refreshLive, storeRegionOf, useLive } from "@/lib/freight/live";
import { savePickupPoint } from "@/lib/freight/remote.functions";
import { logAudit } from "@/lib/freight/audit-log";
import type { FreightSnapshotDto } from "@/lib/freight/remote.functions";
import { UF_NAMES } from "@/lib/freight/types";

type PickupPoint = FreightSnapshotDto["pickupPoints"][number];
type Hours = PickupPoint["hours"];

const DAY_ORDER = [
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
  "Domingo",
] as const;

function defaultHours(): Hours {
  return DAY_ORDER.map((day) => ({
    day,
    enabled: day !== "Domingo",
    start: "08:00",
    end: day === "Domingo" ? "13:00" : "18:00",
  }));
}

/** Endereço aproximado a partir das coordenadas da loja (OpenStreetMap). */
async function reverseGeocode(lng: number, lat: number): Promise<string | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const json = (await res.json()) as { display_name?: string };
    return json.display_name ?? null;
  } catch {
    return null;
  }
}

function MiniMap({ center }: { center: [number, number] | null }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current || !center) return;
    let cleanup = () => {};
    void (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (!ref.current) return;
      const map = L.map(ref.current, {
        center: [center[1], center[0]],
        zoom: 15,
        zoomControl: false,
        attributionControl: false,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
      L.circleMarker([center[1], center[0]], {
        radius: 8,
        color: "#2563eb",
        fillColor: "#2563eb",
        fillOpacity: 0.7,
      }).addTo(map);
      cleanup = () => map.remove();
    })();
    return () => cleanup();
  }, [center]);

  if (!center) {
    return (
      <div className="flex h-48 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
        Loja sem coordenadas cadastradas.
      </div>
    );
  }
  return <div ref={ref} className="h-48 w-full overflow-hidden rounded-md border border-border" />;
}

function PointEditor({ point, onBack }: { point: PickupPoint; onBack: () => void }) {
  const [active, setActive] = useState(point.active);
  const [instructions, setInstructions] = useState(point.instructions ?? "");
  const [address, setAddress] = useState(point.address ?? "");
  const [tags, setTags] = useState<string[]>(point.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [hours, setHours] = useState<Hours>(
    point.hours?.length ? point.hours : defaultHours(),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Endereço vem da geocodificação reversa das coordenadas da loja.
  useEffect(() => {
    if (address || !point.center) return;
    void reverseGeocode(point.center[0], point.center[1]).then((found) => {
      if (found) setAddress(found);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [point.id]);

  const addTag = () => {
    const value = tagInput.trim();
    if (!value || tags.length >= 3 || tags.includes(value)) return;
    setTags([...tags, value]);
    setTagInput("");
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await savePickupPoint({
        data: {
          point: {
            id: point.id,
            active,
            instructions,
            address: address || null,
            tags,
            hours,
          },
        },
      });
      logAudit({
        store: point.store,
        module: "Pontos de Retirada",
        field: point.name,
        before: "",
        after: address,
        action: "Edição",
        description: `Ponto de retirada ${point.name} atualizado.`,
      });
      await refreshLive();
      setMessage("Ponto de retirada salvo.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <button type="button" className="text-xs text-primary" onClick={onBack}>
            ← Voltar para a lista
          </button>
          <h2 className="section-title text-lg">{point.name}</h2>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />
          Ativo
        </label>
      </div>

      <div className="surface grid gap-4 p-4 lg:grid-cols-2">
        <div className="space-y-3">
          <label className="block text-xs text-muted-foreground">
            Nome do ponto
            <input className="input mt-1 w-full" value={point.name} readOnly />
          </label>
          <label className="block text-xs text-muted-foreground">
            ID
            <input className="input mt-1 w-full" value={point.id} readOnly />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-muted-foreground">
              Latitude
              <input className="input mt-1 w-full" value={point.center?.[1] ?? ""} readOnly />
            </label>
            <label className="block text-xs text-muted-foreground">
              Longitude
              <input className="input mt-1 w-full" value={point.center?.[0] ?? ""} readOnly />
            </label>
          </div>
          <label className="block text-xs text-muted-foreground">
            Endereço
            <input
              className="input mt-1 w-full"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Buscado automaticamente pelas coordenadas"
            />
          </label>
        </div>
        <MiniMap center={point.center} />
      </div>

      <div className="surface space-y-3 p-4">
        <h3 className="text-sm font-semibold">Instruções de retirada</h3>
        <textarea
          className="input min-h-24 w-full"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Ex.: apresentar documento com foto e número do pedido."
        />
      </div>

      <div className="surface space-y-3 p-4">
        <h3 className="text-sm font-semibold">Tags (até 3)</h3>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs"
            >
              {tag}
              <button
                type="button"
                className="text-muted-foreground"
                onClick={() => setTags(tags.filter((t) => t !== tag))}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        {tags.length < 3 ? (
          <div className="flex gap-2">
            <input
              className="input w-full max-w-xs"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="Nova tag"
            />
            <button type="button" className="btn-primary" onClick={addTag}>
              Adicionar
            </button>
          </div>
        ) : null}
      </div>

      <div className="surface space-y-3 p-4">
        <h3 className="text-sm font-semibold">Horário de funcionamento</h3>
        <div className="space-y-2">
          {hours.map((row, index) => (
            <div key={row.day} className="flex flex-wrap items-center gap-3">
              <label className="flex w-40 items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={row.enabled}
                  onChange={(e) => {
                    const next = [...hours];
                    next[index] = { ...row, enabled: e.target.checked };
                    setHours(next);
                  }}
                />
                {row.day}
              </label>
              <input
                type="time"
                className="input w-32"
                value={row.start}
                disabled={!row.enabled}
                onChange={(e) => {
                  const next = [...hours];
                  next[index] = { ...row, start: e.target.value };
                  setHours(next);
                }}
              />
              <span className="text-xs text-muted-foreground">até</span>
              <input
                type="time"
                className="input w-32"
                value={row.end}
                disabled={!row.enabled}
                onChange={(e) => {
                  const next = [...hours];
                  next[index] = { ...row, end: e.target.value };
                  setHours(next);
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="button" className="btn-primary" disabled={saving} onClick={() => void save()}>
          {saving ? "Salvando…" : "Salvar ponto de retirada"}
        </button>
        {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
      </div>
    </section>
  );
}

export function PickupPointsPanel() {
  const live = useLive();
  const [storeFilter, setStoreFilter] = useState<string[] | null>(null);
  const [storesOpen, setStoresOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const points = useMemo<PickupPoint[]>(
    () => (live?.snapshot.pickupPoints ?? []) as PickupPoint[],
    [live],
  );
  const stores = useMemo(
    () => Array.from(new Set(points.map((p) => p.store))).sort(),
    [points],
  );
  const visible =
    storeFilter === null ? points : points.filter((p) => storeFilter.includes(p.store));
  const stateGroups = useMemo(() => {
    const groups = new Map<string, Map<string, PickupPoint[]>>();
    for (const point of visible) {
      const state = storeRegionOf(live, point.store) ?? "Sem estado";
      const storesInState = groups.get(state) ?? new Map<string, PickupPoint[]>();
      const storePoints = storesInState.get(point.store) ?? [];
      storesInState.set(point.store, [...storePoints, point]);
      groups.set(state, storesInState);
    }
    return Array.from(groups.entries()).sort(([left], [right]) => left.localeCompare(right));
  }, [live, visible]);
  const selected = points.find((p) => p.id === selectedId) ?? null;

  if (selected) {
    return <PointEditor point={selected} onBack={() => setSelectedId(null)} />;
  }

  return (
    <section className="space-y-3">
      <div className="surface flex flex-wrap items-end gap-3 p-4">
        <div>
          <h2 className="section-title text-lg">Pontos de retirada</h2>
          <p className="text-xs text-muted-foreground">
            Cada loja cadastrada tem dois pontos de retirada criados automaticamente.
          </p>
        </div>
        {/* <div className="field-label relative ml-auto">
          Loja
          <button
            type="button"
            className="input mt-1 flex w-56 items-center justify-between gap-2 text-left"
            aria-expanded={storesOpen}
            onClick={() => setStoresOpen((value) => !value)}
          >
            <span className="truncate text-foreground">
              {storeFilter === null
                ? `Todas as lojas (${stores.length})`
                : storeFilter.length === 0
                  ? "Nenhuma loja"
                  : storeFilter.length === 1
                  ? storeFilter[0]
                  : `${storeFilter.length} lojas selecionadas`}
            </span>
            <span aria-hidden>▾</span>
          </button>
          {storesOpen ? (
            <div className="absolute right-0 top-full z-10 mt-1 w-72 rounded-xl border border-border bg-card p-2 shadow-lg">
              <div className="mb-1 flex items-center justify-between gap-2 px-1">
                <span className="text-[11px]">Exibir</span>
                <span className="flex gap-1">
                  <button
                    type="button"
                    className="btn-ghost text-[11px]"
                    onClick={() => setStoreFilter(null)}
                  >
                    Todas
                  </button>
                  <button
                    type="button"
                    className="btn-ghost text-[11px]"
                    onClick={() => setStoreFilter([])}
                  >
                    Limpar
                  </button>
                </span>
              </div>
              <div className="max-h-64 space-y-0.5 overflow-y-auto">
                {stores.map((store) => (
                  <label
                    key={store}
                    className="flex items-center gap-2 rounded-md px-1.5 py-1 text-xs text-foreground hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 accent-primary"
                      checked={storeFilter === null || storeFilter.includes(store)}
                      onChange={() =>
                        setStoreFilter((current) => {
                          const selected = current === null ? stores : current;
                          return selected.includes(store)
                            ? selected.filter((item) => item !== store)
                            : [...selected, store];
                        })
                      }
                    />
                    {store}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </div> */}
      </div>

      <div className="surface divide-y divide-border p-0">
        {stateGroups.map(([state, storesInState]) => (
          <details key={state} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground transition-transform group-open:rotate-90" aria-hidden>
                  ▸
                </span>
                {state === "Sem estado" ? state : `${state} - ${UF_NAMES[state] ?? state}`}
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {storesInState.size} {storesInState.size === 1 ? "loja" : "lojas"}
              </span>
            </summary>
            <div className="space-y-2 bg-muted/20 px-3 pb-3 pt-1">
              {Array.from(storesInState.entries())
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([store, storePoints]) => (
                  <details key={store} className="rounded-md border border-border bg-card">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                      <span className="flex items-center gap-2">
                        <span className="text-muted-foreground" aria-hidden>
                          ▸
                        </span>
                        {store}
                      </span>
                      <span className="text-xs font-normal text-muted-foreground">
                        {storePoints.length} {storePoints.length === 1 ? "ponto" : "pontos"}
                      </span>
                    </summary>
                    <div className="divide-y divide-border border-t border-border">
                      {storePoints.map((p) => (
                        <div
                          key={p.id}
                          className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm"
                        >
                          <div className="min-w-0">
                            <div className="font-medium">{p.name}</div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span className="font-mono">{p.id.slice(0, 8)}</span>
                              <span
                                className={
                                  "rounded-full px-2 py-0.5 font-semibold " +
                                  (p.active
                                    ? "bg-success/15 text-success"
                                    : "bg-muted text-muted-foreground")
                                }
                              >
                                {p.active ? "Ativo" : "Inativo"}
                              </span>
                              <span>{p.tags?.length ? p.tags.join(", ") : "Sem tags"}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                            onClick={() => setSelectedId(p.id)}
                          >
                            Editar
                          </button>
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
            </div>
          </details>
        ))}
        {!visible.length ? (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">
            Nenhum ponto de retirada. Cadastre uma loja na aba "Envio de Polígonos".
          </div>
        ) : null}
      </div>
    </section>
  );
}
