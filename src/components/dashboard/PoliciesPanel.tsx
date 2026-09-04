import { policies, STATUS_CLASS, STATUS_ICON } from "@/lib/freight/policies";

export function PoliciesPanel() {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div>
        <h2 className="font-display text-lg font-semibold">Políticas de envio por loja</h2>
        <p className="text-xs text-muted-foreground">
          Matriz loja × modalidade espelhando a base “Simulação” (somente leitura). Estados: Ativa
          🟢 · Inativa 🔴 · Em construção 🛠.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/60 uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="sticky left-0 z-10 bg-muted px-2 py-2 text-left">Modalidade</th>
              {policies.stores.map((s) => (
                <th key={s.centro} className="px-3 py-2 text-center">
                  {s.nome}
                  <span className="block text-[10px] font-normal normal-case">
                    Centro {s.centro} · {s.cidade}/{s.uf}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {policies.modalities.map((m) => (
              <tr key={m} className="border-t border-border">
                <td className="sticky left-0 z-10 bg-card px-2 py-1.5 font-medium">{m}</td>
                {policies.stores.map((s) => {
                  const cell = s.cells[m] ?? { status: "—" as const, note: "" };
                  return (
                    <td key={s.centro} className="px-3 py-1.5 text-center">
                      <span
                        className={
                          "inline-block rounded-md px-2 py-0.5 font-medium " +
                          STATUS_CLASS[cell.status]
                        }
                      >
                        {STATUS_ICON[cell.status]} {cell.status}
                        {cell.note ? ` (${cell.note})` : ""}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Fonte: planilha {policies.source}. Aba somente leitura — não altera o arquivo original.
      </p>
    </div>
  );
}
