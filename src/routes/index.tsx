import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { Filters, type FilterState } from "@/components/dashboard/Filters";
import { DetailsPanel } from "@/components/dashboard/DetailsPanel";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FAIXAS_RAIO,
  brl,
  featureAreaKm2,
  freightQueryOptions,
  kg,
  priceForPolygon,
  type PolygonFeature,
} from "@/lib/freight";

const FreightMap = lazy(() =>
  import("@/components/FreightMap").then((m) => ({ default: m.FreightMap })),
);

export const Route = createFileRoute("/")({
  component: Dashboard,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-8 text-sm text-destructive">
      Não foi possível carregar os dados: {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-8 text-sm">Dados não encontrados.</div>,
  head: () => ({
    meta: [
      { title: "Dashboard de Frete — Aricanduva x Suzano" },
      {
        name: "description",
        content:
          "Dashboard interativo das áreas de atendimento e regras de frete das lojas Aricanduva e Suzano, com mapa, faixas de peso e cálculo de preço.",
      },
      { property: "og:title", content: "Dashboard de Frete — Aricanduva x Suzano" },
      {
        property: "og:description",
        content:
          "Mapa interativo das áreas de entrega, faixas de raio e cálculo de frete por faixa de peso.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" },
    ],
  }),
});

const initialFilters: FilterState = {
  loja: "Ambas",
  faixas: [...FAIXAS_RAIO],
  weight: 500,
  priceMin: "",
  priceMax: "",
  search: "",
};

function Dashboard() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const { data, isLoading, error } = useQuery({ ...freightQueryOptions, enabled: hydrated });
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const features = data?.features ?? [];
  const pricing = data?.pricing ?? {};

  const patch = (p: Partial<FilterState>) => setFilters((f) => ({ ...f, ...p }));

  const filtered = useMemo(() => {
    const min = filters.priceMin === "" ? null : Number(filters.priceMin);
    const max = filters.priceMax === "" ? null : Number(filters.priceMax);
    const q = filters.search.trim().toLowerCase();
    return features.filter((f) => {
      const p = f.properties;
      if (filters.loja !== "Ambas" && p.loja !== filters.loja) return false;
      if (p.faixa && !filters.faixas.includes(p.faixa)) return false;
      if (q && !`${p.id} ${p.distrito ?? ""}`.toLowerCase().includes(q)) return false;
      if (min !== null || max !== null) {
        const price = priceForPolygon(pricing, p.id, filters.weight)?.total;
        if (price === undefined) return false;
        if (min !== null && Number.isFinite(min) && price < min) return false;
        if (max !== null && Number.isFinite(max) && price > max) return false;
      }
      return true;
    });
  }, [features, pricing, filters]);

  const stats = useMemo(() => {
    const prices: number[] = [];
    let semRegra = 0;
    let area = 0;
    const bandCounts = new Set<string>();
    for (const f of filtered) {
      const bd = priceForPolygon(pricing, f.properties.id, filters.weight);
      if (bd) {
        prices.push(bd.total);
        const bands = pricing[f.properties.id] ?? [];
        bands.forEach((b) => bandCounts.add(`${b.ws}-${b.we}`));
      } else semRegra++;
      area += featureAreaKm2(f);
    }
    const avg = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null;
    return {
      count: filtered.length,
      min: prices.length ? Math.min(...prices) : null,
      max: prices.length ? Math.max(...prices) : null,
      avg,
      faixasPeso: bandCounts.size,
      area,
      semRegra,
    };
  }, [filtered, pricing, filters.weight]);

  const selected: PolygonFeature | null =
    filtered.find((f) => f.properties.id === selectedId) ??
    features.find((f) => f.properties.id === selectedId) ??
    null;

  const tooltipHtml = (f: PolygonFeature) => {
    const p = f.properties;
    const bd = priceForPolygon(pricing, p.id, filters.weight);
    const esc = (s: string) => s.replace(/[<>&]/g, "");
    const rows = bd
      ? `<div>Faixa de peso: <b>${kg(bd.band.ws ?? 0)} – ${kg(bd.band.we ?? 0)}</b></div>
         <div>Preço base: <b>${brl(bd.base)}</b></div>
         <div>Adicional/kg: <b>${brl(bd.extraPerKg)}</b></div>
         <div>Preço p/ ${kg(filters.weight)}: <b>${brl(bd.total)}</b></div>`
      : `<div style="color:#b91c1c"><b>Regra de frete não encontrada</b></div>`;
    return `<div style="min-width:190px;line-height:1.45">
      <div style="font-weight:600">${esc(p.loja)}</div>
      <div>${esc(p.id)}</div>
      <div>Raio: <b>${p.faixa ?? "—"}</b>${
        p.raioMin !== null && p.raioMax !== null
          ? ` (${p.raioMin / 1000}–${p.raioMax / 1000} km)`
          : ""
      }</div>
      ${rows}
    </div>`;
  };

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-[1600px] px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-xl font-semibold">
                Dashboard de Frete — Aricanduva x Suzano
              </h1>
              <p className="text-xs text-muted-foreground">
                Áreas de atendimento, regras de preço e cálculo por faixa de peso
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Legend color="var(--loja-aricanduva)" label="Aricanduva" />
              <Legend color="var(--loja-suzano)" label="Suzano" />
              {stats.semRegra > 0 ? (
                <Badge variant="destructive">{stats.semRegra} sem regra de frete</Badge>
              ) : null}
            </div>
          </div>
          <div className="mt-4">
            <KpiCards
              items={[
                { label: "Loja selecionada", value: filters.loja },
                { label: "Polígonos", value: String(stats.count) },
                { label: "Menor frete", value: stats.min !== null ? brl(stats.min) : "—", hint: kg(filters.weight) },
                { label: "Maior frete", value: stats.max !== null ? brl(stats.max) : "—", hint: kg(filters.weight) },
                { label: "Frete médio", value: stats.avg !== null ? brl(stats.avg) : "—", hint: kg(filters.weight) },
                { label: "Faixas de peso", value: String(stats.faixasPeso) },
                {
                  label: "Área total",
                  value: `${stats.area.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} km²`,
                  hint: "aprox.",
                },
              ]}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] gap-4 px-4 py-4 lg:grid-cols-[260px_minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Filters
            value={filters}
            onChange={patch}
            onReset={() => setFilters(initialFilters)}
            maxWeight={20000}
          />
          <Card className="gap-2 p-4 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Legenda</span>
            <div className="space-y-1">
              {FAIXAS_RAIO.map((f, i) => (
                <div key={f} className="flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-6 rounded-sm border"
                    style={{
                      backgroundColor: "var(--loja-aricanduva)",
                      opacity: 0.62 - i * 0.09,
                    }}
                  />
                  <span>{f}</span>
                </div>
              ))}
            </div>
            <p>Cor identifica a loja; a intensidade identifica a faixa de raio.</p>
          </Card>
        </div>

        <Card className="h-[70vh] min-h-[420px] overflow-hidden p-0 lg:h-[calc(100vh-14rem)]">
          <Suspense
            fallback={<div className="grid h-full place-items-center text-sm text-muted-foreground">Carregando mapa…</div>}
          >
            {error ? (
              <div className="grid h-full place-items-center p-6 text-sm text-destructive">
                Não foi possível carregar os dados: {(error as Error).message}
              </div>
            ) : isLoading || !hydrated ? (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">
                Carregando áreas e regras de frete…
              </div>
            ) : (
            <FreightMap
              features={filtered}
              selectedId={selectedId}
              onSelect={setSelectedId}
              tooltipHtml={tooltipHtml}
            />
            )}
          </Suspense>
        </Card>

        <div className="lg:max-h-[calc(100vh-14rem)] lg:overflow-auto">
          <DetailsPanel feature={selected} pricing={pricing} weight={filters.weight} />
        </div>
      </div>
    </main>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1">
      <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
