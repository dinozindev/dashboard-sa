/**
 * TABELA DE TARIFAS
 * =================
 * 
 * Exibe todas as faixas de peso de um polígono em formato tabular.
 * Mostra preço calculado para o peso simulado.
 * Permite selecionar faixa para simulação/edição.
 */

import { brl, calcPrice, findBand, kg } from "@/lib/freight/pricing";
import type { WeightBand } from "@/lib/freight/types";

/**
 * Props da tabela.
 * 
 * @param bands - Array de bandas de peso (WeightBand[])
 * @param weight - Peso simulado (para cálculo de preço)
 * @param onPickBand - Callback ao clicar em linha (índice)
 * @param activeIndex - Índice da faixa selecionada (para destaque visual)
 * @param hidePrice - Oculta coluna de preço calculado (defaut false)
 */
export function TariffTable({
  bands,
  weight,
  onPickBand,
  activeIndex,
  hidePrice = false,
}: {
  bands: WeightBand[] | undefined;
  weight: number;
  onPickBand?: (i: number) => void;
  activeIndex?: number | null;
  hidePrice?: boolean;
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
  
  // Identifica qual faixa será aplicada para o peso atual
  const applied = findBand(bands, weight);

  // Campos extras vindos da planilha (só exibidos quando existirem)
  const hasExtras = bands.some(
    (b) =>
      b.pct !== undefined ||
      b.time !== undefined ||
      b.maxVol !== undefined ||
      b.minIns !== undefined,
  );
  const numFmt = (v: number | null | undefined) =>
    v === null || v === undefined ? "—" : v.toLocaleString("pt-BR");
  
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
            <th className="px-2 py-2 text-right">Preço base</th>
            <th className="px-2 py-2 text-right">Adicional/kg</th>
            {hidePrice ? null : <th className="px-2 py-2 text-right">Preço calculado</th>}
          </tr>
        </thead>
        
        {/* LINHAS */}
        <tbody>
          {bands.map((b, i) => {
            // Calcula preço para esta faixa com o peso simulado
            const price = calcPrice([b], weight);
            
            // Verifica se esta faixa é a aplicável ao peso
            const isApplied = applied === b;
            
            return (
              <tr
                key={i}
                onClick={() => onPickBand?.(i)}
                className={
                  "border-t border-border transition-colors " +
                  (onPickBand ? "cursor-pointer hover:bg-muted/50 " : "") +
                  // Destacar: selecionada (accent), ou aplicável (success), ou normal
                  (activeIndex === i ? "bg-accent/15 " : isApplied ? "bg-success/10 " : "")
                }
              >
                {/* Coluna: Faixa de peso (ex: "5 kg - 10 kg") */}
                <td className="px-2 py-1.5 font-medium">
                  {kg(b.ws)} – {kg(b.we)}
                  {isApplied ? (
                    <span className="ml-1 text-[10px] font-semibold text-success">aplicada</span>
                  ) : null}
                </td>
                
                {/* Coluna: Peso inicial (ws) */}
                <td className="px-2 py-1.5 text-right tabular-nums">{kg(b.ws)}</td>
                
                {/* Coluna: Peso final (we) */}
                <td className="px-2 py-1.5 text-right tabular-nums">{kg(b.we)}</td>
                
                {/* Coluna: Preço base (amc - AbsoluteMoneyCost) */}
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {b.amc === null ? "—" : brl(b.amc)}
                </td>
                
                {/* Coluna: Preço por kg adicional (pew - PriceByExtraWeight) */}
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {b.pew === null ? "—" : brl(b.pew)}
                </td>
                
                {/* Coluna: Preço calculado (se hidePrice = false) */}
                {hidePrice ? null : (
                  <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                    {price.ok ? brl(price.total) : "—"}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
