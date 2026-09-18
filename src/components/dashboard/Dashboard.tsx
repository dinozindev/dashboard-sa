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

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import {
  dataset,
  stores as staticStoreRefs,
  STORE_NAMES,
  STORE_REGION,
  storesInRegion,
  tariffFor,
  hasSimulation,
  type Overrides,
} from "@/lib/freight/dataset";
import { availableStoreNames, liveStores, storeRegionOf, useLive } from "@/lib/freight/live";
import { BAND_ORDER } from "@/lib/freight/palette";
import { brl, calcPrice, kg } from "@/lib/freight/pricing";
import { distanceKm, polygonsAtPoint } from "@/lib/freight/geo";
import { HOLIDAYS } from "@/lib/freight/schedule";
import { statePolygonsFor } from "@/lib/freight/state-polygons";
import { SHIPPING_POLICY_DEFINITIONS } from "@/lib/freight/policies";
import type {
  Modality,
  PolygonRecord,
  Region,
  RegionSelection,
  StoreName,
} from "@/lib/freight/types";
import { Legend } from "./Legend";
import { Kpis } from "./Kpis";
import { TariffTable } from "./TariffTable";
import { PriceBreakdownCard } from "./PriceBreakdown";
import { RuleSimulator } from "./RuleSimulator";
import {
  ScheduleGrid,
  ShippingWindowNotice,
  StatusBadge,
  useShippingWindowNotice,
} from "./SchedulePanel";

import { CapacityPanel } from "./CapacityPanel";
import { ComparePanel } from "./ComparePanel";
import { PoliciesPanel } from "./PoliciesPanel";
import { DocksPanel } from "./DocksPanel";
import { PolicyFormPanel } from "./PolicyFormPanel";
import { PolygonSubmissionPanel } from "./PolygonSubmissionPanel";
import { AuditHistoryPanel } from "./AuditHistoryPanel";
import type { ShippingPolicyDraft } from "@/lib/freight/policy-registry";

// Lazy load do mapa (pesado, carrega sob demanda)
const FreightMap = lazy(() => import("./FreightMap"));

/** Abas disponíveis no painel */
const TABS = [
  ["operacao", "Área de Atendimento e Frete"],
  ["politicas", "Políticas de Envio"],
  ["cadastro", "Cadastro de Política de Envio"],
  ["envio", "Envio de Polígonos"],
  ["capacidade", "Capacidade Operacional"],
  ["auditoria", "Histórico de Auditoria"],
] as const;

/** Aba ainda não finalizada, exibida com selo "Em Construção" */
const UNDER_CONSTRUCTION_TABS: readonly string[] = ["capacidade"];

type TabKey = (typeof TABS)[number][0];

/** Perfis de acesso simulados e as abas que cada um enxerga */
const PROFILES = {
  consultor: {
    label: "Consultor",
    tabs: ["operacao", "politicas"] as TabKey[],
  },
  editor: {
    label: "Editor",
    tabs: ["operacao", "politicas", "cadastro", "envio", "capacidade"] as TabKey[],
  },
  auditor: {
    label: "Auditor",
    tabs: ["operacao", "politicas", "cadastro", "envio", "capacidade", "auditoria"] as TabKey[],
  },
} as const;

type ProfileKey = keyof typeof PROFILES;

/**
 * DASHBOARD - Componente principal
 */
/** Nome legível do polígono (padrão Distrito_Faixa_Numero), sem prefixos internos. */
function polygonLabel(rec: { id: string }): string {
  const parts = rec.id.split("|");
  return parts[parts.length - 1] || rec.id;
}

export default function Dashboard() {
  // ============================================================================
  // ESTADO: Abas principais
  // ============================================================================
  
  /** Aba ativa: "operacao" (mapa, tarifas) ou "politicas" (regras) */
  const [tab, setTab] = useState<TabKey>("operacao");
  /** Aviso sobre janela de envio (Saldo Borderô e Retira Imediata) */
  const scheduleNotice = useShippingWindowNotice(false);

  const [editingPolicy, setEditingPolicy] = useState<ShippingPolicyDraft | null>(null);
  /** Sub-aba dentro de "Políticas de Envio": matriz ou docas */
  const [policyTab, setPolicyTab] = useState<"matriz" | "docas">("matriz");

  /** Perfil de acesso simulado (Consultor / Editor / Auditor) */
  const [profile, setProfile] = useState<ProfileKey>("auditor");

  /** Abas permitidas para o perfil atual */
  const allowedTabs = PROFILES[profile].tabs;

  // Se a aba ativa não é permitida no perfil escolhido, volta para a primeira
  useEffect(() => {
    if (!allowedTabs.includes(tab)) setTab(allowedTabs[0] ?? "operacao");
  }, [allowedTabs, tab]);

  // ============================================================================
  // ESTADO: Filtros geográficos
  // ============================================================================
  
  /** Região selecionada: "SP", "RJ", ou "Todas" */
  const [region, setRegion] = useState<RegionSelection>("Todas");
  
  /** Lojas visíveis no mapa (subset dos nomes disponíveis) */
  const [visibleStores, setVisibleStores] = useState<string[]>([...STORE_NAMES]);

  /** Lojas para comparação (modo comparativo) */
  const [compareStores, setCompareStores] = useState<string[]>([]);

  /** Dropdown de lojas está aberto? */
  const [storesOpen, setStoresOpen] = useState(false);

  /** Dropdown de faixas de raio está aberto? */
  const [bandsOpen, setBandsOpen] = useState(false);

  /**
   * Estado compartilhado do banco: lojas, políticas, polígonos, tabelas.
   * Enquanto carrega (live = null), o catálogo estático entra como fallback.
   */
  const live = useLive();

  /** Lojas ativas: as cadastradas no banco (fallback: catálogo estático) */
  const activeStores = useMemo(
    () => (live ? availableStoreNames(live) : []),
    [live],
  );

  /** Polígonos exibidos: banco quando carregado, senão dataset estático */
  const allPolygons = live ? live.polygons : [];

  /** Modalidade escolhida para definir a tabela de frete usada no cálculo */
  const [modalityFilter, setModalityFilter] = useState<string>("todas");

  // Dados derivados: lojas ativas da região atual
  const regionStores = useMemo(
    () =>
      activeStores.filter(
        (s) =>
          region === "Todas" ||
          (live
            ? storeRegionOf(live, s) === region
            : STORE_REGION[s as StoreName] === region),
      ),
    [region, activeStores, live],
  );

  /** UFs presentes nas lojas cadastradas (para o seletor Regional) */
  const availableRegions = useMemo(() => {
    const set = new Set<string>();
    for (const st of liveStores(live)) set.add(st.region);
    for (const p of allPolygons) if (p.uf && /^[A-Z]{2}$/.test(p.uf)) set.add(p.uf);
    if (!set.size) {
      set.add("SP");
      set.add("RJ");
    }
    return Array.from(set).sort();
  }, [live, allPolygons]);

  /** Lojas novas (ex.: recém-enviadas) entram automaticamente como visíveis */
  const knownStoresRef = useRef<string[] | null>(null);
  useEffect(() => {
    const prev = knownStoresRef.current;
    if (prev === null) {
      knownStoresRef.current = activeStores;
      setVisibleStores((cur) => Array.from(new Set([...cur, ...activeStores])));
      return;
    }
    const added = activeStores.filter((s) => !prev.includes(s));
    if (added.length) setVisibleStores((cur) => Array.from(new Set([...cur, ...added])));
    knownStoresRef.current = activeStores;
  }, [activeStores]);

  // Dados derivados: lojas selecionadas E na região
  const shownStores = useMemo(
    () => regionStores.filter((s) => visibleStores.includes(s)),
    [regionStores, visibleStores],
  );

  /**
   * Retira: todas as lojas da região selecionada servem como ponto de retirada,
   * mesmo as que ainda não tiveram polígonos de entrega enviados.
   */
  const pickupStores = useMemo(
    () => regionStores.filter((s) => visibleStores.includes(s)),
    [regionStores, visibleStores],
  );

  const mapMarkers = useMemo(
    () =>
      liveStores(live).map((store) => {
        const storePolygons = (live?.polygons ?? []).filter((polygon) => polygon.store === store.name);
        const radii = storePolygons
          .map((polygon) => polygon.radius)
          .filter((radius): radius is number => Number.isFinite(radius));
        const smallestRadius = radii.length ? Math.min(...radii) : null;
        const basePolygons =
          smallestRadius === null
            ? storePolygons
            : storePolygons.filter((polygon) => polygon.radius === smallestRadius);
        const center = basePolygons.length
          ? [
              basePolygons.reduce((total, polygon) => total + polygon.center[0], 0) /
                basePolygons.length,
              basePolygons.reduce((total, polygon) => total + polygon.center[1], 0) /
                basePolygons.length,
            ] as [number, number]
          : ((store.center ?? [0, 0]) as [number, number]);
        return { name: store.name, note: store.note ?? "", center };
      }),
    [live],
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
    return allPolygons.filter(
      (p) =>
        shownStores.includes(p.store) &&
        // faixas fora da paleta padrão (ex.: arquivo sem "Faixa") continuam visíveis
        (bands.includes(p.band) || !(BAND_ORDER as readonly string[]).includes(p.band)) &&
        (p.kind ?? "Entrega") === modality &&
        (q === "" ||
          p.id.toLowerCase().includes(q) ||
          (p.district ?? "").toLowerCase().includes(q)),
    );
  }, [allPolygons, shownStores, bands, search, modality]);

  /**
   * Tabela de frete da política selecionada (a política define o preço,
   * não quais polígonos aparecem). Null = usa a tabela padrão da loja.
   */
  const policyTariffIdx = useMemo(() => {
    if (!live || policyFilter === "todas" || policyFilter === "sem-politica") return null;
    const tableId = live.tableByPolicy.get(policyFilter);
    if (!tableId) return null;
    return live.tableIndexById.get(tableId) ?? null;
  }, [live, policyFilter]);

  /** Faixas de peso aplicáveis a um polígono, considerando a política escolhida */
  const bandsOf = (rec: PolygonRecord | undefined | null) => {
    if (!rec) return undefined;
    if (policyTariffIdx !== null) {
      const base = dataset.tariffs[policyTariffIdx];
      if (base) return base.map((b, i) => overrides[`${rec.id}#${i}`] ?? b);
    }
    return tariffFor(rec, overrides);
  };

  /**
   * Polígono atualmente selecionado na tabela/simulador.
   * Pode ser null se selectedId não existe ou foi filtrado.
   */
  const selected = useMemo(
    () => visible.find((p) => p.id === selectedId) ?? null,
    [visible, selectedId],
  );
  
  /** Tabela de tarifas do polígono selecionado (com overrides) */
  const selectedBands = bandsOf(selected);
  
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
      const r = calcPrice(bandsOf(p), weight);
      if (r.ok) prices.push(r.total);
    }
    const area = visible.reduce((s, p) => s + p.areaKm2, 0);
    const avg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
    const num = (v: number, d = 0) =>
      v.toLocaleString("pt-BR", { maximumFractionDigits: d });
    return [
      { label: "Polígonos visíveis", value: num(visible.length) },
      { label: "Área coberta", value: `${num(area, 1)} km²` },
      // {
      //   label: "Lojas exibidas",
      //   value:
      //     shownStores.length === 1
      //       ? (shownStores[0] as string)
      //       : `${shownStores.length} lojas`,
      // },
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
  }, [visible, weight, overrides, shownStores, isPickup, policyTariffIdx]);

  /**
   * Gera tooltip HTML para exibir sobre polígono no mapa.
   * Mostra: ID, loja, faixa, município, preço (se Entrega).
   */
  const tooltipFor = (rec: PolygonRecord) => {
    const r = calcPrice(bandsOf(rec), weight);
    return `<strong>${polygonLabel(rec)}</strong><br/>Loja: ${rec.store}<br/>Faixa: ${rec.band} (${rec.rMin}–${rec.rMax} km)<br/>${
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
  // MODALIDADE RETIRA: polígono único por estado + loja mais próxima
  // ============================================================================

  /**
   * UFs exibidas na Retira: seguem o filtro Regional, não as lojas ativas —
   * a área de retira cobre o estado inteiro mesmo onde ainda não há loja
   * com polígonos enviados.
   */
  const pickupUfs = useMemo<Region[]>(
    () => (region === "Todas" ? (availableRegions as Region[]) : [region]),
    [region, availableRegions],
  );

  /** Malhas estaduais dessas UFs — do banco, com o arquivo local como reserva */
  const activeStatePolygons = useMemo(() => {
    if (!isPickup) return [];
    const fromDb = (live?.statePolygons ?? []).filter((s) => pickupUfs.includes(s.uf));
    return fromDb.length ? fromDb : statePolygonsFor(pickupUfs);
  }, [isPickup, pickupUfs, live]);

  /**
   * Ranking de distância entre o ponto clicado e TODAS as lojas exibidas
   * (haversine, em linha reta). A primeira da lista é a mais próxima.
   */
  const pickupRanking = useMemo(() => {
    if (!isPickup || !point) return [];
    const refs = live
      ? liveStores(live).map((s) => ({
          name: s.name,
          note: s.note ?? "",
          region: s.region,
          center: (s.center ?? [0, 0]) as [number, number],
        }))
      : staticStoreRefs.map((s) => ({
          name: s.name,
          note: s.note,
          region: STORE_REGION[s.name],
          center: s.center,
        }));
    return refs
      .filter((s) => pickupStores.includes(s.name))
      .map((s) => ({ ...s, km: distanceKm([point.lng, point.lat], s.center) }))
      .sort((a, b) => a.km - b.km);
  }, [isPickup, point, pickupStores, live]);

  const nearestPickupStore = pickupRanking[0] ?? null;



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
    <div className="min-h-screen bg-surface-subtle">
      <header className="bg-brand-gradient text-white">
        <div className="border-b border-white/15 bg-black/15">
          <div className="mx-auto flex max-w-[1600px] items-center justify-end gap-2 px-4 py-1.5">
            <label
              htmlFor="profile-select"
              className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/70"
            >
              Visualização
            </label>
            <select
              id="profile-select"
              className="rounded-md border border-white/25 bg-white/10 px-2 py-1 text-xs font-semibold text-white outline-none [&>option]:text-foreground"
              value={profile}
              onChange={(e) => setProfile(e.target.value as ProfileKey)}
            >
              {(Object.keys(PROFILES) as ProfileKey[]).map((key) => (
                <option key={key} value={key}>
                  {PROFILES[key].label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 py-6">
          <div className="flex items-center gap-4">
            <span className="bg-accent-gradient flex h-11 w-11 shrink-0 items-center justify-center rounded-lg font-display text-lg font-bold text-white shadow-brand">
              OX
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/70">
                Obramax · Supply Chain
              </p>
              <h1 className="font-display text-2xl font-bold tracking-tight text-white">
                Painel OMS
              </h1>
              <p className="mt-0.5 text-sm text-white/75">
                Áreas de entrega, tarifas por faixa de peso e capacidade operacional 
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 font-semibold text-white/90">
              {visible.length.toLocaleString("pt-BR")} polígonos mapeados
            </span>
            <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 font-semibold text-white/90">
              {activeStores.length} lojas ativas
            </span>
          </div>
        </div>
        <div className="bg-accent-gradient h-1 w-full" />
      </header>

      <main className="mx-auto max-w-[1600px] space-y-4 px-4 py-5">
        <nav className="surface flex flex-wrap items-center gap-1 p-1.5">
          {TABS.filter(([key]) => allowedTabs.includes(key)).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              aria-current={tab === key ? "page" : undefined}
              className={tab === key ? "tab-pill-active" : "tab-pill"}
            >
              {label}
              {UNDER_CONSTRUCTION_TABS.includes(key) && (
                <span className="ml-2 inline-flex items-center rounded-full bg-warning/20 px-2 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-warning-foreground">
                  Em Construção
                </span>
              )}
            </button>
          ))}
        </nav>

        {tab === "politicas" ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["matriz", "Políticas de Envio"],
                  ["docas", "Docas"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPolicyTab(key)}
                  className={
                    "rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors " +
                    (policyTab === key
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-muted/60")
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            {policyTab === "matriz" ? (
              <PoliciesPanel
                canEdit={profile !== "consultor"}
                onEditPolicy={(policy) => {
                  setEditingPolicy(policy);
                  setTab("cadastro");
                }}
              />
            ) : (
              <DocksPanel canEdit={profile !== "consultor"} />
            )}
          </div>
        ) : null}
        {tab === "cadastro" ? (
          <PolicyFormPanel
            initialPolicy={editingPolicy}
            onFinishEdit={() => setEditingPolicy(null)}
          />
        ) : null}
        {tab === "envio" ? (
          <PolygonSubmissionPanel onGoToMap={() => setTab("operacao")} />
        ) : null}
        {tab === "capacidade" ? (
          <section className="space-y-3">
            <div className="surface flex flex-wrap items-center gap-3 border-dashed p-4">
              <span className="rounded-full bg-warning/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-warning-foreground">
                Em Construção
              </span>
              <p className="text-sm text-muted-foreground">
                Módulo de capacidade operacional em desenvolvimento — os valores abaixo servem
                apenas como referência.
              </p>
            </div>
            <div className="surface p-4">
              <h2 className="section-title text-lg">Capacidade operacional</h2>
              <CapacityPanel />
            </div>
          </section>
        ) : null}
        {tab === "auditoria" ? <AuditHistoryPanel /> : null}

        <div className={tab === "operacao" ? "space-y-4" : "hidden"}>
        {/* Filtros */}
        <section className="surface flex flex-wrap items-end gap-3 p-3.5">
          <label className="field-label">
            Regional
            <select
              className="input mt-1 w-32"
              value={region}
              onChange={(e) => {
                const r = e.target.value as RegionSelection;
                setRegion(r);
                setVisibleStores(
                  r === "Todas"
                    ? activeStores
                    : activeStores.filter((st) => (storeRegionOf(live, st) ?? STORE_REGION[st as StoreName]) === r),
                );
                setCompareStores([]);
                setSelectedId(null);
              }}
            >
              <option value="Todas">Todas</option>
              {availableRegions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>

          <div className="field-label relative">
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
                          onChange={() => toggleStore(s as StoreName)}
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

          <div className="field-label relative">
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

          <label className="field-label">
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

          {!isPickup ? (
            <label className="field-label">
              Política de envio (tabela de frete)
              <select
                className="input mt-1 w-56"
                value={policyFilter}
                onChange={(e) => setPolicyFilter(e.target.value)}
              >
                <option value="todas">Tabela padrão da loja</option>
                {(live?.drafts ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.store} · {d.modalities.join(" / ") || d.policyType}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="field-label">
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

          <label className="field-label min-w-52 flex-1">
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
          <div className="overflow-hidden surface">
            <ClientOnly
              fallback={<div className="h-[620px] w-full animate-pulse bg-muted" />}
            >
              <Suspense fallback={<div className="h-[620px] w-full animate-pulse bg-muted" />}>
                <FreightMap
                  visible={isPickup ? [] : visible}
                  selectedId={selectedId}
                  tooltipFor={tooltipFor}
                  onSelect={(rec) => {
                    setSelectedId(rec.id);
                    setBandIndex(null);
                  }}
                  onMapClick={(lng, lat) => setPoint({ lng, lat })}
                  fitKey={`${region}|${(isPickup ? pickupStores : shownStores).join(",")}|${search}|${modality}`}
                  pickupMode={isPickup}
                  statePolygons={activeStatePolygons}
                  markerStores={isPickup ? pickupStores : shownStores}
                  markers={mapMarkers}
                />
              </Suspense>
            </ClientOnly>
          </div>

          <div className="space-y-4">
            <Legend stores={shownStores} />
            <div className="surface p-3">
              <p className="eyebrow mb-2">
                Status de atendimento
              </p>
              <div className="flex flex-wrap gap-2">
                {(mounted ? shownStores : []).map((s) => (
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
            {isPickup ? (
              <>
                {activeStatePolygons.length === 0 ? (
                  <p className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-xs font-medium text-danger">
                    Polígono estadual não carregado. Adicione o contorno oficial de SP/RJ em
                    <code className="mx-1">src/data/state-polygons.json</code>
                    para exibir a área de retira — nenhum contorno é desenhado por aproximação.
                  </p>
                ) : null}
                {nearestPickupStore ? (
                  <div className="surface p-3">
                    <p className="eyebrow mb-2">Loja de retira mais próxima</p>
                    <p className="font-display text-base font-bold text-primary">
                      {nearestPickupStore.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{nearestPickupStore.note}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Distância em linha reta do ponto clicado:{" "}
                      <strong className="tabular-nums">
                        {nearestPickupStore.km.toLocaleString("pt-BR", {
                          maximumFractionDigits: 1,
                        })}{" "}
                        km
                      </strong>
                    </p>
                    <div className="mt-3">
                      <ScheduleGrid store={nearestPickupStore.name} modality="Retira" />
                    </div>
                    {pickupRanking.length > 1 ? (
                      <div className="mt-3 border-t border-border pt-3">
                        <p className="eyebrow mb-2">Distância até as demais lojas</p>
                        <ul className="space-y-1">
                          {pickupRanking.slice(1).map((s) => (
                            <li
                              key={s.name}
                              className="flex items-center justify-between gap-2 text-xs"
                            >
                              <span className="text-muted-foreground">
                                {s.name} <span className="opacity-60">({s.region})</span>
                              </span>
                              <span className="tabular-nums font-medium">
                                {s.km.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
                    Modalidade <strong>Retira</strong>: clique em qualquer ponto do estado para ver
                    a loja de retirada mais próxima e seus horários.
                  </p>
                )}
              </>
            ) : point ? (
              <div className="surface p-3">
                <p className="eyebrow mb-2">
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
        <section className="surface p-4">
          {selected ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="section-title text-lg">{polygonLabel(selected)}</h2>
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
                  activeIndex={bandIndex}
                  onPickBand={setBandIndex}
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
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <span className="bg-accent-gradient flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold text-white shadow-brand">
                ↖
              </span>
              <p className="font-display text-sm font-bold text-primary">
                Nenhum polígono selecionado
              </p>
              <p className="max-w-md text-xs text-muted-foreground">
                Selecione um polígono no mapa para ver a tabela de faixas de peso, a composição do
                preço e o simulador de regras.
              </p>
            </div>
          )}
        </section>

        {/* Horários e capacidade */}
        <section className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-3 surface p-4">
            <div className="flex items-start justify-between gap-2">
              <h2 className="section-title text-lg">Horários de atendimento</h2>
              <button
                type="button"
                className="btn-ghost text-xs"
                onClick={() => scheduleNotice.setOpen(true)}
              >
                ⓘ Janela de envio
              </button>
            </div>
            <ShippingWindowNotice
              open={scheduleNotice.open}
              onClose={() => scheduleNotice.setOpen(false)}
            />
            {shownStores.map((s) => (
              <ScheduleGrid key={s} store={s} modality={modality} />
            ))}
          </div>

        </section>
        </div>


        {/* <footer className="pb-8 text-[11px] text-muted-foreground">
          Fonte: GeoJSON de polígonos + planilha de frete (associação Nome_Poligono ↔ PolygonName).
          Simulações de faixas são aplicadas apenas em memória e não alteram os arquivos originais.
        </footer> */}
      </main>
    </div>
  );
}
