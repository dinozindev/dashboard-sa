import { useMemo, useRef, useState } from "react";
import { BASE_STORES, useSubmittedStores } from "@/lib/freight/submitted-stores";
import { liveStores, useLive } from "@/lib/freight/live";
import {
  policies,
  SHIPPING_POLICY_DEFINITIONS,
  STATUS_CLASS,
  STATUS_ICON,
  type PolicyStatus,
} from "@/lib/freight/policies";
import {
  addPolicyModality,
  removePolicyModality,
  STATUS_OPTIONS,
  replaceMatrix,
  resetMatrix,
  updateCell,
  usePolicyMatrix,
} from "@/lib/freight/policy-status-store";
import {
  removePolicyDraft,
  removePolicyDraftsByModality,
  usePolicyDrafts,
  type ShippingPolicyDraft,
} from "@/lib/freight/policy-registry";
import { downloadJson, readJsonFile } from "@/lib/freight/json-file";
import { usePolicyTariffs } from "@/lib/freight/policy-tariff-store";
import { logAudit } from "@/lib/freight/audit-log";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function PolicyDetails({
  policy,
  onEdit,
  onRemove,
  canEdit,
}: {
  policy: ShippingPolicyDraft;
  onEdit: () => void;
  onRemove: () => void;
  canEdit: boolean;
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
            <p className="mt-1 text-xs text-muted-foreground">{policy.modalities.join(" · ")}</p>
          </div>
          <span className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              {policy.policyType}
            </span>
            {policy.assistedSale ? (
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                Venda assistida
              </span>
            ) : null}
            <span
              className={
                "rounded-full px-2.5 py-1 text-xs font-semibold " +
                (policy.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")
              }
            >
              {policy.active ? "Ativa" : "Inativa"}
            </span>
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

      {policy.assistedSale ? (
        <div className="rounded-lg border border-border p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Entrega agendada
          </h4>
          {policy.scheduledDelivery.enabled ? (
            <div className="mt-2 space-y-1 text-xs">
              <p>Tempo máximo de entrega: {policy.scheduledDelivery.maxDays} dia(s)</p>
              {policy.scheduledDelivery.capacityEnabled ? (
                <>
                  <p>Capacidade em: {policy.scheduledDelivery.unit}</p>
                  {policy.scheduledDelivery.windows.map((w) => (
                    <p key={w.id}>
                      {w.days}: {w.start}–{w.end} · {w.capacity} {policy.scheduledDelivery.unit} ·
                      adicional R$ {w.additional.toFixed(2)}
                    </p>
                  ))}
                </>
              ) : (
                <p className="text-muted-foreground">Capacidade de entrega não configurada.</p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">Desativada.</p>
          )}
        </div>
      ) : null}

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
      {canEdit ? (
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
      ) : null}
    </div>
  );
}

export function PoliciesPanel({
  onEditPolicy,
  canEdit,
}: {
  onEditPolicy: (policy: ShippingPolicyDraft) => void;
  canEdit: boolean;
}) {
  const data = usePolicyMatrix();
  const drafts = usePolicyDrafts();
  const tariffLinks = usePolicyTariffs();
  const submitted = useSubmittedStores();
  const live = useLive();
  const [region, setRegion] = useState("Todas");

  /** Lojas liberadas: só entram na listagem quando têm polígonos cadastrados. */
  const availableStores = useMemo(() => {
    const matrixStores = data.stores.filter(
      (s) => BASE_STORES.includes(s.nome as never) || submitted.includes(s.nome as never),
    );
    const knownStores = new Set(matrixStores.map((s) => s.nome));
    const extraStores = liveStores(live)
      .filter((s) => s.polygonCount > 0 && !knownStores.has(s.name))
      .map((s) => ({
        centro: null,
        tipo: "",
        nome: s.name,
        uf: s.region,
        cidade: s.name,
        cells: Object.fromEntries(
          data.modalities.map((modality) => [
            modality,
            { status: "Não informada" as PolicyStatus, note: "" },
          ]),
        ),
      }));
    return [...matrixStores, ...extraStores];
  }, [data.modalities, data.stores, live, submitted]);
  const blockedStores = useMemo(
    () => data.stores.filter((s) => !availableStores.includes(s)),
    [data.stores, availableStores],
  );
  const availableRegions = useMemo(
    () => Array.from(new Set(availableStores.map((s) => s.uf))).sort(),
    [availableStores],
  );
  const shownStores = useMemo(
    () => availableStores.filter((s) => region === "Todas" || s.uf === region),
    [availableStores, region],
  );

  const fileRef = useRef<HTMLInputElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [newModality, setNewModality] = useState("");
  const [selectedModality, setSelectedModality] = useState<string | null>(null);
  const selectedPolicyDrafts = selectedModality
    ? drafts.filter((policy) => policy.modalities.includes(selectedModality))
    : [];
  const usesScheduledDelivery =
    selectedModality === "Retira Televendas" || selectedModality === "Entrega Agendada";

  const addModality = () => {
    const modality = newModality.trim();
    const result = addPolicyModality(modality, "");
    if (result === "empty") {
      setMessage({ kind: "err", text: "Informe o nome da nova modalidade." });
      return;
    }
    if (result === "exists") {
      setMessage({ kind: "err", text: "Já existe uma modalidade com esse nome." });
      return;
    }
    setNewModality("");
    logAudit({
      store: "Todas",
      module: "Políticas de Envio",
      field: "Modalidade",
      before: "—",
      after: modality,
      action: "Adição",
      description: `Modalidade "${modality}" adicionada à matriz de políticas`,
    });
    setMessage({ kind: "ok", text: `Modalidade "${modality}" adicionada à matriz de políticas.` });
  };

  const removeModality = (modality: string) => {
    if (!window.confirm(`Remover a modalidade "${modality}"?`)) return;
    if (removePolicyModality(modality) !== "removed") return;
    removePolicyDraftsByModality(modality);
    logAudit({
      store: "Todas",
      module: "Políticas de Envio",
      field: "Modalidade",
      before: modality,
      after: "—",
      action: "Remoção",
      description: `Modalidade "${modality}" removida da matriz de políticas`,
    });
    setMessage({ kind: "ok", text: `Modalidade "${modality}" removida.` });
  };

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
            Matriz loja × modalidade. Altere o status de cada modalidade direto na tabela. Estados:
            Ativa 🟢 · Inativa 🔴 · Em construção 🛠 · Não informada ⚪.
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

      <div className="flex flex-wrap items-center gap-2">
        <label className="field-label">
          Regional
          <select
            className="input mt-1 w-32"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          >
            <option value="Todas">Todas</option>
            {availableRegions.map((availableRegion) => (
              <option key={availableRegion} value={availableRegion}>
                {availableRegion}
              </option>
            ))}
          </select>
        </label>
      </div>

      {canEdit ? (
        <div className="rounded-lg border border-border p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="block flex-1 text-xs text-muted-foreground">
              Nova modalidade
              <input
                className="input mt-1 w-full"
                value={newModality}
                onChange={(e) => setNewModality(e.target.value)}
                placeholder="Ex.: Entrega expressa"
              />
            </label>
            <button
              type="button"
              className="rounded-lg border border-primary px-3 py-2 text-xs font-medium text-primary hover:bg-primary/10"
              onClick={addModality}
            >
              Adicionar modalidade
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.modalities
              .filter((modality) => !policies.modalities.includes(modality))
              .map((modality) => (
                <button
                  key={modality}
                  type="button"
                  className="rounded-full border border-danger/40 px-2.5 py-1 text-[11px] text-danger hover:bg-danger/10"
                  onClick={() => removeModality(modality)}
                >
                  Remover {modality}
                </button>
              ))}
          </div>
        </div>
      ) : null}

      {/* {blockedStores.length ? (
        <p className="rounded-lg border border-border bg-muted/40 p-2 text-[11px] text-muted-foreground">
          Lojas indisponíveis ({blockedStores.map((s) => s.nome).join(", ")}): cadastre os polígonos
          desta loja para liberar a política de envio.
        </p>
      ) : null} */}

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
              {shownStores.map((s) => (
                <th key={s.nome} className="px-3 py-2 text-center">
                  {s.nome}
                  <span className="block text-[10px] font-normal normal-case">
                    {s.cidade}/{s.uf}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.modalities.map((m) => (
              <tr key={m} className="border-t border-border">
                <td className="sticky left-0 z-10 bg-card px-2 py-1.5 font-medium">
                  <div className="flex min-w-[180px] items-center justify-between gap-2">
                    <span>
                      {m}
                      {SHIPPING_POLICY_DEFINITIONS.find((definition) => definition.name === m)?.id
                        ? ` · ID ${SHIPPING_POLICY_DEFINITIONS.find((definition) => definition.name === m)?.id}`
                        : null}
                    </span>
                    <button
                      type="button"
                      className="rounded-md border border-primary px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
                      onClick={() => setSelectedModality(m)}
                    >
                      Visualizar
                    </button>
                  </div>
                </td>
                {shownStores.map((s) => {
                  const cell = s.cells[m] ?? { status: "—" as PolicyStatus, note: "" };
                  const policy = drafts.find(
                    (draft) => draft.store === s.nome && draft.modalities.includes(m),
                  );
                  return (
                    <td key={s.nome} className="px-3 py-1.5 text-center">
                      {canEdit ? (
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
                      ) : (
                        <span
                          aria-label={`Status de ${m} em ${s.nome}`}
                          className={
                            "inline-block w-full min-w-[140px] rounded-md px-2 py-1 text-xs font-medium " +
                            STATUS_CLASS[cell.status]
                          }
                        >
                          {STATUS_ICON[cell.status]} {cell.status}
                        </span>
                      )}
                      {m === "Pequenos Volumes" ? (
                        <input
                          aria-label={`Preço base de ${m} em ${s.nome}`}
                          value={cell.note}
                          readOnly={!canEdit}
                          placeholder="Preço base"
                          onChange={(e) => updateCell(s.nome, m, { note: e.target.value })}
                          className="mt-1 w-full min-w-[140px] rounded-md border border-border bg-background px-2 py-1 text-[11px]"
                        />
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog
        open={Boolean(selectedModality)}
        onOpenChange={(open) => {
          if (!open) setSelectedModality(null);
        }}
      >
        {selectedModality ? (
          <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Políticas da modalidade</DialogTitle>
              <DialogDescription>
                {selectedModality} · {shownStores.length} loja(s)
              </DialogDescription>
            </DialogHeader>
            <div
              ref={topScrollRef}
              aria-label="Rolagem horizontal da tabela"
              className="sticky top-0 z-20 max-w-full overflow-x-auto rounded-t-lg bg-card pb-1"
              onScroll={(event) => {
                if (tableScrollRef.current) {
                  tableScrollRef.current.scrollLeft = event.currentTarget.scrollLeft;
                }
              }}
            >
              <div className="h-px min-w-[1700px] w-max" />
            </div>
            <div
              ref={tableScrollRef}
              className="max-w-full overflow-x-auto rounded-b-lg border border-border"
              onScroll={(event) => {
                if (topScrollRef.current) {
                  topScrollRef.current.scrollLeft = event.currentTarget.scrollLeft;
                }
              }}
            >
              <table
                className={
                  "w-full text-xs " + (usesScheduledDelivery ? "min-w-[1420px]" : "min-w-[1100px]")
                }
              >
                <thead className="bg-muted/60 text-left uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="sticky left-0 z-10 bg-muted px-3 py-2">Loja</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">Tabela de frete</th>
                    {usesScheduledDelivery ? (
                      <>
                        <th className="px-3 py-2">Entrega agendada</th>
                        <th className="px-3 py-2">Prazo máximo</th>
                        <th className="px-3 py-2">Capacidade</th>
                        <th className="px-3 py-2">Janelas agendadas</th>
                      </>
                    ) : null}
                    <th className="px-3 py-2">Dimensões</th>
                    <th className="px-3 py-2">Fim de semana/feriados</th>
                    <th className="px-3 py-2">Retirada</th>
                    <th className="px-3 py-2">Horários</th>
                    {canEdit ? <th className="px-3 py-2">Ações</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {shownStores.map((store) => {
                    const policy = selectedPolicyDrafts.find((item) => item.store === store.nome);
                    const tariffLink = policy ? tariffLinks[policy.id] : null;
                    return (
                      <tr key={store.nome} className="border-t border-border align-top">
                        <td className="sticky left-0 z-10 bg-card px-3 py-2 font-semibold">
                          {store.nome}
                        </td>
                        {policy ? (
                          <>
                            <td className="px-3 py-2">{policy.active ? "Ativa" : "Inativa"}</td>
                            <td className="px-3 py-2">{policy.policyType}</td>
                            <td className="px-3 py-2">
                              {tariffLink ? (
                                <span className="inline-flex whitespace-nowrap rounded-full bg-success/15 px-2 py-0.5 font-semibold text-success">
                                  Associada
                                </span>
                              ) : (
                                <span className="inline-flex whitespace-nowrap rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground">
                                  Não associada
                                </span>
                              )}
                            </td>
                            {usesScheduledDelivery ? (
                              <>
                                <td className="px-3 py-2">
                                  <span
                                    className={
                                      "inline-flex rounded-full px-2 py-0.5 font-semibold " +
                                      (policy.scheduledDelivery.enabled
                                        ? "bg-success/15 text-success"
                                        : "bg-muted text-muted-foreground")
                                    }
                                  >
                                    {policy.scheduledDelivery.enabled ? "Ativa" : "Desativada"}
                                  </span>
                                </td>
                                <td className="whitespace-nowrap px-3 py-2">
                                  {policy.scheduledDelivery.enabled
                                    ? `${policy.scheduledDelivery.maxDays} dia(s)`
                                    : "—"}
                                </td>
                                <td className="whitespace-nowrap px-3 py-2">
                                  {policy.scheduledDelivery.enabled &&
                                  policy.scheduledDelivery.capacityEnabled
                                    ? policy.scheduledDelivery.unit
                                    : "—"}
                                </td>
                                <td className="min-w-[240px] max-w-[360px] px-3 py-2">
                                  {policy.scheduledDelivery.enabled &&
                                  policy.scheduledDelivery.windows.length ? (
                                    <div className="space-y-1">
                                      {policy.scheduledDelivery.windows.map((window) => (
                                        <div
                                          key={window.id}
                                          className="rounded border border-border bg-muted/20 px-2 py-1 leading-tight"
                                        >
                                          <span className="font-medium">{window.days}</span>
                                          <span className="block text-muted-foreground">
                                            {window.start}-{window.end}
                                            {policy.scheduledDelivery.capacityEnabled
                                              ? ` · ${window.capacity} ${policy.scheduledDelivery.unit}`
                                              : ""}
                                            {window.additional > 0
                                              ? ` · +R$ ${window.additional.toFixed(2)}`
                                              : ""}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                              </>
                            ) : null}
                            <td className="px-3 py-2">
                              Soma {policy.dimensions.sumOfDimensions} · Aresta{" "}
                              {policy.dimensions.largestEdge} · Cúbico{" "}
                              {policy.dimensions.cubicWeightFactor} · Mínimo{" "}
                              {policy.dimensions.minimumWeightFactor}
                            </td>
                            <td className="px-3 py-2">
                              Sáb. {policy.weekend.saturday ? "Sim" : "Não"} · Dom.{" "}
                              {policy.weekend.sunday ? "Sim" : "Não"} · Feriados{" "}
                              {policy.weekend.holidays ? "Sim" : "Não"}
                            </td>
                            <td className="px-3 py-2">
                              {policy.pickup.enabled
                                ? policy.pickup.seller || "Associada"
                                : "Não associada"}
                            </td>
                            <td className="px-3 py-2">
                              <span className="font-semibold">
                                {policy.scheduleMode === "janela"
                                  ? "Janela de envio"
                                  : "Horário de coleta"}
                              </span>
                              <span className="mt-1 block">
                                {policy.scheduleMode === "janela"
                                  ? policy.shippingWindows
                                      .map(
                                        (window) => `${window.day}: ${window.start}-${window.end}`,
                                      )
                                      .join("; ") || "—"
                                  : policy.pickupTimes
                                      .map((pickup) => `${pickup.day}: ${pickup.time}`)
                                      .join("; ") || "—"}
                              </span>
                            </td>
                            {canEdit ? (
                              <td className="px-3 py-2">
                                <div className="flex gap-2 whitespace-nowrap">
                                  <button
                                    type="button"
                                    className="rounded-md bg-primary px-2 py-1 font-semibold text-primary-foreground hover:opacity-90"
                                    onClick={() => {
                                      setSelectedModality(null);
                                      onEditPolicy(policy);
                                    }}
                                  >
                                    Editar
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded-md border border-danger/50 px-2 py-1 font-semibold text-danger hover:bg-danger/10"
                                    onClick={() => {
                                      if (
                                        !window.confirm(
                                          `Remover a política de ${policy.store} para ${policy.modalities.join(" · ")}?`,
                                        )
                                      )
                                        return;
                                      removePolicyDraft(policy.id);
                                      updateCell(policy.store, selectedModality, {
                                        status: "Não informada",
                                      });
                                    }}
                                  >
                                    Remover
                                  </button>
                                </div>
                              </td>
                            ) : null}
                          </>
                        ) : (
                          <td
                            colSpan={usesScheduledDelivery ? (canEdit ? 13 : 12) : canEdit ? 9 : 8}
                            className="bg-muted/40 px-3 py-2 text-muted-foreground"
                          >
                            Sem política cadastrada · Status:{" "}
                            {store.cells[selectedModality]?.status ?? "—"}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
