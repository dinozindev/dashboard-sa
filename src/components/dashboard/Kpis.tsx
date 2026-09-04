import { brl } from "@/lib/freight/pricing";

interface Kpi {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "low" | "high";
}

export function Kpis({ items }: { items: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
      {items.map((k) => (
        <div key={k.label} className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {k.label}
          </p>
          <p
            className={
              "mt-1 truncate font-display text-xl font-semibold " +
              (k.tone === "low"
                ? "text-success"
                : k.tone === "high"
                  ? "text-danger"
                  : "text-foreground")
            }
            title={k.value}
          >
            {k.value}
          </p>
          {k.hint ? <p className="text-[11px] text-muted-foreground">{k.hint}</p> : null}
        </div>
      ))}
    </div>
  );
}

export const money = brl;
