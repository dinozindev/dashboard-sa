import { Card } from "@/components/ui/card";

export interface Kpi {
  label: string;
  value: string;
  hint?: string;
}

export function KpiCards({ items }: { items: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-7">
      {items.map((k) => (
        <Card key={k.label} className="gap-1 p-3">
          <span className="text-[0.68rem] font-medium uppercase tracking-wide text-muted-foreground">
            {k.label}
          </span>
          <span className="font-display text-lg font-semibold leading-tight text-foreground">
            {k.value}
          </span>
          {k.hint ? <span className="text-[0.68rem] text-muted-foreground">{k.hint}</span> : null}
        </Card>
      ))}
    </div>
  );
}
