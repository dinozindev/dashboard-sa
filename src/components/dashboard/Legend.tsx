import { BAND_ORDER, PALETTE, STORE_DASH } from "@/lib/freight/palette";
import { STORE_NAMES } from "@/lib/freight/dataset";
import type { StoreSelection } from "@/lib/freight/types";

export function Legend({ selection }: { selection: StoreSelection }) {
  const shown = STORE_NAMES.filter((s) => selection === "Ambas" || selection === s);
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-xs shadow-sm">
      <p className="mb-2 font-semibold uppercase tracking-wide text-muted-foreground">Legenda</p>
      <div className="space-y-3">
        {shown.map((store) => (
          <div key={store}>
            <p className="mb-1 flex items-center gap-2 font-medium text-foreground">
              {store}
              <span className="text-[10px] font-normal text-muted-foreground">
                {STORE_DASH[store] ? "(contorno tracejado)" : "(contorno sólido)"}
              </span>
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {BAND_ORDER.map((b) => (
                <span key={b} className="flex items-center gap-1.5 text-muted-foreground">
                  <span
                    className="inline-block h-3 w-3 rounded-sm border"
                    style={{
                      backgroundColor: PALETTE[store][b],
                      borderColor: PALETTE[store][b],
                      borderStyle: STORE_DASH[store] ? "dashed" : "solid",
                    }}
                  />
                  {b}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
