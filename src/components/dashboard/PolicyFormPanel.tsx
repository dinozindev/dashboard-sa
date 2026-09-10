/**
 * CADASTRO DE POLÍTICA DE ENVIO (simulador)
 * =========================================
 * Formulário nos moldes do painel administrativo, apenas com estado local.
 */

import { useMemo, useRef, useState } from "react";
import { policies } from "@/lib/freight/policies";
import {
  addPolicyDraft,
  getPolicyDrafts,
  removePolicyDraft,
  replacePolicyDrafts,
  usePolicyDrafts,
  type PickupTime,
  type ShippingWindow,
} from "@/lib/freight/policy-registry";
import { downloadJson, readJsonFile } from "@/lib/freight/json-file";

const DAYS = [
  "Todos os dias",
  "Segunda a sexta-feira",
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

let seq = 0;
const uid = () => `row-${++seq}`;

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 text-left text-sm"
    >
      <span
        className={
          "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors " +
          (checked ? "bg-primary" : "bg-muted-foreground/40")
        }
      >
        <span
          className={
            "absolute top-0.5 h-4 w-4 rounded-full bg-card shadow transition-all " +
            (checked ? "left-[1.15rem]" : "left-0.5")
          }
        />
      </span>
      <span>{label}</span>
      <span className="text-xs text-muted-foreground">{checked ? "Ativa" : "Inativa"}</span>
    </button>
  );
}

function Section({
  title,
  hint,
  children,
  right,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export function PolicyFormPanel() {
  const stores = useMemo(() => policies.stores.map((s) => s.nome), []);
  const drafts = usePolicyDrafts();

  const [store, setStore] = useState("");
  const [sumOfDimensions, setSum] = useState(0);
  const [largestEdge, setEdge] = useState(0);
  const [cubic, setCubic] = useState(0);
  const [minWeight, setMinWeight] = useState(0);

  const [saturday, setSaturday] = useState(true);
  const [sunday, setSunday] = useState(false);
  const [holidays, setHolidays] = useState(false);

  const [pickupEnabled, setPickupEnabled] = useState(false);
  const [pickupSeller, setPickupSeller] = useState("");

  const [mode, setMode] = useState<"janela" | "coleta">("janela");
  const [acceptOutside, setAcceptOutside] = useState(false);
  const [windows, setWindows] = useState<ShippingWindow[]>([
    { id: uid(), day: "Todos os dias", start: "00:00", end: "23:59" },
  ]);
  const [pickupTimes, setPickupTimes] = useState<PickupTime[]>([
    { id: uid(), day: "Todos os dias", time: "00:00" },
  ]);

  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState<string | null>(null);

  const effectiveSeller = pickupSeller || store;

  const save = () => {
    const errs: string[] = [];
    if (!store) errs.push("Selecione a loja/seller da política.");
    if (pickupEnabled && !effectiveSeller)
      errs.push("Selecione o seller/ponto de retirada.");
    if (mode === "janela") {
      windows.forEach((w, i) => {
        if (!w.day || !w.start || !w.end)
          errs.push(`Preencha os campos obrigatórios da janela de envio ${i + 1}.`);
      });
    } else {
      pickupTimes.forEach((p, i) => {
        if (!p.day || !p.time)
          errs.push(`Preencha os campos obrigatórios do horário de coleta ${i + 1}.`);
      });
    }
    setErrors(errs);
    if (errs.length) {
      setSaved(null);
      return;
    }
    const id = `pol-${Date.now()}`;
    addPolicyDraft({
      id,
      createdAt: new Date().toISOString(),
      store,
      dimensions: {
        sumOfDimensions,
        largestEdge,
        cubicWeightFactor: cubic,
        minimumWeightFactor: minWeight,
      },
      weekend: { saturday, sunday, holidays },
      pickup: { enabled: pickupEnabled, seller: pickupEnabled ? effectiveSeller : "" },
      scheduleMode: mode,
      shippingWindows: mode === "janela" ? windows : [],
      pickupTimes: mode === "coleta" ? pickupTimes : [],
    });
    setSaved(id);
  };

  return (
    <div className="space-y-4">
      <Section
        title="Loja / seller da política"
        hint="Selecione a loja à qual esta política de envio pertence. A escolha alimenta a sugestão de seller nas políticas de retira."
      >
        <label className="block text-xs text-muted-foreground">
          Loja/seller*
          <select
            className="input mt-1 w-full max-w-sm"
            value={store}
            onChange={(e) => setStore(e.target.value)}
          >
            <option value="">Selecione…</option>
            {stores.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </Section>

      <Section
        title="Dimensões do pacote"
        hint="Restrições sugeridas pela plataforma para determinadas políticas. Você pode manter os valores em 0 e seguir em frente."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ["Soma das dimensões", sumOfDimensions, setSum, "0"],
              ["Maior aresta", largestEdge, setEdge, "100"],
              ["Fator de peso cúbico", cubic, setCubic, "0"],
              ["Fator de peso mínimo", minWeight, setMinWeight, "0"],
            ] as const
          ).map(([label, value, setter, ph]) => (
            <label key={label} className="text-xs text-muted-foreground">
              {label}
              <input
                type="number"
                min={0}
                className="input mt-1 w-full"
                placeholder={ph}
                value={value}
                onChange={(e) => setter(Number(e.target.value))}
              />
            </label>
          ))}
        </div>
      </Section>

      <Section
        title="Finais de semana e feriados"
        hint="Escolha se há entregas nesses dias."
      >
        <div className="space-y-2">
          <Toggle checked={saturday} onChange={setSaturday} label="Entrega aos sábados" />
          <Toggle checked={sunday} onChange={setSunday} label="Entrega aos domingos" />
          <Toggle checked={holidays} onChange={setHolidays} label="Entregas em feriados" />
        </div>
      </Section>

      <Section
        title="Associar pontos de retirada"
        hint="Preencha uma das opções para ativar seus pontos de retirada associando-os a uma política de envio."
        right={<Toggle checked={pickupEnabled} onChange={setPickupEnabled} label="" />}
      >
        {pickupEnabled ? (
          <div className="space-y-2">
            <label className="block text-xs text-muted-foreground">
              Seller / ponto de retirada*
              <select
                className="input mt-1 w-full max-w-sm"
                value={effectiveSeller}
                onChange={(e) => setPickupSeller(e.target.value)}
              >
                <option value="">Selecione…</option>
                {stores.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-[11px] text-muted-foreground">
              Sugestão preenchida com a loja selecionada no topo do formulário. Para a política
              funcionar de fato, é necessário existir um ponto de retirada (doca) cadastrado e
              associado a ela.
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Ative o botão acima para associar um ponto de retirada a esta política.
          </p>
        )}
      </Section>

      <Section
        title="Horário de funcionamento"
        hint="Defina os horários em que a transportadora faz coletas ou as janelas de tempo em que ela envia os itens para os clientes. Estas configurações influenciam o cálculo do tempo de entrega."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              [
                "janela",
                "Janela de envio",
                "Períodos em que a transportadora envia itens para os clientes.",
              ],
              [
                "coleta",
                "Horário de coleta",
                "Horários em que a transportadora coleta os itens para entrega.",
              ],
            ] as const
          ).map(([key, title, desc]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={
                "rounded-xl border p-3 text-left transition-colors " +
                (mode === key
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/60")
              }
            >
              <span className="flex items-center justify-between gap-2 text-sm font-semibold">
                {title}
                {mode === key ? <span className="text-primary">✓</span> : null}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">{desc}</span>
            </button>
          ))}
        </div>

        {mode === "janela" ? (
          <div className="space-y-3">
            <Toggle
              checked={acceptOutside}
              onChange={setAcceptOutside}
              label="Aceitar compras fora do horário de funcionamento"
            />
            <p className="text-[11px] text-muted-foreground">
              Quando ativo, o intervalo de tempo entre o momento do pedido e o início do próximo
              horário de funcionamento é somado ao tempo total de entrega.
            </p>
            {windows.map((w) => (
              <div key={w.id} className="grid gap-2 sm:grid-cols-[1fr_140px_140px_auto]">
                <label className="text-xs text-muted-foreground">
                  Dia da semana*
                  <select
                    className="input mt-1 w-full"
                    value={w.day}
                    onChange={(e) =>
                      setWindows((cur) =>
                        cur.map((x) => (x.id === w.id ? { ...x, day: e.target.value } : x)),
                      )
                    }
                  >
                    {DAYS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-muted-foreground">
                  Horário de início*
                  <input
                    type="time"
                    className="input mt-1 w-full"
                    value={w.start}
                    onChange={(e) =>
                      setWindows((cur) =>
                        cur.map((x) => (x.id === w.id ? { ...x, start: e.target.value } : x)),
                      )
                    }
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  Horário de término*
                  <input
                    type="time"
                    className="input mt-1 w-full"
                    value={w.end}
                    onChange={(e) =>
                      setWindows((cur) =>
                        cur.map((x) => (x.id === w.id ? { ...x, end: e.target.value } : x)),
                      )
                    }
                  />
                </label>
                {windows.length > 1 ? (
                  <button
                    type="button"
                    className="btn-ghost self-end text-xs"
                    onClick={() => setWindows((cur) => cur.filter((x) => x.id !== w.id))}
                  >
                    Remover
                  </button>
                ) : null}
              </div>
            ))}
            <div className="flex justify-end">
              <button
                type="button"
                className="rounded-lg border border-primary px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
                onClick={() =>
                  setWindows((cur) => [
                    ...cur,
                    { id: uid(), day: "Todos os dias", start: "00:00", end: "23:59" },
                  ])
                }
              >
                + Adicionar janela de envio
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {pickupTimes.map((p) => (
              <div key={p.id} className="grid gap-2 sm:grid-cols-[1fr_140px_auto]">
                <label className="text-xs text-muted-foreground">
                  Dia da semana*
                  <select
                    className="input mt-1 w-full"
                    value={p.day}
                    onChange={(e) =>
                      setPickupTimes((cur) =>
                        cur.map((x) => (x.id === p.id ? { ...x, day: e.target.value } : x)),
                      )
                    }
                  >
                    {DAYS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-muted-foreground">
                  Horário de coleta*
                  <input
                    type="time"
                    className="input mt-1 w-full"
                    value={p.time}
                    onChange={(e) =>
                      setPickupTimes((cur) =>
                        cur.map((x) => (x.id === p.id ? { ...x, time: e.target.value } : x)),
                      )
                    }
                  />
                </label>
                {pickupTimes.length > 1 ? (
                  <button
                    type="button"
                    className="btn-ghost self-end text-xs"
                    onClick={() => setPickupTimes((cur) => cur.filter((x) => x.id !== p.id))}
                  >
                    Remover
                  </button>
                ) : null}
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground">
              Se o pedido for feito antes do início do horário de coleta, nenhum tempo é adicionado
              ao tempo total de entrega. Se o pedido for feito depois do horário de coleta, o
              intervalo entre o momento do pedido e o próximo horário de coleta é somado ao tempo
              total de entrega.
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                className="rounded-lg border border-primary px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
                onClick={() =>
                  setPickupTimes((cur) => [
                    ...cur,
                    { id: uid(), day: "Todos os dias", time: "00:00" },
                  ])
                }
              >
                + Adicionar horário de coleta
              </button>
            </div>
          </div>
        )}
      </Section>

      {errors.length ? (
        <div className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-xs text-danger">
          <ul className="list-inside list-disc space-y-1">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="button"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          onClick={save}
        >
          Salvar política de envio
        </button>
      </div>

      {saved ? (
        <div className="rounded-xl border border-success/40 bg-success/10 p-3 text-xs text-success">
          Política salva nesta simulação ({saved}). Confira o resumo abaixo.
        </div>
      ) : null}

      {drafts.length ? (
        <Section
          title="Políticas cadastradas nesta sessão"
          hint="Resumo das políticas simuladas. Nada é gravado em arquivo — os dados existem apenas enquanto a página estiver aberta."
        >
          <div className="space-y-2">
            {drafts.map((d) => (
              <div key={d.id} className="rounded-lg border border-border p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-sm">{d.store}</strong>
                  <button
                    className="btn-ghost text-[11px]"
                    onClick={() => removePolicyDraft(d.id)}
                  >
                    Remover
                  </button>
                </div>
                <p className="mt-1 text-muted-foreground">
                  Sábados: {d.weekend.saturday ? "sim" : "não"} · Domingos:{" "}
                  {d.weekend.sunday ? "sim" : "não"} · Feriados:{" "}
                  {d.weekend.holidays ? "sim" : "não"} · Retira:{" "}
                  {d.pickup.enabled ? d.pickup.seller : "desativada"}
                </p>
                <p className="text-muted-foreground">
                  {d.scheduleMode === "janela"
                    ? d.shippingWindows
                        .map((w) => `${w.day} ${w.start}–${w.end}`)
                        .join(" · ")
                    : d.pickupTimes.map((p) => `${p.day} ${p.time}`).join(" · ")}
                </p>
                <p className="text-muted-foreground">
                  Dimensões: soma {d.dimensions.sumOfDimensions} · maior aresta{" "}
                  {d.dimensions.largestEdge} · peso cúbico {d.dimensions.cubicWeightFactor} · peso
                  mínimo {d.dimensions.minimumWeightFactor}
                </p>
              </div>
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}
