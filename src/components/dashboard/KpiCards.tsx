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
        <Card key={k.label} className="flex flex-col gap-0.5 p-3">
          <span className="block text-[0.68rem] font-medium uppercase leading-tight tracking-wide text-muted-foreground">
            {k.label}
          </span>
          <span className="block font-display text-lg font-semibold leading-tight text-foreground">
            {k.value}
          </span>
          {k.hint ? <span className="block text-[0.68rem] text-muted-foreground">{k.hint}</span> : null}
        </Card>
      ))}
    </div>
  );
}
