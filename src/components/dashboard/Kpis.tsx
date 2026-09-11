/**
 * INDICADORES-CHAVE DE DESEMPENHO (KPIs)
 * =======================================
 * 
 * Exibe estatísticas do dashboard em grid responsivo.
 * Valores resumidos: polígonos visíveis, área, preço min/max, etc.
 */

import { brl } from "@/lib/freight/pricing";

/**
 * Estrutura de um KPI.
 * 
 * @param label - Título do indicador
 * @param value - Valor a exibir
 * @param hint - Dica/observação adicional (opcional)
 * @param tone - Codificação visual: "default" (cinza), "low" (verde), "high" (vermelho)
 */
interface Kpi {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "low" | "high";
}

/**
 * Grid de KPIs.
 * 
 * Responsivo:
 * - Mobile: 2 colunas
 * - Tablet: 4 colunas
 * - Desktop: 7 colunas
 * 
 * Cores por tone:
 * - "low": Verde (valor baixo/bom)
 * - "high": Vermelho (valor alto/ruim)
 * - "default": Preto (neutro)
 * 
 * @param items - Array de Kpi
 */
export function Kpis({ items }: { items: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
      {items.map((k, i) => (
        <div key={k.label} className="surface-hover relative overflow-hidden p-3.5 pl-4">
          {/* Barra lateral: laranja Obramax alternando com azul para leitura rápida */}
          <span
            aria-hidden
            className={
              "absolute inset-y-0 left-0 w-1 " +
              (k.tone === "low"
                ? "bg-success"
                : k.tone === "high"
                  ? "bg-danger"
                  : i % 2 === 0
                    ? "bg-accent-gradient"
                    : "bg-brand-2")
            }
          />
          <p className="eyebrow">{k.label}</p>
          {/* Valor principal (cor por tone, truncado com tooltip) */}
          <p
            className={
              "mt-1.5 truncate font-display text-2xl font-bold tracking-tight " +
              (k.tone === "low"
                ? "text-success"
                : k.tone === "high"
                  ? "text-danger"
                  : "text-primary")
            }
            title={k.value}
          >
            {k.value}
          </p>
          {/* Dica adicional (se fornecida) */}
          {k.hint ? <p className="text-[11px] text-muted-foreground">{k.hint}</p> : null}
        </div>
      ))}
    </div>
  );
}

/**
 * Alias para função de formatação de moeda (BRL).
 * Exportado como utilitário rápido: money(12.5) → "R$ 12,50"
 */
export const money = brl;
