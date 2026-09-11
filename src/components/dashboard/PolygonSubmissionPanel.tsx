/**
 * ENVIO DE POLÍGONOS (SIMULAÇÃO)
 * ==============================
 *
 * Permite selecionar uma loja mockada e "enviar" todos os seus polígonos
 * para o mapa. Os envios ficam salvos em JSON no navegador, então continuam
 * visíveis ao trocar de aba ou recarregar a página.
 */

import { useMemo, useState } from "react";
import { polygons, STORE_REGION } from "@/lib/freight/dataset";
import {
  BASE_STORES,
  PENDING_STORES,
  clearSubmittedStores,
  submitStore,
  unsubmitStore,
  useSubmittedStores,
} from "@/lib/freight/submitted-stores";
import type { StoreName } from "@/lib/freight/types";

export function PolygonSubmissionPanel({ onGoToMap }: { onGoToMap: () => void }) {
  const submitted = useSubmittedStores();
  const [store, setStore] = useState<StoreName>(PENDING_STORES[0] as StoreName);
  const [feedback, setFeedback] = useState<string | null>(null);

  /** Quantidade de polígonos e faixas por loja mockada */
  const summary = useMemo(() => {
    const map = new Map<StoreName, { count: number; bands: Set<string>; area: number }>();
    for (const p of polygons) {
      const cur = map.get(p.store) ?? { count: 0, bands: new Set<string>(), area: 0 };
      cur.count += 1;
      cur.bands.add(p.band);
      cur.area += p.areaKm2;
      map.set(p.store, cur);
    }
    return map;
  }, []);

  const info = summary.get(store);

  const handleSubmit = () => {
    const created = submitStore(store);
    setFeedback(
      created
        ? `${info?.count.toLocaleString("pt-BR") ?? 0} polígonos de ${store} enviados para o mapa.`
        : `${store} já havia sido enviada — os polígonos continuam no mapa.`,
    );
  };

  return (
    <div className="space-y-4">
      <section className="surface space-y-3 p-4">
        <div>
          <h2 className="section-title text-lg">Envio de polígonos por loja</h2>
          <p className="text-xs text-muted-foreground">
            Selecione uma loja e confirme o envio. Todos os polígonos da loja são plotados de uma
            vez no mapa da aba <strong>Operação e frete</strong> e permanecem lá, somando-se aos
            envios anteriores. Aricanduva e Suzano já estão cadastradas na operação.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="field-label">
            Loja
            <select
              className="input mt-1 w-60"
              value={store}
              onChange={(e) => {
                setStore(e.target.value as StoreName);
                setFeedback(null);
              }}
            >
              {PENDING_STORES.map((s) => (
                <option key={s} value={s}>
                  {s} · {STORE_REGION[s]}
                  {submitted.includes(s) ? " (enviada)" : ""}
                </option>
              ))}
            </select>
          </label>
          <button className="btn-primary" onClick={handleSubmit}>
            Enviar polígonos
          </button>
          <button className="btn-ghost text-xs" onClick={onGoToMap}>
            Ver no mapa
          </button>
        </div>

        {info ? (
          <p className="text-xs text-muted-foreground">
            {store}: <strong>{info.count.toLocaleString("pt-BR")}</strong> polígonos ·{" "}
            {[...info.bands].length} faixas de raio ·{" "}
            {info.area.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km² · tabela de frete
            com faixas de peso da planilha.
          </p>
        ) : null}

        {feedback ? (
          <p className="rounded-lg border border-success/40 bg-success/10 p-2 text-xs font-medium text-success">
            {feedback}
          </p>
        ) : null}
      </section>

      <section className="surface space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="section-title text-base">Lojas ativas no mapa</h3>
          {submitted.length ? (
            <button
              className="btn-ghost text-xs"
              onClick={() => {
                clearSubmittedStores();
                setFeedback("Todos os envios simulados foram removidos do mapa.");
              }}
            >
              Limpar envios
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {BASE_STORES.map((s) => (
            <span
              key={s}
              className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold"
            >
              {s} · já cadastrada
            </span>
          ))}
          {submitted.map((s) => (
            <span
              key={s}
              className="flex items-center gap-2 rounded-full border border-success/40 bg-success/10 px-3 py-1 text-xs font-semibold text-success"
            >
              {s} · enviada
              <button
                className="text-[11px] underline"
                onClick={() => unsubmitStore(s)}
                aria-label={`Remover ${s} do mapa`}
              >
                remover
              </button>
            </span>
          ))}
        </div>
        {submitted.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhuma loja enviada ainda. O mapa mostra apenas Aricanduva e Suzano.
          </p>
        ) : null}
      </section>

      <section className="surface space-y-2 p-4">
        <h3 className="section-title text-base">Lojas mockadas disponíveis</h3>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-2 py-2 text-left">Loja</th>
                <th className="px-2 py-2 text-left">Regional</th>
                <th className="px-2 py-2 text-right">Polígonos</th>
                <th className="px-2 py-2 text-right">Área (km²)</th>
                <th className="px-2 py-2 text-left">Situação</th>
              </tr>
            </thead>
            <tbody>
              {PENDING_STORES.map((s) => {
                const d = summary.get(s);
                return (
                  <tr key={s} className="border-t border-border">
                    <td className="px-2 py-1.5 font-medium">{s}</td>
                    <td className="px-2 py-1.5">{STORE_REGION[s]}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {(d?.count ?? 0).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {(d?.area ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                    </td>
                    <td className="px-2 py-1.5">
                      {submitted.includes(s) ? (
                        <span className="text-success">Enviada</span>
                      ) : (
                        <span className="text-muted-foreground">Aguardando envio</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Fonte: Cardapio_Frete_por_Loja_final.xlsx — tarifas nas abas por loja e coordenadas nas
          abas DE_PARA_&lt;LOJA&gt;.
        </p>
      </section>
    </div>
  );
}
