import { useRef, useState } from "react";
import { STATUS_CLASS, STATUS_ICON, type PolicyStatus } from "@/lib/freight/policies";
import {
  STATUS_OPTIONS,
  replaceMatrix,
  resetMatrix,
  updateCell,
  usePolicyMatrix,
} from "@/lib/freight/policy-status-store";
import { downloadJson, readJsonFile } from "@/lib/freight/json-file";

export function PoliciesPanel() {
  const data = usePolicyMatrix();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      replaceMatrix(await readJsonFile(file));
      setMessage({ kind: "ok", text: "Matriz de políticas importada do arquivo JSON." });
    } catch (e) {
      setMessage({
        kind: "err",
        text: e instanceof Error ? e.message : "Não foi possível ler o arquivo JSON.",
      });
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Políticas de envio por loja</h2>
          <p className="text-xs text-muted-foreground">
            Matriz loja × modalidade. Altere o status de cada modalidade direto na tabela — as
            mudanças ficam salvas em JSON no navegador. Estados: Ativa 🟢 · Inativa 🔴 · Em
            construção 🛠 · Não informada ⚪.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border border-primary px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
            onClick={() => downloadJson("shipping-policies.json", data)}
          >
            Baixar JSON
          </button>
          <button
            type="button"
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/60"
            onClick={() => fileRef.current?.click()}
          >
            Importar JSON
          </button>
          <button
            type="button"
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/60"
            onClick={() => {
              resetMatrix();
              setMessage({ kind: "ok", text: "Matriz restaurada conforme a planilha padrão." });
            }}
          >
            Restaurar padrão
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              void onImport(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {message ? (
        <p
          className={
            "rounded-lg border p-2 text-xs " +
            (message.kind === "ok"
              ? "border-success/40 bg-success/10 text-success"
              : "border-danger/40 bg-danger/10 text-danger")
          }
        >
          {message.text}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/60 uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="sticky left-0 z-10 bg-muted px-2 py-2 text-left">Modalidade</th>
              {data.stores.map((s) => (
                <th key={s.nome} className="px-3 py-2 text-center">
                  {s.nome}
                  <span className="block text-[10px] font-normal normal-case">
                    {s.centro ? `Centro ${s.centro} · ` : ""}
                    {s.cidade}/{s.uf}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.modalities.map((m) => (
              <tr key={m} className="border-t border-border">
                <td className="sticky left-0 z-10 bg-card px-2 py-1.5 font-medium">{m}</td>
                {data.stores.map((s) => {
                  const cell = s.cells[m] ?? { status: "—" as PolicyStatus, note: "" };
                  return (
                    <td key={s.nome} className="px-3 py-1.5 text-center">
                      <select
                        aria-label={`Status de ${m} em ${s.nome}`}
                        value={cell.status}
                        onChange={(e) =>
                          updateCell(s.nome, m, { status: e.target.value as PolicyStatus })
                        }
                        className={
                          "w-full min-w-[140px] rounded-md border border-transparent px-2 py-1 text-xs font-medium focus:border-primary focus:outline-none " +
                          STATUS_CLASS[cell.status]
                        }
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {STATUS_ICON[opt]} {opt}
                          </option>
                        ))}
                      </select>
                      <input
                        aria-label={`Observação de ${m} em ${s.nome}`}
                        value={cell.note}
                        placeholder="obs."
                        onChange={(e) => updateCell(s.nome, m, { note: e.target.value })}
                        className="mt-1 w-full min-w-[140px] rounded-md border border-border bg-background px-2 py-1 text-[11px]"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Base original: planilha {data.source}. O arquivo enviado não é alterado — use “Baixar JSON”
        para gerar a versão atualizada.
      </p>
    </div>
  );
}
