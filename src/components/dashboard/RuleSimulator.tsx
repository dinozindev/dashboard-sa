import { useMemo } from "react";
import type { Overrides } from "@/lib/freight/dataset";
import type { PolygonRecord, WeightBand } from "@/lib/freight/types";

interface Props {
  rec: PolygonRecord;
  bands: WeightBand[];
  index: number | null;
  onIndex: (i: number) => void;
  overrides: Overrides;
  setOverrides: (o: Overrides) => void;
}

const fields: { key: keyof WeightBand; label: string; step: number }[] = [
  { key: "ws", label: "Weight_Start (kg)", step: 1 },
  { key: "we", label: "Weight_End (kg)", step: 1 },
  { key: "amc", label: "AbsoluteMoneyCost (R$)", step: 1 },
  { key: "pew", label: "PriceByExtraWeight (R$/kg)", step: 0.005 },
];

export function RuleSimulator({ rec, bands, index, onIndex, overrides, setOverrides }: Props) {
  const i = index ?? 0;
  const band = bands[i];

  const warnings = useMemo(() => {
    const w: string[] = [];
    for (let k = 0; k < bands.length; k++) {
      const b = bands[k];
      if (!b || b.ws === null || b.we === null) continue;
      if (b.ws > b.we) w.push(`Faixa ${k + 1}: peso inicial maior que o peso final.`);
      const next = bands[k + 1];
      if (next && next.ws !== null && b.we !== null) {
        if (next.ws <= b.we) w.push(`Faixas ${k + 1} e ${k + 2} se sobrepõem.`);
        else if (next.ws > b.we + 1) w.push(`Lacuna entre as faixas ${k + 1} e ${k + 2}.`);
      }
    }
    return w;
  }, [bands]);

  const edit = (key: keyof WeightBand, value: string) => {
    const v = value === "" ? null : Number(value.replace(",", "."));
    setOverrides({
      ...overrides,
      [`${rec.id}#${i}`]: {
        ...(band as WeightBand),
        [key]: Number.isNaN(v as number) ? null : v,
      } as WeightBand,
    });
  };

  const restore = () => {
    const next: Overrides = {};
    for (const [k, v] of Object.entries(overrides)) if (!k.startsWith(`${rec.id}#`)) next[k] = v;
    setOverrides(next);
  };

  return (
    <div className="surface space-y-3 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Simulador de regras (memória — não altera a planilha)
        </p>
        <button onClick={restore} className="btn-ghost text-xs">
          Restaurar valores originais da planilha
        </button>
      </div>
      <label className="block text-xs text-muted-foreground">
        Faixa selecionada
        <select
          className="input mt-1"
          value={i}
          onChange={(e) => onIndex(Number(e.target.value))}
        >
          {bands.map((b, idx) => (
            <option key={idx} value={idx}>
              Faixa {idx + 1}: {b.ws ?? "—"} – {b.we ?? "—"} kg
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        {fields.map((f) => (
          <label key={f.key} className="block text-xs text-muted-foreground">
            {f.label}
            <input
              type="number"
              step={f.step}
              className="input mt-1"
              value={band?.[f.key] ?? ""}
              onChange={(e) => edit(f.key, e.target.value)}
            />
          </label>
        ))}
      </div>
      {warnings.length > 0 ? (
        <ul className="space-y-1 rounded-lg bg-warning/15 p-2 text-[11px] text-warning-foreground">
          {warnings.map((w) => (
            <li key={w}>⚠ {w}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
