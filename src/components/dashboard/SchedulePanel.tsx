/**
 * HORÁRIOS E CALENDÁRIO
 * =====================
 * 
 * Exibe horários de operação (Entrega/Retira) por loja.
 * Mostra se está aberto agora e grade semanal de horários.
 */

import { useEffect, useState } from "react";
import { DAY_LABEL, DAY_ORDER, getStatus, SCHEDULES } from "@/lib/freight/schedule";
import type { Modality, StoreName } from "@/lib/freight/types";
import type { ShippingPolicyDraft } from "@/lib/freight/policy-registry";

/**
 * HORÁRIOS CADASTRADOS NAS POLÍTICAS DE ENVIO
 * ===========================================
 *
 * Mostra, por loja, o horário realmente cadastrado na política:
 * - scheduleMode "janela" → "Janela de Envio" (dia + intervalo)
 * - scheduleMode "coleta" → "Horário de Coleta" (dia + horário)
 */
export function PolicySchedulePanel({
  drafts,
  stores,
  policyType,
  modalityFilter,
}: {
  drafts: ShippingPolicyDraft[];
  stores: string[];
  policyType: Modality;
  modalityFilter: string;
}) {
  const rows = stores.map((store) => {
    const matches = drafts.filter(
      (d) =>
        d.store === store &&
        d.policyType === policyType &&
        (modalityFilter === "todas" || d.modalities.includes(modalityFilter)),
    );
    return { store, matches };
  });

  const withPolicy = rows.filter((r) => r.matches.length);

  return (
    <div className="surface p-3">
      <p className="eyebrow mb-2">
        Horários cadastrados
        {modalityFilter === "todas" ? "" : ` · ${modalityFilter}`}
      </p>
      {withPolicy.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nenhuma política de {policyType.toLowerCase()} cadastrada
          {modalityFilter === "todas" ? "" : " para esta modalidade"} nas lojas selecionadas.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {withPolicy.map(({ store, matches }) =>
            matches.map((draft) => {
              const isWindow = draft.scheduleMode === "janela";
              const label = isWindow ? "Janela de Envio" : "Horário de Coleta";
              const entries = isWindow
                ? draft.shippingWindows.map((w) => ({
                    id: w.id,
                    day: w.day,
                    value: `${w.start}–${w.end}`,
                  }))
                : draft.pickupTimes.map((p) => ({
                    id: p.id,
                    day: p.day,
                    value: `até às ${p.time}`,
                  }));
              const summary = entries.length
                ? entries.map((e) => `${e.day} ${e.value}`).join(" · ")
                : "Horário não informado";
              return (
                <span
                  key={draft.id}
                  className={
                    entries.length
                      ? draft.active
                        ? "badge-open"
                        : "badge-closed"
                      : "inline-flex items-center gap-1 rounded-full bg-warning/20 px-2 py-0.5 text-[11px] font-semibold text-warning-foreground"
                  }
                  title={`${summary}`}
                >
                  <strong>{store}</strong> ·  {summary}
                  {modalityFilter === "todas" && draft.modalities.length
                    ? ` (${draft.modalities.join(", ")})`
                    : ""}
                </span>
              );
            }),
          )}
        </div>
      )}
    </div>
  );
}


/**
 * STATUS BADGE: Status de abertura/fechamento.
 * 
 * Exibe badge indicando se loja está aberta agora.
 * Cores: verde (aberto), vermelho (fechado).
 * 
 * Props:
 * @param store - Nome da loja
 * @param modality - Modalidade (Entrega ou Retira)
 * @param now - Data/hora atual
 * @param holidays - Lista de feriados (YYYY-MM-DD)
 * @param showStore - Incluir nome da loja no badge?
 */
export function StatusBadge({
  store,
  modality,
  now,
  holidays,
  showStore = true,
}: {
  store: string;
  modality: Modality;
  now: Date;
  holidays: string[];
  showStore?: boolean;
}) {
  // Obtém status para esta loja/modalidade/hora
  const s = getStatus(store as StoreName, modality, now, holidays);
  
  // Se loja não tem horários cadastrados
  if (!s) {
    return (
      <span className="badge-closed">
        {showStore ? <><strong>{store}</strong> · </> : null}
        Horário não cadastrado
      </span>
    );
  }
  
  // Status aberto/fechado com cores
  return (
    <span className={s.isOpen ? "badge-open" : "badge-closed"}>
      {showStore ? <><strong>{store}</strong> · </> : null}
      {s.isOpen ? "Aberto agora" : "Fechado"} · {modality} · {s.open}–
      {s.close} ({DAY_LABEL[s.dayKey]})
    </span>
  );
}

/**
 * GRADE DE HORÁRIOS: Tabela de horários por dia.
 * 
 * Exibe abertura/fechamento para cada dia da semana (seg-dom) + feriado.
 * Uma linha para "Abertura", outra para "Fechamento".
 * 
 * Props:
 * @param store - Nome da loja
 * @param modality - Modalidade (Entrega ou Retira)
 */
export function ScheduleGrid({ store, modality }: { store: string; modality: Modality }) {
  // Obtém grid de horários desta loja/modalidade
  const grid = SCHEDULES[modality][store as StoreName];
  if (!grid) return null;
  
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full table-fixed text-xs">
        <colgroup>
          <col className="w-[18%]" />
          {DAY_ORDER.map((day) => (
            <col key={day} className="w-[11.714%]" />
          ))}
        </colgroup>
        {/* CABEÇALHO: dias da semana */}
        <thead className="bg-muted/60 uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-2 py-1.5 text-left">{store} · {modality}</th>
            {DAY_ORDER.map((d) => (
              <th key={d} className="px-2 py-1.5">
                {DAY_LABEL[d]}
              </th>
            ))}
          </tr>
        </thead>
        
        {/* LINHAS: Abertura e Fechamento */}
        <tbody>
          {(["open", "close"] as const).map((k) => (
            <tr key={k} className="border-t border-border">
              {/* Rótulo: "Abertura" ou "Fechamento" */}
              <td className="px-2 py-1.5 font-medium">{k === "open" ? "Abertura" : "Fechamento"}</td>
              {/* Horário para cada dia */}
              {DAY_ORDER.map((d) => (
                <td key={d} className="px-2 py-1.5 text-center tabular-nums">
                  {grid[d][k]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
