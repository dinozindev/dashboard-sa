import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  brl,
  computePrice,
  getBands,
  kg,
  type PolygonFeature,
  type PricingTable,
} from "@/lib/freight";

interface Props {
  feature: PolygonFeature | null;
  pricing: PricingTable;
  weight: number;
}

export function DetailsPanel({ feature, pricing, weight }: Props) {
  if (!feature) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">
          Selecione um polígono no mapa para ver a regra de frete e a tabela de faixas de peso.
        </p>
      </Card>
    );
  }

  const p = feature.properties;
  const bands = getBands(pricing, p.id);
  const current = bands ? computePrice(bands, weight) : null;

  return (
    <Card className="gap-4 p-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span
            className="size-2.5 rounded-full"
            style={{
              backgroundColor:
                p.loja === "Aricanduva" ? "var(--loja-aricanduva)" : "var(--loja-suzano)",
            }}
          />
          <Badge variant="secondary">{p.loja}</Badge>
          {p.faixa ? <Badge variant="outline">{p.faixa}</Badge> : null}
        </div>
        <h2 className="font-display text-base font-semibold">{p.id}</h2>
        <p className="text-xs text-muted-foreground">
          Distrito: {p.distrito ?? "—"} · {p.uf ?? "—"} · Raio{" "}
          {p.raioMin !== null && p.raioMax !== null
            ? `${(p.raioMin / 1000).toLocaleString("pt-BR")}–${(p.raioMax / 1000).toLocaleString("pt-BR")} km`
            : "—"}
        </p>
      </div>

      <Separator />

      {!bands ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          Regra de frete não encontrada para este polígono na planilha.
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Cálculo para {kg(weight)}
            </h3>
            {current ? (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <Metric label="Faixa" value={`${kg(current.band.ws ?? 0)} – ${kg(current.band.we ?? 0)}`} />
                <Metric label="Preço inicial da faixa" value={brl(current.base)} />
                <Metric label="Peso incluído (início da faixa)" value={kg(current.weightIncluded)} />
                <Metric label="Peso excedente" value={kg(current.excessWeight)} />
                <Metric label="Adicional por kg" value={brl(current.extraPerKg)} />
                <Metric label="Custo adicional" value={brl(current.extraCost)} />
                <div className="col-span-2 rounded-md bg-accent p-3">
                  <span className="text-[0.68rem] uppercase tracking-wide text-accent-foreground/70">
                    Preço final calculado
                  </span>
                  <p className="font-display text-2xl font-semibold text-accent-foreground">
                    {brl(current.total)}
                  </p>
                  <p className="mt-1 text-[0.7rem] text-accent-foreground/70">
                    {brl(current.base)} + ({kg(current.excessWeight)} × {brl(current.extraPerKg)})
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Peso inválido para cálculo.</p>
            )}
          </div>

          <Separator />

          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tabela de preços por faixa
            </h3>
            <div className="max-h-72 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Peso inicial</TableHead>
                    <TableHead className="text-xs">Peso final</TableHead>
                    <TableHead className="text-xs">Preço base</TableHead>
                    <TableHead className="text-xs">Adicional/kg</TableHead>
                    <TableHead className="text-xs">Preço calculado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bands.map((b, i) => {
                    const atEnd = computePrice(bands, b.we ?? 0);
                    const active = current?.bandIndex === i;
                    return (
                      <TableRow key={`${b.ws}-${b.we}-${i}`} className={active ? "bg-accent/50" : ""}>
                        <TableCell className="text-xs">{kg(b.ws ?? 0)}</TableCell>
                        <TableCell className="text-xs">{kg(b.we ?? 0)}</TableCell>
                        <TableCell className="text-xs">{brl(b.amc ?? 0)}</TableCell>
                        <TableCell className="text-xs">{brl(b.pew ?? 0)}</TableCell>
                        <TableCell className="text-xs font-medium">
                          {atEnd && atEnd.bandIndex === i ? brl(atEnd.total) : brl(b.amc ?? 0)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <p className="text-[0.68rem] text-muted-foreground">
              "Preço calculado" mostra o valor no limite superior da faixa: preço base + peso
              excedente × adicional por kg.
            </p>
          </div>
        </>
      )}
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/40 p-2">
      <span className="block text-[0.68rem] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
