import { DAY_LABEL, DAY_ORDER, getStatus, SCHEDULES } from "@/lib/freight/schedule";
import type { Modality, StoreName } from "@/lib/freight/types";

export function StatusBadge({
  store,
  modality,
  now,
  holidays,
  showStore = true,
}: {
  store: StoreName;
  modality: Modality;
  now: Date;
  holidays: string[];
  showStore?: boolean;
}) {
  const s = getStatus(store, modality, now, holidays);
  if (!s) {
    return (
      <span className="badge-closed">
        {showStore ? <><strong>{store}</strong> · </> : null}
        Horário não cadastrado
      </span>
    );
  }
  return (
    <span className={s.isOpen ? "badge-open" : "badge-closed"}>
      {showStore ? <><strong>{store}</strong> · </> : null}
      {s.isOpen ? "Aberto agora" : "Fechado"} · {modality} · {s.open}–
      {s.close} ({DAY_LABEL[s.dayKey]})
    </span>
  );
}

export function ScheduleGrid({ store, modality }: { store: StoreName; modality: Modality }) {
  const grid = SCHEDULES[modality][store];
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-xs">
        <thead className="bg-muted/60 uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-2 py-1.5 text-left">{store} · {modality}</th>
            {DAY_ORDER.map((d) => (
              <th key={d} className="px-2 py-1.5">
                {DAY_LABEL[d]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(["open", "close"] as const).map((k) => (
            <tr key={k} className="border-t border-border">
              <td className="px-2 py-1.5 font-medium">{k === "open" ? "Abertura" : "Fechamento"}</td>
              {DAY_ORDER.map((d) => (
                <td key={d} className="px-2 py-1.5 text-center tabular-nums">
                  {grid[d][k]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
