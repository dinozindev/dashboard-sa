/**
 * DASHBOARD INTERATIVO DE FRETE
 * ==============================
 * 
 * Componente raiz que orquestra toda a aplicação.
 * 
 * Responsabilidades:
 * - Gerenciar state global (região, lojas, peso, modalidade, etc)
 * - Coordenar sub-componentes (mapa, tabelas, simulador)
 * - Sincronizar interações entre componentes
 * - Calcular dados derivados (visible, kpis, etc)
 * 
 * Arquitetura:
 *   [State] → [useMemo derivations] → [Componentes] → [Events] → [setState]
 */

import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import {
  polygons,
  STORE_NAMES,
  OPS_STORES,
  storesInRegion,
  tariffFor,
  hasSimulation,
  type Overrides,
} from "@/lib/freight/dataset";
import { BAND_ORDER } from "@/lib/freight/palette";
import { brl, calcPrice, kg } from "@/lib/freight/pricing";
import { polygonsAtPoint } from "@/lib/freight/geo";
import { HOLIDAYS } from "@/lib/freight/schedule";
import type { Modality, PolygonRecord, RegionSelection, StoreName } from "@/lib/freight/types";
import { Legend } from "./Legend";
import { Kpis } from "./Kpis";
import { TariffTable } from "./TariffTable";
import { PriceBreakdownCard } from "./PriceBreakdown";
import { RuleSimulator } from "./RuleSimulator";
import { ScheduleGrid, StatusBadge } from "./SchedulePanel";
import { CapacityPanel } from "./CapacityPanel";
import { ComparePanel } from "./ComparePanel";
import { PoliciesPanel } from "./PoliciesPanel";
import { PolicyFormPanel } from "./PolicyFormPanel";

// Lazy load do mapa (pesado, carrega sob demanda)
const FreightMap = lazy(() => import("./FreightMap"));

/**
 * DASHBOARD - Componente principal
 */
export default function Dashboard() {
  // ============================================================================
  // ESTADO: Abas principais
  // ============================================================================
  
  /** Aba ativa: "operacao" (mapa, tarifas) ou "politicas" (regras) */
  const [tab, setTab] = useState<"operacao" | "politicas" | "cadastro">("operacao");

  // ============================================================================
  // ESTADO: Filtros geográficos
  // ============================================================================
  
  /** Região selecionada: "SP", "RJ", ou "Todas" */
  const [region, setRegion] = useState<RegionSelection>("Todas");
  
  /** Lojas visíveis no mapa (subset de STORE_NAMES) */
  const [visibleStores, setVisibleStores] = useState<StoreName[]>([...STORE_NAMES]);
  
  /** Lojas para comparação (modo comparativo) */
  const [compareStores, setCompareStores] = useState<StoreName[]>([]);
  
  /** Dropdown de lojas está aberto? */
  const [storesOpen, setStoresOpen] = useState(false);

  /** Dropdown de faixas de raio está aberto? */
  const [bandsOpen, setBandsOpen] = useState(false);

  // Dados derivados: lojas da região atual
  const regionStores = useMemo(() => storesInRegion(region), [region]);
  
  // Dados derivados: lojas selecionadas E na região
  const shownStores = useMemo(
    () => regionStores.filter((s) => visibleStores.includes(s)),
    [regionStores, visibleStores],
  );

  // ============================================================================
  // ESTADO: Filtros de conteúdo
  // ============================================================================
  
  /** Bandas de peso visíveis no mapa (filtro de visualização) */
  const [bands, setBands] = useState<string[]>([...BAND_ORDER]);
  
  /** Texto de busca por ID ou município */
  const [search, setSearch] = useState("");

  // ============================================================================
  // ESTADO: Simulação de preço
  // ============================================================================
  
  /** Peso para cálculo de preço (kg, padrão: 10) */
  const [weight, setWeight] = useState(10);
  
  /** Modalidade: "Entrega" (despache) ou "Retira" (retirada) */
  const [modality, setModality] = useState<Modality>("Entrega");
  
  /** ID do polígono selecionado (null = nenhum selecionado) */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  /** Index da banda selecionada no simulador (null = nenhuma) */
  const [bandIndex, setBandIndex] = useState<number | null>(null);
  
  /** Overrides de preço (simulação): { "id#bandIndex": WeightBand } */
  const [overrides, setOverrides] = useState<Overrides>({});

  // ============================================================================
  // ESTADO: Interação com mapa
  // ============================================================================
  
  /** Ponto clicado no mapa [lng, lat] (null = nenhum) */
  const [point, setPoint] = useState<{ lng: number; lat: number } | null>(null);
  
  /** Data/hora atual para cálculos (simulação de tempo) */
  const [now, setNow] = useState<Date>(() => new Date("2026-01-01T00:00:00Z"));
  
  /** Só renderiza status dependentes de horário após montar (evita mismatch SSR) */
  const [mounted, setMounted] = useState(false);

  // Inicializa com horário real ao carregar
  useEffect(() => {
    setNow(new Date());
    setMounted(true);
  }, []);
  
  // Flag: modalidade é retira (útil para filtros condicionais)
  const isPickup = modality === "Retira";

  // ============================================================================
  // ESTADO DERIVADO: Filtragem de polígonos
  // ============================================================================
  
  /**
   * Polígonos visíveis após aplicar todos os filtros:
   * - Loja está em shownStores
   * - Banda está em bands[]
   * - ID ou distrito contém search text
   */
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return polygons.filter(
      (p) =>
        shownStores.includes(p.store) &&
        bands.includes(p.band) &&
        (q === "" ||
          p.id.toLowerCase().includes(q) ||
          (p.district ?? "").toLowerCase().includes(q)),
    );
  }, [shownStores, bands, search]);

  /**
   * Polígono atualmente selecionado na tabela/simulador.
   * Pode ser null se selectedId não existe ou foi filtrado.
   */
  const selected = useMemo(
    () => visible.find((p) => p.id === selectedId) ?? null,
    [visible, selectedId],
  );
  
  /** Tabela de tarifas do polígono selecionado (com overrides) */
  const selectedBands = tariffFor(selected, overrides);
  
  /** Resultado do cálculo de preço para o polígono selecionado + peso atual */
  const selectedPrice = calcPrice(selectedBands, weight);

  /**
   * KPIs exibidos no dashboard (estatísticas dos polígonos visíveis).
   * 
   * Inclui:
   * - Contagem de polígonos
   * - Área total coberta
   * - Número de lojas exibidas
   * - Peso simulado
   * - Polígonos sem tabela de frete
   * - (Se Entrega) Preço mínimo, máximo, médio
   */
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
        value:
          shownStores.length === 1
            ? (shownStores[0] as string)
            : `${shownStores.length} lojas`,
      },
      { label: "Peso simulado", value: kg(weight) },
      {
        label: "Polígonos sem tabela",
        value: num(visible.filter((p) => p.tariff === null).length),
      },
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
  }, [visible, weight, overrides, shownStores, isPickup]);

  /**
   * Gera tooltip HTML para exibir sobre polígono no mapa.
   * Mostra: ID, loja, faixa, município, preço (se Entrega).
   */
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

  /**
   * Polígonos contendo o ponto clicado no mapa.
   * Pode ter mais de um se se sobrepõem.
   */
  const allMatches = point ? polygonsAtPoint(point.lng, point.lat, visible) : [];
  
  /** Se compareStores definidos, filtra matches a apenas aquelas lojas. */
  const matches =
    compareStores.length > 0
      ? allMatches.filter((m) => compareStores.includes(m.store))
      : allMatches;

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  /**
   * Toggle visibilidade de uma loja no mapa.
   * Deseleciona loja se removeríamos a última visível.
   */
  const toggleStore = (s: StoreName) =>
    setVisibleStores((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  
  /**
   * Toggle loja para modo de comparação.
   * Se compara com ponto clicado.
   */
  // const toggleCompare = (s: StoreName) =>
  //   setCompareStores((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  /**
   * Toggle banda de peso (0-5kg, 5-10kg, etc) na visualização.
   */
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
            Áreas de entrega, tarifas por faixa de peso e capacidade operacional — Aricanduva,
            Suzano, Mooca, Praia Grande e Piracicaba (as três últimas ainda sem tabela de frete).
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-4 px-4 py-4">
        <nav className="flex gap-1 rounded-xl border border-border bg-card p-1 shadow-sm">
          {([
            ["operacao", "Operação e frete"],
            ["politicas", "Políticas de Envio"],
            ["cadastro", "Cadastro de Política de Envio"],
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
        {tab === "cadastro" ? <PolicyFormPanel /> : null}

        <div className={tab === "operacao" ? "space-y-4" : "hidden"}>
        {/* Filtros */}
        <section className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
          <label className="text-xs text-muted-foreground">
            Regional
            <select
              className="input mt-1 w-32"
              value={region}
              onChange={(e) => {
                const r = e.target.value as RegionSelection;
                setRegion(r);
                setVisibleStores(storesInRegion(r));
                setCompareStores([]);
                setSelectedId(null);
              }}
            >
              <option value="Todas">Todas</option>
              <option value="SP">SP</option>
              <option value="RJ">RJ</option>
            </select>
          </label>

          <div className="relative text-xs text-muted-foreground">
            Lojas
            <button
              className="input mt-1 flex w-56 items-center justify-between gap-2 text-left"
              onClick={() => setStoresOpen((v) => !v)}
            >
              <span className="truncate text-foreground">
                {shownStores.length === 0
                  ? "Nenhuma loja"
                  : shownStores.length === regionStores.length
                    ? `Todas as lojas (${regionStores.length})`
                    : shownStores.length === 1
                      ? shownStores[0]
                      : `${shownStores.length} lojas selecionadas`}
              </span>
              <span aria-hidden>▾</span>
            </button>
            {storesOpen ? (
              <div className="absolute left-0 top-full z-[1200] mt-1 w-72 rounded-xl border border-border bg-card p-2 shadow-lg">
                <div className="mb-1 flex items-center justify-between gap-2 px-1">
                  <span className="text-[11px]">Exibir</span>
                  <span className="flex gap-1">
                    <button
                      className="btn-ghost text-[11px]"
                      onClick={() => setVisibleStores(regionStores)}
                    >
                      Todas
                    </button>
                    <button className="btn-ghost text-[11px]" onClick={() => setVisibleStores([])}>
                      Nenhuma
                    </button>
                  </span>
                </div>
                <div className="max-h-64 space-y-0.5 overflow-y-auto">
                  {regionStores.map((s) => (
                    <div
                      key={s}
                      className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1 hover:bg-muted"
                    >
                      <label className="flex flex-1 items-center gap-2 text-xs text-foreground">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 accent-primary"
                          checked={visibleStores.includes(s)}
                          onChange={() => toggleStore(s)}
                        />
                        {s}
                      </label>
                      {/* <label className="flex items-center gap-1 text-[10px]">
                        <input
                          type="checkbox"
                          className="h-3 w-3 accent-primary"
                          checked={compareStores.includes(s)}
                          onChange={() => toggleCompare(s)}
                        />
                        comparar
                      </label> */}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="relative text-xs text-muted-foreground">
            Faixas de raio
            <button
              className="input mt-1 flex w-56 items-center justify-between gap-2 text-left"
              onClick={() => setBandsOpen((v) => !v)}
            >
              <span className="truncate text-foreground">
                {bands.length === 0
                  ? "Nenhuma faixa"
                  : bands.length === BAND_ORDER.length
                    ? `Todas as faixas (${BAND_ORDER.length})`
                    : `${bands.length} faixas selecionadas`}
              </span>
              <span aria-hidden>▾</span>
            </button>
            {bandsOpen ? (
              <div className="absolute left-0 top-full z-[1200] mt-1 w-72 rounded-xl border border-border bg-card p-2 shadow-lg">
                <div className="mb-1 flex items-center justify-between gap-2 px-1">
                  <span className="text-[11px]">Exibir faixas</span>
                  <span className="flex gap-1">
                    <button className="btn-ghost text-[11px]" onClick={() => setBands([...BAND_ORDER])}>
                      Todas
                    </button>
                    <button className="btn-ghost text-[11px]" onClick={() => setBands([])}>
                      Nenhuma
                    </button>
                  </span>
                </div>
                <div className="max-h-64 space-y-0.5 overflow-y-auto">
                  {BAND_ORDER.map((b) => (
                    <label
                      key={b}
                      className="flex items-center gap-2 rounded-md px-1.5 py-1 text-xs text-foreground hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-primary"
                        checked={bands.includes(b)}
                        onChange={() => toggleBand(b)}
                      />
                      {b}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
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
              setRegion("Todas");
              setVisibleStores([...STORE_NAMES]);
              setCompareStores([]);
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
                  fitKey={`${region}|${shownStores.join(",")}|${search}`}
                />
              </Suspense>
            </ClientOnly>
          </div>

          <div className="space-y-4">
            <Legend stores={shownStores} />
            <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Status de atendimento
              </p>
              <div className="flex flex-wrap gap-2">
                {(mounted ? OPS_STORES.filter((s) => shownStores.includes(s)) : []).map((s) => (
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
            {OPS_STORES.map((s) => (
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
