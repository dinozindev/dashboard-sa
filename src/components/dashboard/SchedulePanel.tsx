/**
 * HORÁRIOS E CALENDÁRIO
 * =====================
 * 
 * Exibe horários de operação (Entrega/Retira) por loja.
 * Mostra se está aberto agora e grade semanal de horários.
 */

import { DAY_LABEL, DAY_ORDER, getStatus, SCHEDULES } from "@/lib/freight/schedule";
import type { Modality, StoreName } from "@/lib/freight/types";

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
  store: StoreName;
  modality: Modality;
  now: Date;
  holidays: string[];
  showStore?: boolean;
}) {
  // Obtém status para esta loja/modalidade/hora
  const s = getStatus(store, modality, now, holidays);
  
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
export function ScheduleGrid({ store, modality }: { store: StoreName; modality: Modality }) {
  // Obtém grid de horários desta loja/modalidade
  const grid = SCHEDULES[modality][store];
  if (!grid) return null;
  
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-xs">
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
