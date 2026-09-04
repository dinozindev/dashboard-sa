import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { polygons, STORE_NAMES, tariffFor, hasSimulation, type Overrides } from "@/lib/freight/dataset";
import { BAND_ORDER } from "@/lib/freight/palette";
import { brl, calcPrice, kg } from "@/lib/freight/pricing";
import { polygonsAtPoint } from "@/lib/freight/geo";
import { HOLIDAYS } from "@/lib/freight/schedule";
import type { Modality, PolygonRecord, StoreSelection } from "@/lib/freight/types";
import { Legend } from "./Legend";
import { Kpis } from "./Kpis";
import { TariffTable } from "./TariffTable";
import { PriceBreakdownCard } from "./PriceBreakdown";
import { RuleSimulator } from "./RuleSimulator";
import { ScheduleGrid, StatusBadge } from "./SchedulePanel";
import { CapacityPanel } from "./CapacityPanel";
import { ComparePanel } from "./ComparePanel";
import { PoliciesPanel } from "./PoliciesPanel";

const FreightMap = lazy(() => import("./FreightMap"));

export default function Dashboard() {
  const [tab, setTab] = useState<"operacao" | "politicas">("operacao");
  const [selection, setSelection] = useState<StoreSelection>("Ambas");
  const [bands, setBands] = useState<string[]>([...BAND_ORDER]);
  const [search, setSearch] = useState("");
  const [weight, setWeight] = useState(10);
  const [modality, setModality] = useState<Modality>("Entrega");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bandIndex, setBandIndex] = useState<number | null>(null);
  const [overrides, setOverrides] = useState<Overrides>({});
  const [point, setPoint] = useState<{ lng: number; lat: number } | null>(null);
  const [now, setNow] = useState<Date>(() => new Date("2026-01-01T00:00:00Z"));
  useEffect(() => setNow(new Date()), []);
  const isPickup = modality === "Retira";

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return polygons.filter(
      (p) =>
        (selection === "Ambas" || p.store === selection) &&
        bands.includes(p.band) &&
        (q === "" ||
          p.id.toLowerCase().includes(q) ||
          (p.district ?? "").toLowerCase().includes(q)),
    );
  }, [selection, bands, search]);

  const selected = useMemo(
    () => visible.find((p) => p.id === selectedId) ?? null,
    [visible, selectedId],
  );
  const selectedBands = tariffFor(selected, overrides);
  const selectedPrice = calcPrice(selectedBands, weight);

  const kpis = useMemo(() => {
    const prices: number[] = [];
    for (const p of visible) {
      const r = calcPrice(tariffFor(p, overrides), weight);
      if (r.ok) prices.push(r.total);
    }
    const area = visible.reduce((s, p) => s + p.areaKm2, 0);
    const avg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
    const num = (v: number, d = 0) =>
      v.toLocaleString("pt-BR", { maximumFractionDigits: d });
    return [
      { label: "Polígonos visíveis", value: num(visible.length) },
      { label: "Área coberta", value: `${num(area, 1)} km²` },
      {
        label: "Lojas exibidas",
        value: selection === "Ambas" ? "2 (Aricanduva + Suzano)" : selection,
      },
      { label: "Peso simulado", value: kg(weight) },
      ...(isPickup
        ? []
        : [
            {
              label: "Menor frete",
              value: prices.length ? brl(Math.min(...prices)) : "—",
              tone: "low" as const,
            },
            {
              label: "Maior frete",
              value: prices.length ? brl(Math.max(...prices)) : "—",
              tone: "high" as const,
            },
            { label: "Frete médio", value: prices.length ? brl(avg) : "—" },
          ]),
    ];
  }, [visible, weight, overrides, selection, isPickup]);

  const tooltipFor = (rec: PolygonRecord) => {
    const r = calcPrice(tariffFor(rec, overrides), weight);
    return `<strong>${rec.id}</strong><br/>Loja: ${rec.store}<br/>Faixa: ${rec.band} (${rec.rMin}–${rec.rMax} km)<br/>${
      rec.district ? `Município/Distrito: ${rec.district}<br/>` : ""
    }${
      isPickup
        ? "Modalidade Retira — sem custo de frete"
        : `Peso ${kg(weight)}: <strong>${r.ok ? brl(r.total) : "Regra não encontrada"}</strong>`
    }`;
  };

  const matches = point ? polygonsAtPoint(point.lng, point.lat, visible) : [];

  const toggleBand = (b: string) =>
    setBands((cur) => (cur.includes(b) ? cur.filter((x) => x !== b) : [...cur, b]));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/70 backdrop-blur">
        <div className="mx-auto max-w-[1600px] px-4 py-4">
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Dashboard Interativo de Frete
          </h1>
          <p className="text-sm text-muted-foreground">
            Áreas de entrega, tarifas por faixa de peso e capacidade operacional — Aricanduva e
            Suzano.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-4 px-4 py-4">
        <nav className="flex gap-1 rounded-xl border border-border bg-card p-1 shadow-sm">
          {([
            ["operacao", "Operação e frete"],
            ["politicas", "Políticas de Envio"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors " +
                (tab === key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted")
              }
            >
              {label}
            </button>
          ))}
        </nav>

        {tab === "politicas" ? <PoliciesPanel /> : null}

        <div className={tab === "operacao" ? "space-y-4" : "hidden"}>
        {/* Filtros */}
        <section className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
          <label className="text-xs text-muted-foreground">
            Loja
            <select
              className="input mt-1 w-44"
              value={selection}
              onChange={(e) => setSelection(e.target.value as StoreSelection)}
            >
              <option value="Ambas">Ambas</option>
              {STORE_NAMES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <div className="text-xs text-muted-foreground">
            Faixas de raio
            <div className="mt-1 flex flex-wrap gap-1.5">
              {BAND_ORDER.map((b) => (
                <button
                  key={b}
                  onClick={() => toggleBand(b)}
                  className={
                    "rounded-md border px-2 py-1 text-xs font-medium transition-colors " +
                    (bands.includes(b)
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-muted")
                  }
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          <label className="text-xs text-muted-foreground">
            Modalidade
            <select
              className="input mt-1 w-36"
              value={modality}
              onChange={(e) => setModality(e.target.value as Modality)}
            >
              <option value="Entrega">Entrega</option>
              <option value="Retira">Retira</option>
            </select>
          </label>

          <label className="text-xs text-muted-foreground">
            Peso simulado (kg)
            <input
              type="number"
              min={0}
              step={0.5}
              className="input mt-1 w-28"
              value={weight}
              onChange={(e) => setWeight(Math.max(0, Number(e.target.value)))}
            />
          </label>

          <label className="min-w-52 flex-1 text-xs text-muted-foreground">
            Buscar polígono / município
            <input
              className="input mt-1 w-full"
              placeholder="Ex.: 5KM, Suzano, Vila..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>

          <button
            className="btn-ghost text-xs"
            onClick={() => {
              setSelection("Ambas");
              setBands([...BAND_ORDER]);
              setSearch("");
              setWeight(10);
              setSelectedId(null);
              setPoint(null);
            }}
          >
            Limpar filtros
          </button>
        </section>

        <Kpis items={kpis} />

        <section className="grid gap-4 xl:grid-cols-[1fr_380px]">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <ClientOnly
              fallback={<div className="h-[620px] w-full animate-pulse bg-muted" />}
            >
              <Suspense fallback={<div className="h-[620px] w-full animate-pulse bg-muted" />}>
                <FreightMap
                  visible={visible}
                  selectedId={selectedId}
                  tooltipFor={tooltipFor}
                  onSelect={(rec) => {
                    setSelectedId(rec.id);
                    setBandIndex(null);
                  }}
                  onMapClick={(lng, lat) => setPoint({ lng, lat })}
                  fitKey={`${selection}|${bands.join(",")}|${search}`}
                />
              </Suspense>
            </ClientOnly>
          </div>

          <div className="space-y-4">
            <Legend selection={selection} />
            <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Status de atendimento
              </p>
              <div className="flex flex-wrap gap-2">
                {STORE_NAMES.filter((s) => selection === "Ambas" || selection === s).map((s) => (
                  <StatusBadge
                    key={s}
                    store={s}
                    modality={modality}
                    now={now}
                    holidays={HOLIDAYS}
                  />
                ))}
              </div>
            </div>
            {point ? (
              <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Comparação no ponto clicado
                </p>
                <ComparePanel
                  point={point}
                  matches={matches}
                  weight={weight}
                  overrides={overrides}
                  modality={modality}
                  now={now}
                  holidays={HOLIDAYS}
                />
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
                Clique em qualquer ponto do mapa para comparar o preço entre as lojas em áreas de
                sobreposição.
              </p>
            )}
          </div>
        </section>

        {/* Detalhe do polígono selecionado */}
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
          {selected ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-semibold">{selected.id}</h2>
                  <p className="text-xs text-muted-foreground">
                    {selected.store} · faixa {selected.band} ({selected.rMin}–{selected.rMax} km) ·
                    {" "}
                    {selected.areaKm2.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km²
                    {selected.district ? ` · ${selected.district}` : ""}
                    {selected.uf ? `/${selected.uf}` : ""}
                  </p>
                </div>
                {hasSimulation(selected, overrides) ? (
                  <button
                    className="btn-ghost text-xs"
                    onClick={() =>
                      setOverrides(
                        Object.fromEntries(
                          Object.entries(overrides).filter(
                            ([k]) => !k.startsWith(`${selected.id}#`),
                          ),
                        ),
                      )
                    }
                  >
                    Restaurar faixas originais
                  </button>
                ) : null}
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                <TariffTable
                  bands={selectedBands}
                  weight={weight}
                  activeIndex={bandIndex}
                  onPickBand={setBandIndex}
                  hidePrice={isPickup}
                />
                {isPickup ? (
                  <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                    Modalidade <strong>Retira</strong>: sem custo de frete para o cliente — valores
                    de frete não são exibidos.
                  </div>
                ) : (
                  <PriceBreakdownCard
                    bands={selectedBands}
                    weight={weight}
                    simulated={hasSimulation(selected, overrides)}
                  />
                )}
              </div>

              {selectedBands ? (
                <RuleSimulator
                  rec={selected}
                  bands={selectedBands}
                  index={bandIndex}
                  onIndex={setBandIndex}
                  overrides={overrides}
                  setOverrides={setOverrides}
                />
              ) : null}

              {isPickup ? null : (
                <p className="text-xs text-muted-foreground">
                  Preço para {kg(weight)}:{" "}
                  <strong>
                    {selectedPrice.ok ? brl(selectedPrice.total) : selectedPrice.message}
                  </strong>
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Selecione um polígono no mapa para ver a tabela de faixas de peso, a composição do
              preço e o simulador de regras.
            </p>
          )}
        </section>

        {/* Horários e capacidade */}
        <section className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
            <h2 className="font-display text-lg font-semibold">Horários de atendimento</h2>
            {STORE_NAMES.map((s) => (
              <ScheduleGrid key={s} store={s} modality={modality} />
            ))}
          </div>
          <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
            <h2 className="font-display text-lg font-semibold">Capacidade operacional</h2>
            <CapacityPanel />
          </div>
        </section>
        </div>


        <footer className="pb-8 text-[11px] text-muted-foreground">
          Fonte: GeoJSON de polígonos + planilha de frete (associação Nome_Poligono ↔ PolygonName).
          Simulações de faixas são aplicadas apenas em memória e não alteram os arquivos originais.
        </footer>
      </main>
    </div>
  );
}
