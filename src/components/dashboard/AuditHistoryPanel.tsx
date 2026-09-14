/**
 * HISTÓRICO DE AUDITORIA
 * ======================
 *
 * Lista as alterações registradas automaticamente nas demais abas
 * (Cadastro de Política de Envio, Políticas de Envio e Envio de Polígonos).
 * Os dados ficam salvos apenas neste navegador.
 */

import { Fragment, useMemo, useState } from "react";
import {
  clearAuditLog,
  formatAuditDate,
  getAuditStorageError,
  useAuditLog,
  type AuditAction,
  type AuditEntry,
  type AuditModule,
} from "@/lib/freight/audit-log";

const ACTIONS: AuditAction[] = [
  "Criação",
  "Edição",
  "Ativação",
  "Desativação",
  "Adição",
  "Remoção",
];

const MODULES: AuditModule[] = [
  "Cadastro de Política de Envio",
  "Políticas de Envio",
  "Criação de Polígonos",
];

const ACTION_CLASS: Record<AuditAction, string> = {
  Criação: "border-success/40 bg-success/10 text-success",
  Adição: "border-success/40 bg-success/10 text-success",
  Edição: "border-primary/40 bg-primary/10 text-primary",
  Ativação: "border-primary/40 bg-primary/10 text-primary",
  Desativação: "border-border bg-muted text-muted-foreground",
  Remoção: "border-danger/40 bg-danger/10 text-danger",
};

type PeriodKey = "todos" | "24h" | "7d" | "personalizado";

function startOf(period: PeriodKey): number | null {
  const now = Date.now();
  if (period === "24h") return now - 24 * 3600 * 1000;
  if (period === "7d") return now - 7 * 24 * 3600 * 1000;
  return null;
}

function toCsv(rows: AuditEntry[]) {
  const head = [
    "Data/Hora",
    "Loja",
    "Aba de origem",
    "Tipo de ação",
    "Campo alterado",
    "Valor anterior",
    "Valor novo",
    "Descrição",
  ];
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const body = rows.map((r) =>
    [
      formatAuditDate(r.at),
      r.store,
      r.module,
      r.action,
      r.field,
      r.before,
      r.after,
      r.description,
    ]
      .map(esc)
      .join(";"),
  );
  return [head.map(esc).join(";"), ...body].join("\n");
}

export function AuditHistoryPanel() {
  const entries = useAuditLog();
  const storageError = getAuditStorageError();

  const [store, setStore] = useState("Todas");
  const [module, setModule] = useState<"Todas" | AuditModule>("Todas");
  const [action, setAction] = useState<"Todas" | AuditAction>("Todas");
  const [period, setPeriod] = useState<PeriodKey>("todos");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const stores = useMemo(
    () => [...new Set(entries.map((e) => e.store))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [entries],
  );

  const filtered = useMemo(() => {
    const min = period === "personalizado" ? (from ? new Date(from).getTime() : null) : startOf(period);
    const max =
      period === "personalizado" && to ? new Date(`${to}T23:59:59`).getTime() : null;
    const q = query.trim().toLocaleLowerCase();
    return entries
      .filter((e) => (store === "Todas" ? true : e.store === store))
      .filter((e) => (module === "Todas" ? true : e.module === module))
      .filter((e) => (action === "Todas" ? true : e.action === action))
      .filter((e) => {
        const t = new Date(e.at).getTime();
        if (min !== null && t < min) return false;
        if (max !== null && t > max) return false;
        return true;
      })
      .filter((e) =>
        q
          ? e.description.toLocaleLowerCase().includes(q) ||
            e.field.toLocaleLowerCase().includes(q)
          : true,
      )
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [entries, store, module, action, period, from, to, query]);

  const polygonsAdded = useMemo(
    () =>
      filtered
        .filter((e) => e.module === "Criação de Polígonos" && e.action === "Adição")
        .reduce((sum, e) => sum + (Number(e.after) || 0), 0),
    [filtered],
  );

  const byStore = (name: string) => entries.filter((e) => e.store === name).length;
  const last = filtered[0];

  const exportCsv = () => {
    const blob = new Blob(["\uFEFF" + toCsv(filtered)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "historico-auditoria.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    if (
      window.confirm(
        "Tem certeza que deseja apagar todo o histórico de auditoria? Essa ação não pode ser desfeita.",
      )
    ) {
      clearAuditLog();
      setOpenId(null);
    }
  };

  return (
    <div className="space-y-4">
      <section className="surface space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="section-title text-lg">Histórico de Auditoria</h2>
            <p className="text-xs text-muted-foreground">
              Acompanhe aqui todas as alterações feitas nas políticas de envio e nos polígonos das
              lojas, com data, hora e loja de origem. Os registros ficam salvos apenas neste
              navegador/dispositivo — não há sincronização com servidor.
            </p>
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost text-xs" onClick={exportCsv} disabled={!filtered.length}>
              Exportar histórico (CSV)
            </button>
            <button className="btn-ghost text-xs text-danger" onClick={handleClear}>
              Limpar histórico
            </button>
          </div>
        </div>

        {storageError ? (
          <p className="rounded-lg border border-danger/40 bg-danger/10 p-2 text-xs text-danger">
            {storageError}
          </p>
        ) : null}

        <div className="grid justify-center gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="mx-auto w-full max-w-xs rounded-xl border border-border p-3 text-center">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Total de alterações
            </p>
            <p className="text-xl font-semibold tabular-nums">
              {entries.length.toLocaleString("pt-BR")}
            </p>
          </div>
          <div className="mx-auto w-full max-w-xs rounded-xl border border-border p-3 text-center">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Polígonos adicionados 
            </p>
            <p className="text-xl font-semibold tabular-nums">
              {polygonsAdded.toLocaleString("pt-BR")}
            </p>
          </div>
          <div className="mx-auto w-full max-w-xs rounded-xl border border-border p-3 text-center">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Última alteração
            </p>
            {last ? (
              <>
                <p className="text-xs font-semibold">{formatAuditDate(last.at)}</p>
                <p className="text-[11px] text-muted-foreground">{last.description}</p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">—</p>
            )}
          </div>
        </div>
      </section>

      <section className="surface flex flex-wrap items-end gap-3 p-3.5">
        <label className="field-label">
          Loja
          <select
            className="input mt-1 w-44"
            value={store}
            onChange={(e) => setStore(e.target.value)}
          >
            <option value="Todas">Todas</option>
            {stores.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Aba de origem
          <select
            className="input mt-1 w-60"
            value={module}
            onChange={(e) => setModule(e.target.value as "Todas" | AuditModule)}
          >
            <option value="Todas">Todas</option>
            {MODULES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Tipo de ação
          <select
            className="input mt-1 w-40"
            value={action}
            onChange={(e) => setAction(e.target.value as "Todas" | AuditAction)}
          >
            <option value="Todas">Todas</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Período
          <select
            className="input mt-1 w-44"
            value={period}
            onChange={(e) => setPeriod(e.target.value as PeriodKey)}
          >
            <option value="todos">Todo o histórico</option>
            <option value="24h">Últimas 24h</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="personalizado">Personalizado</option>
          </select>
        </label>
        {period === "personalizado" ? (
          <>
            <label className="field-label">
              De
              <input
                type="date"
                className="input mt-1 w-40"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label className="field-label">
              Até
              <input
                type="date"
                className="input mt-1 w-40"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
          </>
        ) : null}
        <label className="field-label flex-1">
          Busca livre
          <input
            className="input mt-1 w-full min-w-48"
            placeholder="Descrição ou campo alterado"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </section>

      <section className="surface space-y-2 p-4">
        <p className="text-xs text-muted-foreground">
          {filtered.length.toLocaleString("pt-BR")} registro(s) no filtro atual · mais recentes
          primeiro.
        </p>
        {filtered.length === 0 ? (
          <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            {entries.length === 0
              ? "Nenhuma alteração registrada até o momento."
              : "Nenhum registro corresponde aos filtros selecionados."}
          </p>
        ) : (
          <div className="max-h-[32rem] overflow-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/80 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 text-left">Data/Hora</th>
                  <th className="px-2 py-2 text-left">Loja</th>
                  <th className="px-2 py-2 text-left">Aba de origem</th>
                  <th className="px-2 py-2 text-left">Tipo de ação</th>
                  <th className="px-2 py-2 text-left">Campo alterado</th>
                  <th className="px-2 py-2 text-left">Valor anterior → novo</th>
                  <th className="px-2 py-2 text-left">Descrição</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <Fragment key={e.id}>
                    <tr
                      className="cursor-pointer border-t border-border align-top hover:bg-muted/40"
                      onClick={() => setOpenId(openId === e.id ? null : e.id)}
                    >
                      <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">
                        {formatAuditDate(e.at)}
                      </td>
                      <td className="px-2 py-1.5 font-medium">{e.store}</td>
                      <td className="px-2 py-1.5">{e.module}</td>
                      <td className="px-2 py-1.5">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${ACTION_CLASS[e.action]}`}
                        >
                          {e.action}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">{e.field}</td>
                      <td className="px-2 py-1.5">
                        <span className="text-muted-foreground">{e.before}</span> →{" "}
                        <strong>{e.after}</strong>
                      </td>
                      <td className="max-w-72 truncate px-2 py-1.5">{e.description}</td>
                    </tr>
                    {openId === e.id ? (
                      <tr className="border-t border-border bg-muted/30">
                        <td colSpan={7} className="px-3 py-2 text-xs text-muted-foreground">
                          {e.description}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
