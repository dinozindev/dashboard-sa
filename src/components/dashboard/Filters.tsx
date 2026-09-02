import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FAIXAS_RAIO, kg, type Loja } from "@/lib/freight";

export type LojaFilter = Loja | "Ambas";

export interface FilterState {
  loja: LojaFilter;
  faixas: string[];
  weight: number;
  priceMin: string;
  priceMax: string;
  search: string;
}

interface Props {
  value: FilterState;
  onChange: (patch: Partial<FilterState>) => void;
  onReset: () => void;
  maxWeight: number;
}

const LOJAS: LojaFilter[] = ["Aricanduva", "Suzano", "Ambas"];

export function Filters({ value, onChange, onReset, maxWeight }: Props) {
  const toggleFaixa = (f: string) =>
    onChange({
      faixas: value.faixas.includes(f)
        ? value.faixas.filter((x) => x !== f)
        : [...value.faixas, f],
    });

  return (
    <Card className="gap-5 p-4">
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Loja</Label>
        <div className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1">
          {LOJAS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => onChange({ loja: l })}
              className={`rounded-sm px-2 py-1.5 text-xs font-medium transition-colors ${
                value.loja === l
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Faixa de raio
        </Label>
        <div className="flex flex-wrap gap-1.5">
          {FAIXAS_RAIO.map((f) => {
            const on = value.faixas.includes(f);
            return (
              <button
                key={f}
                type="button"
                onClick={() => toggleFaixa(f)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40"
                }`}
              >
                {f}
              </button>
            );
          })}
        </div>
        {value.faixas.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma faixa selecionada.</p>
        ) : null}
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Peso simulado
          </Label>
          <span className="font-display text-sm font-semibold">{kg(value.weight)}</span>
        </div>
        <Slider
          value={[value.weight]}
          min={0}
          max={maxWeight}
          step={1}
          onValueChange={([v]) => onChange({ weight: v ?? 0 })}
        />
        <Input
          type="number"
          min={0}
          value={value.weight}
          onChange={(e) => onChange({ weight: Math.max(0, Number(e.target.value) || 0) })}
          className="h-8 text-xs"
        />
      </div>

      <Separator />

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Preço do frete (R$)
        </Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder="mín"
            value={value.priceMin}
            onChange={(e) => onChange({ priceMin: e.target.value })}
            className="h-8 text-xs"
          />
          <span className="text-xs text-muted-foreground">até</span>
          <Input
            type="number"
            placeholder="máx"
            value={value.priceMax}
            onChange={(e) => onChange({ priceMax: e.target.value })}
            className="h-8 text-xs"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Polígono</Label>
        <Input
          placeholder="Buscar por nome ou distrito"
          value={value.search}
          onChange={(e) => onChange({ search: e.target.value })}
          className="h-8 text-xs"
        />
      </div>

      <Button variant="outline" size="sm" onClick={onReset}>
        Limpar filtros
      </Button>
    </Card>
  );
}
