import { brl, calcPrice, kg, NO_RULE } from "@/lib/freight/pricing";
import type { WeightBand } from "@/lib/freight/types";

export function PriceBreakdownCard({
  bands,
  weight,
  simulated,
}: {
  bands: WeightBand[] | undefined;
  weight: number;
  simulated?: boolean;
}) {
  const r = calcPrice(bands, weight);
  if (!r.ok) {
    return (
      <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm font-medium text-danger">
        {r.message ?? NO_RULE}
      </div>
    );
  }
  const rows = [
    ["1. Preço inicial da faixa", brl(r.basePrice)],
    ["2. Peso incluído na faixa", kg(r.includedWeight)],
    ["3. Peso excedente", kg(r.extraWeight)],
    ["4. Custo adicional por kg", brl(r.extraRate)],
  ] as const;
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Composição do cálculo
        </p>
        {simulated ? <span className="badge-sim">Simulação</span> : null}
      </div>
      <dl className="space-y-1 text-sm">
        {rows.map(([l, v]) => (
          <div key={l} className="flex justify-between gap-2">
            <dt className="text-muted-foreground">{l}</dt>
            <dd className="font-medium tabular-nums">{v}</dd>
          </div>
        ))}
        <div className="mt-2 flex justify-between gap-2 border-t border-border pt-2">
          <dt className="font-semibold">5. Preço final calculado</dt>
          <dd className="font-display text-lg font-bold tabular-nums text-accent-strong">
            {brl(r.total)}
          </dd>
        </div>
      </dl>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Faixa aplicada: {kg(r.band?.ws ?? null)} – {kg(r.band?.we ?? null)} · fonte: planilha
        {simulated ? " (com edições em memória)" : ""}
      </p>
    </div>
  );
}
