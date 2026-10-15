import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatBr, type Holiday } from "@/lib/freight/delivery-capacity";

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

interface StoreRow {
  id: string;
  name: string;
}

export function HolidaysPanel({ canEdit }: { canEdit: boolean }) {
  const [list, setList] = useState<Holiday[]>([]);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [kind, setKind] = useState<"feriado" | "inventario">("feriado");
  const [scope, setScope] = useState<"nacional" | "estadual">("nacional");
  const [state, setState] = useState("SP");
  const [storeId, setStoreId] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [h, s] = await Promise.all([
      supabase.from("holidays").select("*").order("start_date"),
      supabase.from("stores").select("id,name").order("name"),
    ]);
    setList((h.data ?? []) as Holiday[]);
    const storeList = (s.data ?? []) as StoreRow[];
    setStores(storeList);
    setStoreId((cur) => cur || storeList[0]?.id || "");
  };
  useEffect(() => {
    void load();
  }, []);

  const add = async () => {
    if (!name.trim() || !startDate) {
      setMsg({ ok: false, text: "Informe o nome e a data de início." });
      return;
    }
    if (endDate && endDate < startDate) {
      setMsg({ ok: false, text: "A data de fim deve ser igual ou posterior à de início." });
      return;
    }
    if (kind === "inventario" && !storeId) {
      setMsg({ ok: false, text: "Selecione a loja para o inventário." });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("holidays").insert({
      name: name.trim().slice(0, 120),
      start_date: startDate,
      end_date: endDate || null,
      kind,
      scope: kind === "inventario" ? "nacional" : scope,
      state: kind === "inventario" ? null : scope === "estadual" ? state : null,
      store_id: kind === "inventario" ? storeId : null,
    });
    setSaving(false);
    if (error) return setMsg({ ok: false, text: error.message });
    setName("");
    setStartDate("");
    setEndDate("");
    setMsg({ ok: true, text: kind === "inventario" ? "Inventário cadastrado." : "Feriado cadastrado." });
    void load();
  };

  const remove = async (h: Holiday) => {
    if (!window.confirm(`Remover o feriado "${h.name}"?`)) return;
    await supabase.from("holidays").delete().eq("id", h.id);
    void load();
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="section-title text-lg">Feriados e Inventários</h2>
        <p className="text-xs text-muted-foreground">
          Feriados bloqueiam a Capacidade de Entrega e valem todos os anos. Inventário bloqueia
          apenas no ano definido e é vinculado a uma loja específica. Abrangência estadual vale
          só para lojas do estado enquanto que abrangência nacional vale para todas as lojas.
        </p>
      </div>
      {canEdit ? (
        <div className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[1.2fr_1.5fr_1fr_1fr_1fr_auto_auto]">
          <label className="text-xs text-muted-foreground">
            Tipo
            <select className="input mt-1 w-full" value={kind} onChange={(e) => setKind(e.target.value as "feriado" | "inventario")}>
              <option value="feriado">Feriado</option>
              <option value="inventario">Inventário</option>
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            Nome*
            <input className="input mt-1 w-full" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="text-xs text-muted-foreground">
            Data de início*
            <input type="date" className="input mt-1 w-full" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className="text-xs text-muted-foreground">
            Data de fim
            <input type="date" className="input mt-1 w-full" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          {kind === "feriado" ? (
            <>
              <label className="text-xs text-muted-foreground">
                Abrangência
                <select className="input mt-1 w-full" value={scope} onChange={(e) => setScope(e.target.value as "nacional" | "estadual")}>
                  <option value="nacional">Nacional</option>
                  <option value="estadual">Estadual</option>
                </select>
              </label>
              {scope === "estadual" ? (
                <label className="text-xs text-muted-foreground">
                  Estado
                  <select className="input mt-1 w-full" value={state} onChange={(e) => setState(e.target.value)}>
                    {UFS.map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <span />
              )}
            </>
          ) : (
            <label className="text-xs text-muted-foreground">
              Loja*
              <select className="input mt-1 w-full" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            disabled={saving}
            className="self-end rounded-lg border border-primary px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
            onClick={() => void add()}
          >
            {saving ? "Salvando…" : "+ Adicionar"}
          </button>
        </div>
      ) : null}
      {msg ? (
        <p className={"rounded-lg border p-2 text-xs " + (msg.ok ? "border-success/40 bg-success/10 text-success" : "border-danger/40 bg-danger/10 text-danger")}>
          {msg.text}
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/60 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Tipo</th>
              <th className="px-3 py-2 text-left">Nome</th>
              <th className="px-3 py-2 text-left">Início</th>
              <th className="px-3 py-2 text-left">Fim</th>
              <th className="px-3 py-2 text-left">Abrangência</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {list.map((h) => (
              <tr key={h.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <span
                    className={
                      "rounded-full px-2 py-0.5 " +
                      (h.kind === "inventario" ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground")
                    }
                  >
                    {h.kind === "inventario" ? "Inventário" : "Feriado"}
                  </span>
                </td>
                <td className="px-3 py-2 font-medium">{h.name}</td>
                <td className="px-3 py-2">{formatBr(h.start_date)}</td>
                <td className="px-3 py-2">{h.end_date ? formatBr(h.end_date) : "—"}</td>
                <td className="px-3 py-2">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                    {h.store_id
                      ? `Loja · ${stores.find((s) => s.id === h.store_id)?.name ?? "—"}`
                      : h.scope === "nacional"
                        ? "Nacional"
                        : `Estadual · ${h.state}`}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  {canEdit ? (
                    <button type="button" className="btn-ghost text-xs text-danger" onClick={() => void remove(h)}>
                      Remover
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {!list.length ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  Nenhum feriado ou inventário cadastrado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
