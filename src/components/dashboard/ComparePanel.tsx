import { brl, calcPrice } from "@/lib/freight/pricing";
import { stores, tariffFor, type Overrides } from "@/lib/freight/dataset";
import { distanceKm, isInSaoPauloState } from "@/lib/freight/geo";
import { activePickupModalities } from "@/lib/freight/policies";
import type { Modality, PolygonRecord } from "@/lib/freight/types";
import { StatusBadge } from "./SchedulePanel";

interface Props {
  point: { lng: number; lat: number };
  matches: PolygonRecord[];
  weight: number;
  overrides: Overrides;
  modality: Modality;
  now: Date;
  holidays: string[];
}

export function ComparePanel({ point, matches, weight, overrides, modality, now, holidays }: Props) {
  const isPickup = modality === "Retira";

  if (matches.length === 0) {
    if (!isInSaoPauloState(point.lng, point.lat)) {
      return (
        <div className="rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
          Ponto {point.lat.toFixed(4)}, {point.lng.toFixed(4)} — <strong>fora do estado de SP</strong>:
          sem entrega e sem retira disponíveis.
        </div>
      );
    }
    const nearest = [...stores]
      .map((s) => ({ s, d: distanceKm(s.center, [point.lng, point.lat]) }))
      .sort((a, b) => a.d - b.d)[0];
    const pickups = nearest ? activePickupModalities(nearest.s.name) : [];
    return (
      <div className="space-y-2 rounded-xl border border-warning/50 bg-warning/10 p-3 text-sm">
        <p>
          Ponto {point.lat.toFixed(4)}, {point.lng.toFixed(4)} — <strong>fora da zona de entrega</strong>{" "}
          das lojas Aricanduva e Suzano, porém dentro do estado de SP.
        </p>
        <p>
          Política de envio disponível: <strong>Retira</strong>
          {nearest ? (
            <>
              {" "}na loja <strong>{nearest.s.name}</strong> (loja mais próxima,{" "}
              {nearest.d.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km do ponto).
            </>
          ) : (
            "."
          )}
        </p>
        {pickups.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Modalidades de retira ativas nessa loja: {pickups.join(" · ")}
          </p>
        ) : null}
        {nearest ? (
          <StatusBadge store={nearest.s.name} modality="Retira" now={now} holidays={holidays} showStore={false} />
        ) : null}
      </div>
    );
  }

  // Melhor (menor raio) polígono por loja no ponto clicado.
  const byStore = new Map<string, PolygonRecord>();
  for (const m of matches) {
    const cur = byStore.get(m.store);
    if (!cur || m.radius < cur.radius) byStore.set(m.store, m);
  }
  const entries = [...byStore.entries()].map(([store, rec]) => {
    const bands = tariffFor(rec, overrides);
    return { store, rec, price: calcPrice(bands, weight) };
  });
  const valid = entries.filter((e) => e.price.ok);
  const cheapest =
    !isPickup && valid.length > 1
      ? valid.reduce((a, b) => (a.price.total <= b.price.total ? a : b))
      : null;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Ponto clicado: {point.lat.toFixed(5)}, {point.lng.toFixed(5)} ·{" "}
        {entries.length > 1 ? "Área de sobreposição entre as duas lojas" : "Cobertura por uma loja"}
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {entries.map(({ store, rec, price }) => (
          <div
            key={store}
            className={
              "space-y-2 rounded-xl border p-3 " +
              (cheapest?.store === store
                ? "border-success bg-success/10"
                : "border-border bg-card")
            }
          >
            <div className="flex items-center justify-between">
              <h4 className="font-display text-base font-semibold">{store}</h4>
              {cheapest?.store === store ? (
                <span className="badge-open">Menor preço (sugestão)</span>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              {rec.id} · faixa {rec.band} ({rec.rMin / 1000}–{rec.rMax / 1000} km) · {rec.district}
            </p>
            {isPickup ? null : (
              <p className="font-display text-2xl font-bold text-accent-strong">
                {price.ok ? brl(price.total) : "Regra de frete não encontrada"}
              </p>
            )}
            <div className="flex flex-col gap-1">
              <StatusBadge store={rec.store} modality={modality} now={now} holidays={holidays} showStore={false} />
            </div>
          </div>
        ))}
      </div>
      {entries.length > 1 && !isPickup ? (
        <p className="text-[11px] text-muted-foreground">
          Sugestão informativa baseada no preço calculado e no horário vigente — não altera os dados
          originais.
        </p>
      ) : null}
    </div>
  );
}
