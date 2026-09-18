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

/**
 * AVISO DE JANELA DE ENVIO
 * ========================
 *
 * Pop-up informativo: Saldo Borderô e Retira Imediata normalmente trabalham
 * com janela de envio, e não com horário de coleta.
 */
export function ShippingWindowNotice({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Aviso sobre horário de atendimento"
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-foreground/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="section-title text-base">Horário de atendimento</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Geralmente as modalidades <strong>Saldo Borderô</strong> e{" "}
          <strong>Retira Imediata</strong> utilizam <strong>janela de envio</strong>, e não
          horário de coleta.
        </p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            onClick={onClose}
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}

/** Abre o aviso automaticamente na primeira vez que a tela é exibida. */
export function useShippingWindowNotice(active: boolean) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (active && !seen) {
      setSeen(true);
      setOpen(true);
    }
  }, [active, seen]);
  return { open, setOpen };
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
