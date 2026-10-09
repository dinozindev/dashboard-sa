import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePolicyDrafts, type ShippingPolicyDraft } from "@/lib/freight/policy-registry";
import {
  SCHEDULED_MODALITIES,
  addDays,
  expectedDay,
  formatBr,
  isoDate,
  nextScheduledDays,
  type Holiday,
} from "@/lib/freight/delivery-capacity";

interface StoreRow {
  id: string;
  name: string;
  region: string;
}
interface DbRow {
  id: string;
  modality: string;
  day: string;
  delivery_time: string;
  capacity: number;
  reserved: number;
}

export function DeliveryCapacityPanel({
  canEdit,
  onEditPolicy,
}: {
  canEdit: boolean;
  onEditPolicy: (p: ShippingPolicyDraft) => void;
}) {
  const drafts = usePolicyDrafts();
  const today = isoDate(new Date());
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [storeId, setStoreId] = useState("");
  const [modality, setModality] = useState<string>("todas");
  const [start, setStart] = useState(today);
  const [horizon, setHorizon] = useState<7 | 14>(7);
  const [rows, setRows] = useState<DbRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [s, h] = await Promise.all([
        supabase.from("stores").select("id,name,region").order("name"),
        supabase.from("holidays").select("*"),
      ]);
      const list = (s.data ?? []) as StoreRow[];
      setStores(list);
      setHolidays((h.data ?? []) as Holiday[]);
      setStoreId((cur) => cur || list[0]?.id || "");
    })();
  }, []);

  const store = stores.find((s) => s.id === storeId);
  const storePolicies = useMemo(() => {
    const map = new Map<string, ShippingPolicyDraft>();
    if (!store) return map;
    for (const m of SCHEDULED_MODALITIES) {
      const p =
        drafts.find((d) => d.store === store.name && d.modalities.includes(m) && d.active) ??
        drafts.find((d) => d.store === store.name && d.modalities.includes(m));
      if (p) map.set(m, p);
    }
    return map;
  }, [drafts, store]);

  const scheduledDays = useMemo(
    () =>
      nextScheduledDays(
        start,
        horizon,
        modality === "todas" ? SCHEDULED_MODALITIES : [modality],
        storePolicies,
        store?.region ?? "",
        holidays,
      ),
    [start, horizon, modality, storePolicies, store?.region, holidays],
  );
  const end = scheduledDays.at(-1) ?? addDays(start, horizon - 1);
  const days = useMemo(() => {
    const range: string[] = [];
    for (let day = start; day <= end; day = addDays(day, 1)) range.push(day);
    return range;
  }, [start, end]);

  /** Sincroniza o banco: só hoje em diante é criado/atualizado; o passado fica como histórico. */
  const load = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    setError(null);
    const fetchRows = () =>
      supabase
        .from("delivery_capacity_days")
        .select("id,modality,day,delivery_time,capacity,reserved")
        .eq("store_id", store.id)
        .gte("day", start)
        .lte("day", end);
    const { data, error: e } = await fetchRows();
    if (e) {
      setError(e.message);
      setLoading(false);
      return;
    }
    const existing = (data ?? []) as DbRow[];
    const key = (m: string, d: string) => `${m}|${d}`;
    const byKey = new Map(existing.map((r) => [key(r.modality, r.day), r]));
    const upserts: Array<Record<string, unknown>> = [];
    const removals: string[] = [];
    for (const m of SCHEDULED_MODALITIES) {
      const p = storePolicies.get(m);
      for (const d of days) {
        if (d < today) continue;
        const exp = p ? expectedDay(p, m, d, store.region, holidays) : null;
        const cur = byKey.get(key(m, d));
        if (!exp) {
          if (cur) removals.push(cur.id);
          continue;
        }
        if (!cur || cur.capacity !== exp.capacity || cur.delivery_time !== exp.deliveryTime) {
          upserts.push({
            store_id: store.id,
            modality: m,
            day: d,
            capacity: exp.capacity,
            delivery_time: exp.deliveryTime,
            reserved: cur?.reserved ?? 0,
            updated_at: new Date().toISOString(),
          });
        }
      }
    }
    if (upserts.length)
      await supabase
        .from("delivery_capacity_days")
        .upsert(upserts as never, { onConflict: "store_id,modality,day" });
    if (removals.length) await supabase.from("delivery_capacity_days").delete().in("id", removals);
    if (upserts.length || removals.length) {
      const again = await fetchRows();
      setRows((again.data ?? []) as DbRow[]);
    } else setRows(existing);
    setLoading(false);
  }, [store, start, end, days, storePolicies, holidays, today]);

  useEffect(() => {
    void load();
  }, [load]);

  const display = useMemo(() => {
    const filtered = rows.filter((r) => modality === "todas" || r.modality === modality);
    return scheduledDays
      .map((d) => {
        const list = filtered.filter((r) => r.day === d);
        if (!list.length) return null;
        const capacity = list.reduce((a, r) => a + r.capacity, 0);
        const reserved = list.reduce((a, r) => a + r.reserved, 0);
        const times = Array.from(new Set(list.map((r) => r.delivery_time))).join(" · ");
        return { day: d, times, capacity, reserved, single: list.length === 1 ? list[0] : null };
      })
      .filter(Boolean) as Array<{
      day: string;
      times: string;
      capacity: number;
      reserved: number;
      single: DbRow | null;
    }>;
  }, [rows, scheduledDays, modality]);

  const saveReserved = async (row: DbRow, value: number) => {
    const v = Math.max(0, Math.floor(value || 0));
    setRows((cur) => cur.map((r) => (r.id === row.id ? { ...r, reserved: v } : r)));
    const { error: e } = await supabase
      .from("delivery_capacity_days")
      .update({ reserved: v, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    if (e) setError(e.message);
  };

  const editablePolicy = modality !== "todas" ? storePolicies.get(modality) : undefined;

  return (
    <section className="surface space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="section-title text-lg">Capacidade de Entrega</h2>
          <p className="text-xs text-muted-foreground">
            Entrega Agendada, Conforto Manhã, Conforto Tarde e Retira Televendas. Feriados e dias
            não configurados não aparecem.
          </p>
        </div>
        {editablePolicy && canEdit ? (
          <button
            type="button"
            className="rounded-lg border border-primary px-3 py-1.5 text-xs font-semibold uppercase text-primary hover:bg-primary/10"
            onClick={() => onEditPolicy(editablePolicy)}
          >
            ✎ Editar política de envio
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-muted-foreground">
          Loja
          <select
            className="input mt-1 w-56"
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.region})
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          Política de envio
          <select
            className="input mt-1 w-64"
            value={modality}
            onChange={(e) => setModality(e.target.value)}
          >
            <option value="todas">Todas (valores somados)</option>
            {SCHEDULED_MODALITIES.map((m) => (
              <option key={m} value={m}>
                {m}
                {storePolicies.has(m) ? "" : " (sem política)"}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          A partir de
          <input
            type="date"
            className="input mt-1"
            value={start}
            onChange={(e) => setStart(e.target.value || today)}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Período
          <select
            className="input mt-1"
            value={horizon}
            onChange={(e) => setHorizon(Number(e.target.value) as 7 | 14)}
          >
            <option value={7}>Próximos 7 dias</option>
            <option value={14}>Próximos 14 dias</option>
          </select>
        </label>
        <span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
          Data: {formatBr(start, true)} - {formatBr(end)}
        </span>
      </div>

      {error ? (
        <p className="rounded-lg border border-danger/40 bg-danger/10 p-2 text-xs text-danger">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Data de entrega</th>
              <th className="px-3 py-2 text-left">Horário de entrega</th>
              <th className="px-3 py-2 text-right">Capacidade (Pedidos)</th>
              <th className="px-3 py-2 text-right">Reservado</th>
              <th className="px-3 py-2 text-right">Disponível</th>
              <th className="px-3 py-2 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {display.map((r) => {
              const available = r.capacity - r.reserved;
              const past = r.day < today;
              return (
                <tr key={r.day} className="border-t border-border">
                  <td className="px-3 py-3">
                    {formatBr(r.day)}
                    {past ? (
                      <span className="ml-2 text-[10px] text-muted-foreground">histórico</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">{r.times}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{r.capacity}</td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {r.single && canEdit ? (
                      <input
                        type="number"
                        min={0}
                        aria-label={`Reservado em ${formatBr(r.day)}`}
                        className="input ml-auto w-20 text-right"
                        defaultValue={r.reserved}
                        key={`${r.single.id}-${r.reserved}`}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (v !== r.reserved) void saveReserved(r.single!, v);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        }}
                      />
                    ) : (
                      r.reserved
                    )}
                  </td>
                  <td
                    className={
                      "px-3 py-3 text-right tabular-nums " + (available <= 0 ? "text-danger" : "")
                    }
                  >
                    {available}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {available > 0 ? (
                      <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">
                        Visível
                      </span>
                    ) : (
                      <span className="rounded-full bg-danger/15 px-2.5 py-1 text-xs font-semibold text-danger">
                        Esgotado
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!display.length ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-xs text-muted-foreground">
                  {loading
                    ? "Carregando…"
                    : "Nenhum dia com capacidade configurada neste período. Configure em “Configurar capacidade de entrega” na política."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {modality === "todas" && display.length ? (
        <p className="text-[11px] text-muted-foreground">
          Para alterar o reservado, escolha uma política de envio específica.
        </p>
      ) : null}
    </section>
  );
}
