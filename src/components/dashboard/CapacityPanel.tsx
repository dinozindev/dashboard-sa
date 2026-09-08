import { useState } from "react";
import { CAPACITY_BASE, computeCapacity, UTILIZATION_ALERT } from "@/lib/freight/capacity";
import type { CapacityInput } from "@/lib/freight/capacity";
import { OPS_STORES } from "@/lib/freight/dataset";
import type { StoreName } from "@/lib/freight/types";

const pct = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export function CapacityPanel() {
  const [inputs, setInputs] = useState<Partial<Record<StoreName, CapacityInput>>>(() => ({
    ...CAPACITY_BASE,
  }));
  const [limit, setLimit] = useState(UTILIZATION_ALERT);
  const results = OPS_STORES.flatMap((s) => {
    const input = inputs[s];
    return input ? [{ store: s, r: computeCapacity(input) }] : [];
  });
  const maxBar = Math.max(...results.map((x) => Math.max(x.r.daily, x.r.dailyDemand)), 1);

  const tone = (u: number) =>
    u > limit ? "text-danger" : u > limit - 15 ? "text-warning-foreground" : "text-success";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs text-muted-foreground">
          Limite de alerta de utilização (%)
          <input
            type="number"
            className="input mt-1 w-28"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          />
        </label>
        <button
          className="btn-ghost text-xs"
          onClick={() => setInputs({ ...CAPACITY_BASE })}
        >
          Restaurar valores de referência
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {results.map(({ store, r }) => (
          <div key={store} className="space-y-3 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold">{store}</h3>
              {r.utilization > limit ? (
                <span className="badge-closed">Risco de gargalo (&gt;{limit}%)</span>
              ) : (
                <span className="badge-open">Dentro do limite</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-muted-foreground">
                Veículos disponíveis/dia
                <input
                  type="number"
                  className="input mt-1"
                  value={inputs[store]?.vehicles ?? 0}
                  onChange={(e) =>
                    setInputs({
                      ...inputs,
                      [store]: { ...inputs[store]!, vehicles: Number(e.target.value) },
                    })
                  }
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Capacidade média por veículo
                <input
                  type="number"
                  className="input mt-1"
                  value={inputs[store]?.perVehicle ?? 0}
                  onChange={(e) =>
                    setInputs({
                      ...inputs,
                      [store]: { ...inputs[store]!, perVehicle: Number(e.target.value) },
                    })
                  }
                />
              </label>
            </div>
            <dl className="grid grid-cols-2 gap-y-1 text-sm">
              {[
                ["Capacidade diária", `${r.daily} entregas`],
                ["Demanda média diária", `${r.dailyDemand} entregas`],
                ["Capacidade disponível/dia", `${r.available} entregas`],
                ["Capacidade semanal", `${r.weekly} entregas`],
                ["Demanda semanal", `${r.weeklyDemand} entregas`],
                ["Ociosidade semanal", `${r.weeklyIdle} entregas`],
              ].map(([l, v]) => (
                <div key={l} className="col-span-2 flex justify-between gap-2">
                  <dt className="text-muted-foreground">{l}</dt>
                  <dd className="font-medium tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-muted-foreground">Utilização da capacidade</span>
                <span className={"font-display text-2xl font-bold " + tone(r.utilization)}>
                  {pct(r.utilization)}
                </span>
              </div>
              <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={
                    "h-full rounded-full " +
                    (r.utilization > limit
                      ? "bg-danger"
                      : r.utilization > limit - 15
                        ? "bg-warning"
                        : "bg-success")
                  }
                  style={{ width: `${Math.min(r.utilization, 100)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Capacidade x Demanda (entregas/dia)
        </p>
        <div className="space-y-3">
          {results.map(({ store, r }) => (
            <div key={store} className="space-y-1">
              <p className="text-sm font-medium">{store}</p>
              {[
                ["Capacidade", r.daily, "bg-accent"],
                ["Demanda", r.dailyDemand, "bg-primary"],
              ].map(([label, value, cls]) => (
                <div key={label as string} className="flex items-center gap-2 text-xs">
                  <span className="w-24 text-muted-foreground">{label as string}</span>
                  <div className="h-4 flex-1 rounded bg-muted">
                    <div
                      className={`h-full rounded ${cls as string}`}
                      style={{ width: `${((value as number) / maxBar) * 100}%` }}
                    />
                  </div>
                  <span className="w-10 text-right tabular-nums">{value as number}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
