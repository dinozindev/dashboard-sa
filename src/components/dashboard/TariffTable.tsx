/**
 * TABELA DE TARIFAS
 * =================
 * 
 * Exibe todas as faixas de peso de um polígono em formato tabular.
 * Mostra preço calculado para o peso simulado.
 * Permite selecionar faixa para simulação/edição.
 */

import { brl, kg } from "@/lib/freight/pricing";
import type { WeightBand } from "@/lib/freight/types";

/**
 * Props da tabela.
 * 
 * @param bands - Array de bandas de peso (WeightBand[])
 * @param onPickBand - Callback ao clicar em linha (índice)
 * @param activeIndex - Índice da faixa selecionada (para destaque visual)
 */
export function TariffTable({
  bands,
  onPickBand,
  activeIndex,
}: {
  bands: WeightBand[] | undefined;
  onPickBand?: (i: number) => void;
  activeIndex?: number | null;
}) {
  // ============================================================================
  // VALIDAÇÃO: Nenhuma faixa disponível
  // ============================================================================
  
  if (!bands || bands.length === 0) {
    return (
      <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm font-medium text-danger">
        Regra de frete não encontrada
      </div>
    );
  }
  
  // ============================================================================
  // TABELA
  // ============================================================================
  
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        {/* CABEÇALHO */}
        <thead className="bg-muted/60 text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-2 py-2 text-left">Faixa de peso</th>
            <th className="px-2 py-2 text-right">Peso inicial</th>
            <th className="px-2 py-2 text-right">Peso final</th>
            <th className="px-2 py-2 text-right">Adicional/kg</th>
            <th className="px-2 py-2 text-right">Preço base</th>
          </tr>
        </thead>
        
        {/* LINHAS */}
        <tbody>
          {bands.map((b, i) => {
            return (
              <tr
                key={i}
                onClick={() => onPickBand?.(i)}
                className={
                  "border-t border-border transition-colors " +
                  (onPickBand ? "cursor-pointer hover:bg-muted/50 " : "") +
                  (activeIndex === i ? "bg-accent/15 " : "")
                }
              >
                <td className="px-2 py-1.5 font-medium">{kg(b.ws)} – {kg(b.we)}</td>

                {/* Coluna: Peso inicial (ws) */}
                <td className="px-2 py-1.5 text-right tabular-nums">{kg(b.ws)}</td>
                
                {/* Coluna: Peso final (we) */}
                <td className="px-2 py-1.5 text-right tabular-nums">{kg(b.we)}</td>
                
                {/* Coluna: Preço por kg adicional (pew - PriceByExtraWeight) */}
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {b.pew === null ? "—" : brl(b.pew)}
                </td>

                {/* Coluna: Preço base (amc - AbsoluteMoneyCost) */}
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {b.amc === null ? "—" : brl(b.amc)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
