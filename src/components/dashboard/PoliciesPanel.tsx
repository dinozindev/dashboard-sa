import { useRef, useState } from "react";
import { STATUS_CLASS, STATUS_ICON, type PolicyStatus } from "@/lib/freight/policies";
import {
  STATUS_OPTIONS,
  replaceMatrix,
  resetMatrix,
  updateCell,
  usePolicyMatrix,
} from "@/lib/freight/policy-status-store";
import {
  removePolicyDraft,
  usePolicyDrafts,
  type ShippingPolicyDraft,
} from "@/lib/freight/policy-registry";
import { downloadJson, readJsonFile } from "@/lib/freight/json-file";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type PolicyTarget = {
  policyId: string | null;
  store: string;
  modality: string;
};

function PolicyDetails({
  policy,
  onEdit,
  onRemove,
}: {
  policy: ShippingPolicyDraft;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const scheduleItems =
    policy.scheduleMode === "janela"
      ? policy.shippingWindows.map((window) => `${window.day}: ${window.start}–${window.end}`)
      : policy.pickupTimes.map((pickup) => `${pickup.day}: ${pickup.time}`);

  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Loja</p>
            <p className="font-semibold">{policy.store}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {policy.modalities.join(" · ")}
            </p>
          </div>
          <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">
            Ativa
          </span>
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Dimensões do pacote
        </h4>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Soma das dimensões", policy.dimensions.sumOfDimensions],
            ["Maior aresta", policy.dimensions.largestEdge],
            ["Peso cúbico", policy.dimensions.cubicWeightFactor],
            ["Peso mínimo", policy.dimensions.minimumWeightFactor],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-border bg-muted/30 p-2.5">
              <p className="text-[10px] leading-tight text-muted-foreground">{label}</p>
              <p className="mt-1 font-semibold">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Entregas
          </h4>
          <div className="mt-2 space-y-1.5 text-xs">
            <p>Sábados: {policy.weekend.saturday ? "✅" : "❌"}</p>
            <p>Domingos: {policy.weekend.sunday ? "✅" : "❌"}</p>
            <p>Feriados: {policy.weekend.holidays ? "✅" : "❌"}</p>
          </div>
        </div>
        <div className="rounded-lg border border-border p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Ponto de retirada
          </h4>
          <p className="mt-2 text-xs">
            {policy.pickup.enabled ? policy.pickup.seller : "Não associado"}
          </p>
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {policy.scheduleMode === "janela" ? "Janelas de envio" : "Horários de coleta"}
        </h4>
        <div className="divide-y divide-border rounded-lg border border-border">
          {scheduleItems.length ? (
            scheduleItems.map((item) => (
              <p key={item} className="px-3 py-2 text-xs">
                {item}
              </p>
            ))
          ) : (
            <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum horário informado.</p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
        <button
          type="button"
          className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
          onClick={onEdit}
        >
          Editar
        </button>
        <button
          type="button"
          className="rounded-lg border border-danger/50 px-3 py-2 text-xs font-semibold text-danger hover:bg-danger/10"
          onClick={onRemove}
        >
          Remover
        </button>
      </div>
    </div>
  );
}

export function PoliciesPanel({
  onEditPolicy,
}: {
  onEditPolicy: (policy: ShippingPolicyDraft) => void;
}) {
  const data = usePolicyMatrix();
  const drafts = usePolicyDrafts();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyTarget | null>(null);
  const selectedPolicyDraft = selectedPolicy
    ? drafts.find((policy) => policy.id === selectedPolicy.policyId)
    : undefined;

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
    <div className="space-y-3 surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="section-title text-lg">Políticas de envio por loja</h2>
          <p className="text-xs text-muted-foreground">
            Matriz loja × modalidade. Altere o status de cada modalidade direto na tabela — as
            mudanças ficam salvas em JSON no navegador. Estados: Ativa 🟢 · Inativa 🔴 · Em
            construção 🛠 · Não informada ⚪.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* <button
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
          </button> */}
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
                  const policy = drafts.find(
                    (draft) => draft.store === s.nome && draft.modalities.includes(m),
                  );
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
                      {m === "Pequenos Volumes" ? (
                        <input
                          aria-label={`Preço base de ${m} em ${s.nome}`}
                          value={cell.note}
                          placeholder="Preço base"
                          onChange={(e) => updateCell(s.nome, m, { note: e.target.value })}
                          className="mt-1 w-full min-w-[140px] rounded-md border border-border bg-background px-2 py-1 text-[11px]"
                        />
                      ) : null}
                      <button
                        type="button"
                        className="mt-2 w-full rounded-md border border-primary px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
                        onClick={() =>
                          setSelectedPolicy({
                            policyId: policy?.id ?? null,
                            store: s.nome,
                            modality: m,
                          })
                        }
                      >
                        Visualizar
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog
        open={Boolean(selectedPolicy)}
        onOpenChange={(open) => {
          if (!open) setSelectedPolicy(null);
        }}
      >
        {selectedPolicy ? (
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalhes da política</DialogTitle>
              <DialogDescription>
                {selectedPolicy.store} · {selectedPolicy.modality}
              </DialogDescription>
            </DialogHeader>
            {selectedPolicyDraft ? (
              <PolicyDetails
                policy={selectedPolicyDraft}
                onEdit={() => {
                  setSelectedPolicy(null);
                  onEditPolicy(selectedPolicyDraft);
                }}
                onRemove={() => {
                  if (
                    !window.confirm(
                      `Remover a política de ${selectedPolicyDraft.store} para ${selectedPolicyDraft.modalities.join(" · ")}?`,
                    )
                  ) {
                    return;
                  }
                  removePolicyDraft(selectedPolicyDraft.id);
                  const modality = selectedPolicyDraft.modalities[0];
                  if (modality) {
                    updateCell(selectedPolicyDraft.store, modality, {
                      status: "Não informada",
                    });
                  }
                  setSelectedPolicy(null);
                }}
              />
            ) : (
              <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                Política não cadastrada.
              </p>
            )}
          </DialogContent>
        ) : null}
      </Dialog>
      <p className="text-[11px] text-muted-foreground">
        Base original: planilha {data.source}. O arquivo enviado não é alterado — use “Baixar JSON”
        para gerar a versão atualizada.
      </p>
    </div>
  );
}
