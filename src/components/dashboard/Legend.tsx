import { BAND_ORDER, BAND_COLORS, STORE_DASH, STORE_DASH_LABEL } from "@/lib/freight/palette";
import type { StoreName } from "@/lib/freight/types";

export function Legend({ stores }: { stores: StoreName[] }) {
  return (
    <div className="surface p-3 text-xs">
      <p className="eyebrow mb-2">Legenda</p>

      <p className="mb-1 font-medium text-foreground">Faixa de raio (cores iguais para todas as lojas)</p>
      <div className="mb-3 grid grid-cols-3 gap-1.5">
        {BAND_ORDER.map((b) => (
          <span key={b} className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: BAND_COLORS[b] }}
            />
            {b}
          </span>
        ))}
      </div>

      <p className="mb-1 font-medium text-foreground">Loja (padrão do contorno)</p>
      <div className="space-y-1">
        {stores.map((store) => (
          <div key={store} className="flex items-center gap-2 text-muted-foreground">
            <svg width="34" height="8" aria-hidden>
              <line
                x1="1"
                y1="4"
                x2="33"
                y2="4"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray={STORE_DASH[store]}
              />
            </svg>
            <span className="text-foreground">{store}</span>
            <span className="text-[10px]">({STORE_DASH_LABEL[store]})</span>
          </div>
        ))}
      </div>
    </div>
  );
}
