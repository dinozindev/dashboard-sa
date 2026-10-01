/**
 * CAPACIDADE OPERACIONAL
 * ======================
 *
 * Lista todas as lojas cadastradas, com a ocupação do dia e acesso ao detalhe
 * de cada loja (acompanhamento até D+3) e ao menu de configuração.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getCapacityOverview,
  saveCapacityConfig,
  setCapacityConsumption,
  setCapacityStatus,
  COMMERCIAL_POLICIES,
  PRIMARY_POLICY,
  CAPACITY_HORIZON_DAYS,
  CAPACITY_HISTORY_DAYS,
  WEEKDAYS,
  EMPTY_LIMITS,
  DEFAULT_LIMITS,
  normalizeLimits,
  weekdayKeyOf,
  type CapacityLimits,
  type CapacityStoreDto,
  type CommercialPolicy,
} from "@/lib/freight/capacity-remote.functions";
import {
  DAY_LABELS,
  formatDay,
  isoDay,
  projectStore,
  weekdayName,
  type StoreProjection,
} from "@/lib/freight/capacity-model";

const pct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`;

function barTone(u: number) {
  return u >= 100 ? "bg-danger" : u >= 85 ? "bg-warning" : "bg-success";
}
function textTone(u: number) {
  return u >= 100 ? "text-danger" : u >= 85 ? "text-warning-foreground" : "text-success";
}

function UsageBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={"h-full rounded-full " + barTone(value)}
        style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
      />
    </div>
  );
}

/** Gráfico de barras: número de lojas que excederam a capacidade por dia. */
function ExceededChart({
  series,
}: {
  series: Array<{
    day: string;
    date: Date;
    stores: Array<{ storeId: string; store: string; region: string; used: number; capacity: number }>;
  }>;
}) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const max = Math.max(1, ...series.map((s) => s.stores.length));
  const selected = series.find((s) => s.day === selectedDay) ?? null;
  const showLabel = (i: number) =>
    series.length <= 7 || (series.length <= 14 && i % 2 === 0) || i % 5 === 0;

  return (
    <div className="mt-4">
      <div className="flex h-52 gap-3">
        {/* Eixo Y */}
        <div className="flex w-8 shrink-0 flex-col justify-between pb-px text-right text-[10px] tabular-nums text-muted-foreground">
          <span>{max}</span>
          <span>{max >= 2 ? Math.round(max / 2) : ""}</span>
          <span>0</span>
        </div>
        <div className="relative min-w-0 flex-1">
          {/* Linhas de grade */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex h-full flex-col justify-between">
            <span className="border-t border-border/60" />
            <span className="border-t border-border/60" />
            <span className="border-t border-border" />
          </div>
          <div className="relative flex h-full items-end gap-1.5">
            {series.map((s) => {
              const count = s.stores.length;
              const h = Math.max((count / max) * 100, 7);
              const isSelected = selectedDay === s.day;
              return (
                <button
                  key={s.day}
                  type="button"
                  className="group relative flex h-full min-w-0 flex-1 cursor-pointer items-end border-0 bg-transparent p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  aria-label={`${formatDay(s.date)}: ${count} loja(s) excederam a capacidade`}
                  aria-pressed={isSelected}
                  title={`${formatDay(s.date)} · ${count} loja(s) excederam a capacidade`}
                  onClick={() => setSelectedDay(isSelected ? null : s.day)}
                >
                  <div
                    className={`flex w-full items-center justify-center rounded-t-md text-xs font-bold text-chart-2 transition-colors group-hover:bg-chart-2/40 ${isSelected ? "bg-chart-2/50" : "bg-chart-2/25"}`}
                    style={{ height: `${h}%`, minHeight: "1.375rem" }}
                  >
                    <span className="tabular-nums">{count}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {/* Rótulos dos dias */}
      <div className="mt-1.5 flex gap-3">
        <div className="w-8 shrink-0" />
        <div className="flex min-w-0 flex-1 gap-1.5">
          {series.map((s, i) => (
            <span
              key={s.day}
              className="min-w-0 flex-1 truncate text-center text-[10px] tabular-nums text-muted-foreground"
            >
              {showLabel(i) ? formatDay(s.date) : ""}
            </span>
          ))}
        </div>
      </div>
      {selected ? (
        <div className="mt-4 border-t border-border pt-3">
          <h4 className="text-sm font-bold">
            Lojas que excederam em {formatDay(selected.date)} ({selected.stores.length})
          </h4>
          {selected.stores.length ? (
            <ul className="mt-2 divide-y divide-border text-sm">
              {selected.stores.map((store) => (
                <li key={store.storeId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <span className="font-medium">{store.store}</span>
                    {store.region ? (
                      <span className="ml-2 text-xs text-muted-foreground">{store.region}</span>
                    ) : null}
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {store.used} / {store.capacity} pedidos
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Nenhuma loja excedeu a capacidade neste dia.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function CapacityPanel() {
  const load = useServerFn(getCapacityOverview);
  const saveStatus = useServerFn(setCapacityStatus);
  const saveConfig = useServerFn(saveCapacityConfig);
  const saveConsumption = useServerFn(setCapacityConsumption);

  const [rows, setRows] = useState<CapacityStoreDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todas" | "active" | "paused">("todas");
  const [regionFilter, setRegionFilter] = useState("todas");
  const [selected, setSelected] = useState<string[]>([]);
  const [openStore, setOpenStore] = useState<string | null>(null);
  const [configStore, setConfigStore] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [chartDays, setChartDays] = useState(7);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const res = await load({});
      setRows(res.stores);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar a capacidade.");
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const projections = useMemo(() => rows.map((r) => projectStore(r)), [rows]);
  const regions = useMemo(
    () =>
      [...new Set(projections.map((p) => p.region).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
    [projections],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projections.filter((p) => {
      if (statusFilter !== "todas" && p.status !== statusFilter) return false;
      if (regionFilter !== "todas" && p.region !== regionFilter) return false;
      if (!q) return true;
      return p.store.toLowerCase().includes(q) || p.region.toLowerCase().includes(q);
    });
  }, [projections, search, statusFilter, regionFilter]);

  const totals = useMemo(
    () => ({
      all: projections.length,
      active: projections.filter((p) => p.status === "active").length,
      paused: projections.filter((p) => p.status === "paused").length,
      exceeded: projections.filter((p) => p.exceeded || p.todayUtilization >= 100).length,
    }),
    [projections],
  );

  // Histórico: para cada dia passado, quantas lojas excederam a capacidade.
  const exceededSeries = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const out: Array<{
      day: string;
      date: Date;
      stores: Array<{ storeId: string; store: string; region: string; used: number; capacity: number }>;
    }> = [];
    for (let i = CAPACITY_HISTORY_DAYS - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const stores = [];
      for (const r of rows) {
        // Conta apenas o próprio dia (D+0), não o horizonte D+3 inteiro.
        const day0 = projectStore(r, d).totals[0];
        if (day0 && day0.capacity > 0 && day0.used >= day0.capacity) {
          stores.push({
            storeId: r.storeId,
            store: r.store,
            region: r.region,
            used: day0.used,
            capacity: day0.capacity,
          });
        }
      }
      out.push({ day: isoDay(d), date: d, stores });
    }
    return out;
  }, [rows]);

  async function applyStatus(storeIds: string[], status: "active" | "paused") {
    if (!storeIds.length) return;
    setBusy(true);
    try {
      await saveStatus({ data: { storeIds, status } });
      await refresh();
      setSelected([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao alterar o status.");
    } finally {
      setBusy(false);
    }
  }

  const detail = projections.find((p) => p.storeId === openStore) ?? null;
  const detailDto = rows.find((r) => r.storeId === openStore) ?? null;
  const configDto = rows.find((r) => r.storeId === configStore) ?? null;

  if (loading) {
    return <p className="text-sm text-muted-foreground">Carregando capacidade das lojas…</p>;
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {/* Visão geral + gráfico de excedentes */}
      <div className="grid gap-3 lg:grid-cols-[13rem_1fr]">
        <div className="flex flex-col gap-3">
          {[
            ["Total de lojas", totals.all, "text-foreground"],
            ["Ativas", totals.active, "text-success"],
            ["Pausadas", totals.paused, "text-muted-foreground"],
          ].map(([label, value, tone]) => (
            <div key={String(label)} className="surface flex-1 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className={`font-display text-3xl font-bold ${tone}`}>{value as number}</p>
            </div>
          ))}
        </div>
        <div className="surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="section-title text-sm">
              Número de lojas que excederam a capacidade
            </h3>
            <select
              className="input w-auto text-xs"
              aria-label="Período do gráfico"
              value={chartDays}
              onChange={(e) => setChartDays(Number(e.target.value))}
            >
              <option value={7}>Últimos: 7 dias</option>
              <option value={14}>Últimos: 14 dias</option>
              <option value={30}>Últimos: 30 dias</option>
            </select>
          </div>
          <ExceededChart series={exceededSeries.slice(-chartDays)} />
        </div>
      </div>

      {/* Filtros e ações em lote */}
      <div className="surface flex flex-wrap items-end gap-3 p-4">
        <label className="field-label min-w-0 flex-1">
          Buscar loja
          <input
            className="input mt-1 w-full min-w-0"
            placeholder="Nome da loja ou estado"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label className="field-label">
          Status
          <select
            className="input mt-1"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          >
            <option value="todas">Todas</option>
            <option value="active">Ativas</option>
            <option value="paused">Pausadas</option>
          </select>
        </label>
        <label className="field-label">
          Estado
          <select
            className="input mt-1"
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
          >
            <option value="todas">Todos</option>
            {regions.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <button
            className="btn-ghost text-xs"
            disabled={!selected.length || busy}
            onClick={() => applyStatus(selected, "active")}
          >
            Ativar selecionadas
          </button>
          <button
            className="btn-ghost text-xs"
            disabled={!selected.length || busy}
            onClick={() => applyStatus(selected, "paused")}
          >
            Pausar selecionadas
          </button>
        </div>
      </div>

      {/* Listagem das lojas */}
      <div className="surface overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-10 p-3">
                <input
                  type="checkbox"
                  aria-label="Selecionar todas"
                  checked={filtered.length > 0 && selected.length === filtered.length}
                  onChange={(e) =>
                    setSelected(e.target.checked ? filtered.map((f) => f.storeId) : [])
                  }
                />
              </th>
              <th className="p-3">Loja</th>
              <th className="p-3">Segmentação</th>
              <th className="p-3 w-64">Capacidade utilizada (hoje)</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.storeId} className="border-t border-border">
                <td className="p-3">
                  <input
                    type="checkbox"
                    aria-label={`Selecionar ${p.store}`}
                    checked={selected.includes(p.storeId)}
                    onChange={(e) =>
                      setSelected((prev) =>
                        e.target.checked
                          ? [...prev, p.storeId]
                          : prev.filter((id) => id !== p.storeId),
                      )
                    }
                  />
                </td>
                <td className="p-3">
                  <button
                    className="text-left font-medium text-primary hover:underline"
                    onClick={() => setOpenStore(p.storeId)}
                  >
                    {p.store}
                  </button>
                  <span className="ml-2 text-xs text-muted-foreground">{p.region}</span>
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {p.policies.map((pol) => (
                      <span
                        key={pol.policy}
                        className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium"
                      >
                        {pol.policy}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="p-3">
                  {p.unlimited ? (
                    <span className="text-xs text-muted-foreground">Capacidade ilimitada</span>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-xs font-bold tabular-nums ${textTone(p.todayUtilization)}`}>
                          {pct(p.todayUtilization)}
                        </span>
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          {p.totals[0]!.used} / {p.totals[0]!.capacity} pedidos
                        </span>
                        {p.todayUtilization >= 100 ? <span title="Capacidade atingida">⚠️</span> : null}
                      </div>
                      <UsageBar value={p.todayUtilization} />
                    </div>
                  )}
                </td>
                <td className="p-3">
                  <button
                    className={p.status === "active" ? "badge-open" : "badge-closed"}
                    disabled={busy}
                    onClick={() =>
                      applyStatus([p.storeId], p.status === "active" ? "paused" : "active")
                    }
                  >
                    {p.status === "active" ? "Ativo" : "Pausado"}
                  </button>
                </td>
              </tr>
            ))}
            {!filtered.length ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-sm text-muted-foreground">
                  Nenhuma loja encontrada com os filtros atuais.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {detail && detailDto ? (
        <StoreDetail
          projection={detail}
          dto={detailDto}
          busy={busy}
          onClose={() => setOpenStore(null)}
          onConfigure={() => setConfigStore(detail.storeId)}
          onStatus={(s) => applyStatus([detail.storeId], s)}
          onConsumption={async (policy, day, orders) => {
            setBusy(true);
            try {
              await saveConsumption({ data: { storeId: detail.storeId, policy, day, orders } });
              await refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Falha ao registrar pedidos.");
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}

      {configDto ? (
        <ConfigDialog
          dto={configDto}
          onClose={() => setConfigStore(null)}
          onSave={async (payload) => {
            setBusy(true);
            try {
              await saveConfig({ data: { storeId: configDto.storeId, ...payload } });
              await refresh();
              setConfigStore(null);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Falha ao salvar a configuração.");
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Detalhe da loja — acompanhamento até D+3                            */
/* ------------------------------------------------------------------ */

function CapacityStatusChart({ projection }: { projection: StoreProjection }) {
  const days = projection.totals;
  const hasLimit = !projection.unlimited;
  const peak = Math.max(100, ...days.map((day) => day.utilization));
  const scale = Math.max(120, Math.ceil(peak / 20) * 20);
  const limitPosition = `${(100 / scale) * 100}%`;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h4 className="text-sm font-bold">Status da capacidade operacional</h4>
        <span className="text-xs text-muted-foreground">Hoje até D+3</span>
      </div>
      <div className="overflow-x-auto rounded-md border border-border">
        <div className="relative min-w-[560px] bg-secondary/40">
          <div className="grid grid-cols-4 border-b border-border/60">
            {days.map((day, i) => (
              <div
                key={day.day}
                className="border-r border-border/60 px-2 py-3 text-center last:border-r-0"
              >
                <span className="block text-xs font-semibold tabular-nums">{formatDay(day.date)}</span>
                <span className="block text-[11px] text-muted-foreground">{DAY_LABELS[i]}</span>
              </div>
            ))}
          </div>
          <div className="relative grid h-64 grid-cols-4">
            {hasLimit ? (
              <div
                className="pointer-events-none absolute inset-x-0 z-20 border-t border-dashed border-muted-foreground/80"
                style={{ bottom: limitPosition }}
              >
                <span className="absolute -top-3 left-2 bg-muted px-2 py-1 text-[11px] leading-none text-foreground">
                  Limite de 100%
                </span>
              </div>
            ) : null}
            {days.map((day) => {
              const finiteCapacity = Number.isFinite(day.capacity);
              const percentage = finiteCapacity && day.capacity > 0 ? day.utilization : 0;
              const fillHeight = Math.min(100, (percentage / scale) * 100);
              return (
                <div key={day.day} className="relative min-w-0 border-r border-border/60 last:border-r-0">
                  {fillHeight > 0 ? (
                    <div
                      className={`absolute inset-x-0 bottom-0 ${percentage >= 100 ? "bg-warning/30" : "bg-chart-1/15"}`}
                      style={{ height: `${fillHeight}%` }}
                    />
                  ) : null}
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-0.5 px-1 text-center">
                    <span className={`text-xl font-semibold tabular-nums ${percentage >= 100 ? "text-warning-foreground" : "text-foreground"}`}>
                      {finiteCapacity ? pct(day.utilization) : "∞"}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {day.used}/{finiteCapacity ? day.capacity : "∞"} pedidos
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function StoreDetail({
  projection,
  dto,
  busy,
  onClose,
  onConfigure,
  onStatus,
  onConsumption,
}: {
  projection: StoreProjection;
  dto: CapacityStoreDto;
  busy: boolean;
  onClose: () => void;
  onConfigure: () => void;
  onStatus: (status: "active" | "paused") => void;
  onConsumption: (policy: string, day: string, orders: number) => void;
}) {
  const consumptionOf = (policy: string, day: string) =>
    dto.consumption.find((c) => c.policy === policy && c.day === day)?.orders ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="surface w-full max-w-4xl space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="section-title text-xl">{projection.store}</h3>
            <p className="text-xs text-muted-foreground">
              {projection.region} · Unidade: quantidade de pedidos · Horizonte fixo D+
              {CAPACITY_HORIZON_DAYS}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className={projection.status === "active" ? "badge-open" : "badge-closed"}
              disabled={busy}
              onClick={() => onStatus(projection.status === "active" ? "paused" : "active")}
            >
              {projection.status === "active" ? "Ativo" : "Pausado"}
            </button>
            <button className="btn-ghost text-xs" onClick={onConfigure}>
              Configurar capacidade
            </button>
            <button className="btn-ghost text-xs" onClick={onClose}>
              Fechar
            </button>
          </div>
        </div>

        {projection.status === "paused" ? (
          <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-xs text-danger">
            Loja pausada: não recebe novos pedidos até ser reativada, mesmo com a regra de
            transbordo configurada.
          </div>
        ) : null}

        <CapacityStatusChart projection={projection} />

        {/* Detalhamento dos pedidos por dia */}
        <div>
          <h4 className="mb-2 text-sm font-bold">Detalhamento por dia</h4>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {projection.totals.map((d, i) => (
              <div key={d.day} className="rounded-xl border border-border p-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide">{DAY_LABELS[i]}</span>
                  <span className="text-[11px] text-muted-foreground">{formatDay(d.date)}</span>
                </div>
                <p className="text-[11px] capitalize text-muted-foreground">{weekdayName(d.date)}</p>
                <p className={`mt-1 font-display text-2xl font-bold ${textTone(d.utilization)}`}>
                  {pct(d.utilization)}
                </p>
                <UsageBar value={d.utilization} />
                <dl className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                  <div className="flex justify-between">
                    <dt>Capacidade</dt>
                    <dd className="tabular-nums">{d.capacity} pedidos</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Pedidos do dia</dt>
                    <dd className="tabular-nums">{d.own}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Vindos de dias anteriores</dt>
                    <dd className="tabular-nums">{d.carried}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Disponível</dt>
                    <dd className="tabular-nums">{d.remaining}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </div>

        {/* Detalhe por política comercial */}
        <div className="space-y-3">
          <h4 className="text-sm font-bold">Capacidade por política comercial</h4>
          {projection.policies.map((p) => (
            <div key={p.policy} className="rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  {p.policy}
                  {p.policy === PRIMARY_POLICY ? (
                    <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                      Principal
                    </span>
                  ) : null}
                </span>
                {p.unallocated > 0 ? (
                  <span className="text-xs font-medium text-danger">
                    ⚠️ {p.unallocated} pedido(s) sem espaço até D+{CAPACITY_HORIZON_DAYS}
                  </span>
                ) : null}
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {p.days.map((d, i) => (
                  <div key={d.day} className="rounded-lg bg-muted/40 p-2">
                    <div className="flex items-baseline justify-between text-[11px]">
                      <span className="font-bold">{DAY_LABELS[i]}</span>
                      <span className="text-muted-foreground">{formatDay(d.date)}</span>
                    </div>
                    <p className={`text-sm font-bold tabular-nums ${textTone(d.utilization)}`}>
                      {d.used} / {Number.isFinite(d.capacity) ? d.capacity : "∞"}
                    </p>
                    <UsageBar value={d.utilization} />
                    <label className="field-label mt-2 block text-[10px]">
                      Pedidos recebidos
                      <input
                        type="number"
                        min={0}
                        className="input mt-1 w-full min-w-0"
                        defaultValue={consumptionOf(p.policy, d.day)}
                        disabled={busy}
                        onBlur={(e) => {
                          const v = Math.max(0, Number(e.target.value) || 0);
                          if (v !== consumptionOf(p.policy, d.day)) {
                            onConsumption(p.policy, d.day, v);
                          }
                        }}
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Menu de configuração da loja                                        */
/* ------------------------------------------------------------------ */

interface ConfigPolicyState {
  policy: CommercialPolicy;
  enabled: boolean;
  limits: CapacityLimits;
}

function ConfigDialog({
  dto,
  onClose,
  onSave,
}: {
  dto: CapacityStoreDto;
  onClose: () => void;
  onSave: (payload: {
    unlimited: boolean;
    overflowRule: "continue_next_days" | "pause_until_end_of_day";
    policies: ConfigPolicyState[];
  }) => void;
}) {
  const [unlimited, setUnlimited] = useState(dto.unlimited);
  const [rule, setRule] = useState(dto.overflowRule);
  const [policies, setPolicies] = useState<ConfigPolicyState[]>(() => {
    const list = dto.policies.map((p) => ({
      policy: p.policy,
      enabled: p.enabled,
      limits: normalizeLimits(p.limits),
    }));
    // A política principal é obrigatória: se faltar, entra com o padrão.
    if (!list.some((p) => p.policy === PRIMARY_POLICY)) {
      list.unshift({ policy: PRIMARY_POLICY, enabled: true, limits: { ...DEFAULT_LIMITS } });
    }
    return list;
  });

  const available = COMMERCIAL_POLICIES.filter((c) => !policies.some((p) => p.policy === c));

  function setLimit(policy: string, key: keyof CapacityLimits, value: number) {
    setPolicies((prev) =>
      prev.map((p) =>
        p.policy === policy
          ? { ...p, limits: { ...p.limits, [key]: Math.max(0, Math.floor(value) || 0) } }
          : p,
      ),
    );
  }

  const todayKey = weekdayKeyOf(new Date());

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="surface w-full max-w-3xl space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="section-title text-xl">Configurar capacidade — {dto.store}</h3>
            <p className="text-xs text-muted-foreground">
              Unidade da capacidade operacional: <strong>quantidade de pedidos</strong> (fixa).
            </p>
          </div>
          <button className="btn-ghost text-xs" onClick={onClose}>
            Fechar
          </button>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={unlimited}
            onChange={(e) => setUnlimited(e.target.checked)}
          />
          Definir como capacidade ilimitada (sem limite por dia)
        </label>

        {/* Regra ao atingir a capacidade máxima */}
        <div className="rounded-xl border border-border p-3">
          <h4 className="text-sm font-bold">Ao atingir a capacidade máxima do dia</h4>
          <label className="mt-2 flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="rule"
              className="mt-1"
              checked={rule === "continue_next_days"}
              onChange={() => setRule("continue_next_days")}
            />
            <span>
              <strong>Continuar a receber pedidos</strong> consumindo a capacidade dos dias
              seguintes, até D+{CAPACITY_HORIZON_DAYS}.
              <span className="block text-xs text-muted-foreground">
                Disponível independentemente da política comercial. O limite de dias é fixo em D+
                {CAPACITY_HORIZON_DAYS} e não pode ser alterado por enquanto.
              </span>
            </span>
          </label>
          <label className="mt-2 flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="rule"
              className="mt-1"
              checked={rule === "pause_until_end_of_day"}
              onChange={() => setRule("pause_until_end_of_day")}
            />
            <span>
              <strong>Pausar esta loja até o final do dia</strong>
              <span className="block text-xs text-muted-foreground">
                Novos pedidos não são aceitos no dia; a capacidade é liberada no dia seguinte.
              </span>
            </span>
          </label>
        </div>

        {/* Políticas comerciais */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-bold">Capacidade por política comercial</h4>
            {available.length ? (
              <select
                className="input text-xs"
                value=""
                onChange={(e) => {
                  const policy = e.target.value as CommercialPolicy;
                  if (!policy) return;
                  setPolicies((prev) => [
                    ...prev,
                    { policy, enabled: true, limits: { ...EMPTY_LIMITS } },
                  ]);
                }}
              >
                <option value="">+ Adicionar política comercial</option>
                {available.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            ) : null}
          </div>

          {policies.map((p) => (
            <div key={p.policy} className="rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">
                  {p.policy}
                  {p.policy === PRIMARY_POLICY ? (
                    <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                      Obrigatória
                    </span>
                  ) : null}
                </span>
                {p.policy === PRIMARY_POLICY ? null : (
                  <button
                    className="btn-ghost text-xs text-danger"
                    onClick={() =>
                      setPolicies((prev) => prev.filter((x) => x.policy !== p.policy))
                    }
                  >
                    Remover
                  </button>
                )}
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-4 lg:grid-cols-7">
                {WEEKDAYS.map((d) => (
                  <label
                    key={d.key}
                    className={
                      "field-label min-w-0 rounded-lg p-1 text-[11px] " +
                      (d.key === todayKey ? "bg-primary/10" : "")
                    }
                    title={d.label}
                  >
                    {d.short}
                    <input
                      type="number"
                      min={0}
                      className="input mt-1 w-full min-w-0"
                      disabled={unlimited}
                      value={p.limits[d.key]}
                      onChange={(e) => setLimit(p.policy, d.key, Number(e.target.value))}
                    />
                  </label>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Limite em pedidos para cada dia da semana. Zero significa que a loja não recebe
                pedidos dessa política no dia.
              </p>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button className="btn-ghost text-xs" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="tab-pill-active px-4 py-2 text-xs"
            onClick={() => onSave({ unlimited, overflowRule: rule, policies })}
          >
            Salvar alterações
          </button>
        </div>
      </div>
    </div>
  );
}
