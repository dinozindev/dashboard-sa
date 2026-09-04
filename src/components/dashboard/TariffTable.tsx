import { brl, calcPrice, findBand, kg } from "@/lib/freight/pricing";
import type { WeightBand } from "@/lib/freight/types";

export function TariffTable({
  bands,
  weight,
  onPickBand,
  activeIndex,
  hidePrice = false,
}: {
  bands: WeightBand[] | undefined;
  weight: number;
  onPickBand?: (i: number) => void;
  activeIndex?: number | null;
  hidePrice?: boolean;
}) {
  if (!bands || bands.length === 0) {
    return (
      <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm font-medium text-danger">
        Regra de frete não encontrada
      </div>
    );
  }
  const applied = findBand(bands, weight);
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-2 py-2 text-left">Faixa de peso</th>
            <th className="px-2 py-2 text-right">Peso inicial</th>
            <th className="px-2 py-2 text-right">Peso final</th>
            <th className="px-2 py-2 text-right">Preço base</th>
            <th className="px-2 py-2 text-right">Adicional/kg</th>
            {hidePrice ? null : <th className="px-2 py-2 text-right">Preço calculado</th>}
          </tr>
        </thead>
        <tbody>
          {bands.map((b, i) => {
            const price = calcPrice([b], weight);
            const isApplied = applied === b;
            return (
              <tr
                key={i}
                onClick={() => onPickBand?.(i)}
                className={
                  "border-t border-border transition-colors " +
                  (onPickBand ? "cursor-pointer hover:bg-muted/50 " : "") +
                  (activeIndex === i ? "bg-accent/15 " : isApplied ? "bg-success/10 " : "")
                }
              >
                <td className="px-2 py-1.5 font-medium">
                  {kg(b.ws)} – {kg(b.we)}
                  {isApplied ? (
                    <span className="ml-1 text-[10px] font-semibold text-success">aplicada</span>
                  ) : null}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">{kg(b.ws)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{kg(b.we)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {b.amc === null ? "—" : brl(b.amc)}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {b.pew === null ? "—" : brl(b.pew)}
                </td>
                {hidePrice ? null : (
                  <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                    {price.ok ? brl(price.total) : "—"}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
