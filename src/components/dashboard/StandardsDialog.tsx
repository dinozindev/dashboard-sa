import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { refreshLive, useLive } from "@/lib/freight/live";
import {
  DEFAULT_RULES,
  resolveRules,
  type ScheduleRule,
  type ScheduledCapacityRule,
  type StandardRow,
  type StandardRules,
} from "@/lib/freight/policy-standards";
import { deletePolicyStandard, savePolicyStandard } from "@/lib/freight/remote.functions";
import { logAudit } from "@/lib/freight/audit-log";
import {
  DAY_GROUPS,
  POLICY_SCHEDULE_DAYS,
  formatDaySelection,
  normalizeDaySelection,
  type DayGroup,
} from "@/lib/freight/policy-registry";

const DIMENSIONS: Array<[keyof StandardRules, string]> = [
  ["largestEdge", "Maior aresta"],
  ["sumOfDimensions", "Soma das dimensões"],
  ["cubicWeightFactor", "Fator peso cúbico"],
  ["minimumWeightFactor", "Fator peso mínimo"],
];
const FLAGS: Array<["saturday" | "sunday" | "holidays", string]> = [
  ["saturday", "Entrega aos sábados"],
  ["sunday", "Entrega aos domingos"],
  ["holidays", "Entrega em feriados"],
];

const ORIGIN_LABEL = {
  loja: "Regra específica desta loja",
  geral: "Seguindo o padrão geral da rede",
  fabrica: "Padrão inicial de fábrica",
  nenhum: "Sem padrão definido",
} as const;

function clean(rules: StandardRules): StandardRules {
  return JSON.parse(JSON.stringify(rules)) as StandardRules;
}

function scheduleDayOption(days: string): string {
  if (POLICY_SCHEDULE_DAYS.some((option) => option === days)) return days;
  const compactDays = days.toLowerCase().replace(/[^a-z]/g, "");
  if (compactDays === "segdom") return "Todos os dias";
  if (compactDays === "segsab") return "Segunda a sábado";
  return days;
}

function scheduleRules(schedule: StandardRules["schedule"]): ScheduleRule[] {
  const rules = schedule ? (Array.isArray(schedule) ? schedule : [schedule]) : [];
  return rules.map((rule) => ({ ...rule, days: scheduleDayOption(rule.days) }));
}

export function StandardsDialog({
  open,
  onOpenChange,
  canEdit,
  stores,
  modalities,
  initialStore,
  initialModality,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
  stores: string[];
  modalities: string[];
  initialStore?: string | null;
  initialModality?: string | null;
}) {
  const live = useLive();
  const rows: StandardRow[] = useMemo(
    () =>
      (live?.snapshot.policyStandards ?? []).map((r) => ({
        store: r.store,
        modality: r.modality,
        rules: (r.rules ?? {}) as StandardRules,
      })),
    [live],
  );
  const [scope, setScope] = useState<string>("");
  const [modality, setModality] = useState<string>(modalities[0] ?? "");
  const [form, setForm] = useState<StandardRules>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setScope(initialStore ?? "");
    setModality(initialModality ?? modalities[0] ?? "");
    setMsg(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const resolved = resolveRules(modality, scope || null, rows);
  const resolvedKey = JSON.stringify(resolved.rules);
  useEffect(() => {
    setForm(clean(resolved.rules ?? {}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, modality, resolvedKey]);

  const set = (patch: Partial<StandardRules>) => setForm((f) => ({ ...f, ...patch }));
  const unset = (key: keyof StandardRules) =>
    setForm((f) => {
      const next = { ...f };
      delete next[key];
      return next;
    });

  const run = async (fn: () => Promise<unknown>, audit: { before: string; after: string; desc: string }, ok: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      logAudit({
        store: scope || "Padrão geral",
        module: "Políticas de Envio",
        field: `Padrão · ${modality}`,
        before: audit.before,
        after: audit.after,
        action: "Edição",
        description: audit.desc,
      });
      await refreshLive();
      setMsg(ok);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  };

  const before = JSON.stringify(resolved.rules ?? {});
  const onSave = () =>
    run(
      () => savePolicyStandard({ data: { store: scope || null, modality, rules: form as Record<string, unknown> } }),
      { before, after: JSON.stringify(form), desc: scope ? `Padrão específico de ${scope} para ${modality} alterado.` : `Padrão geral de ${modality} alterado.` },
      "Padrão salvo.",
    );
  const onUseGeneral = () =>
    run(
      () => deletePolicyStandard({ data: { store: scope, modality } }),
      { before, after: "padrão geral", desc: `${scope} voltou a seguir o padrão geral de ${modality}.` },
      "A loja voltou a seguir o padrão geral.",
    );
  const factory = DEFAULT_RULES[modality];
  const onFactory = () =>
    run(
      () => savePolicyStandard({ data: { store: null, modality, rules: (factory ?? {}) as Record<string, unknown> } }),
      { before, after: JSON.stringify(factory ?? {}), desc: `Padrão geral de ${modality} restaurado ao inicial.` },
      "Padrão inicial restaurado.",
    );

  const ro = !canEdit || busy;
  const hasSchedule = form.schedule !== undefined;
  const sched = scheduleRules(form.schedule);
  const scheduleMode = sched[0]?.mode ?? "coleta";
  const scd = form.scheduled;
  const availableCapacityDays = DAY_GROUPS.filter(
    (day) => !scd?.windows?.some((window) => normalizeDaySelection(window.days).includes(day)),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Padrões das políticas</DialogTitle>
          <DialogDescription>
            Valores usados para sinalizar campos fora do padrão. Lojas sem regra própria seguem o padrão geral.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="field-label">
            Aplicar a
            <select className="input mt-1" value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="">Padrão geral da rede</option>
              {stores.map((s) => (
                <option key={s} value={s}>
                  Loja: {s}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Modalidade
            <select className="input mt-1" value={modality} onChange={(e) => setModality(e.target.value)}>
              {modalities.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
          {ORIGIN_LABEL[resolved.origin]}
          {scope && resolved.origin !== "loja" ? " — ao salvar, esta loja passa a ter regra própria." : ""}
        </p>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Dimensões</h3>
          {DIMENSIONS.map(([key, label]) => {
            const v = form[key] as number | null | undefined;
            const mode = v === undefined ? "skip" : v === null ? "off" : "value";
            return (
              <div key={key} className="grid grid-cols-[1fr_auto_6rem] items-center gap-2 text-sm">
                <span>{label}</span>
                <select
                  className="input"
                  disabled={ro}
                  value={mode}
                  onChange={(e) => {
                    const m = e.target.value;
                    if (m === "skip") unset(key);
                    else set({ [key]: m === "off" ? null : (typeof v === "number" ? v : 0) } as Partial<StandardRules>);
                  }}
                >
                  <option value="skip">Não verificar</option>
                  <option value="off">Desabilitado</option>
                  <option value="value">Valor</option>
                </select>
                <input
                  type="number"
                  className="input"
                  disabled={ro || mode !== "value"}
                  value={typeof v === "number" ? v : ""}
                  onChange={(e) => set({ [key]: Number(e.target.value) } as Partial<StandardRules>)}
                />
              </div>
            );
          })}
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Horário de atendimento</h3>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={ro}
              checked={hasSchedule}
              onChange={(e) =>
                e.target.checked
                  ? set({ schedule: { mode: "coleta", days: "seg-dom", time: "15:00" } })
                  : unset("schedule")
              }
            />
            Verificar horário
          </label>
          {hasSchedule ? (
            <div className="space-y-3">
              <select
                className="input"
                disabled={ro}
                value={scheduleMode}
                onChange={(e) => {
                  const mode = e.target.value as ScheduleRule["mode"];
                  set({
                    schedule: sched.map((rule) =>
                      mode === "coleta"
                        ? { mode, days: rule.days, time: rule.time ?? "15:00" }
                        : {
                            mode,
                            days: rule.days,
                            start: rule.start ?? "08:00",
                            end: rule.end ?? "18:00",
                          },
                    ),
                  });
                }}
              >
                <option value="coleta">Coleta</option>
                <option value="janela">Janela de envio</option>
              </select>
              {sched.map((rule, index) => (
                <div
                  key={index}
                  className={
                    "grid items-end gap-2 " +
                    (sched.length > 1
                      ? "sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                      : "sm:grid-cols-2")
                  }
                >
                  <label className="field-label">
                    Dia(s)
                    <select
                      className="input mt-1"
                      disabled={ro}
                      value={rule.days}
                      onChange={(e) =>
                        set({
                          schedule: sched.map((current, i) =>
                            i === index ? { ...current, days: e.target.value } : current,
                          ),
                        })
                      }
                    >
                      {POLICY_SCHEDULE_DAYS.map((day) => (
                        <option key={day} value={day}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </label>
                  {scheduleMode === "coleta" ? (
                    <label className="field-label">
                      Horário de coleta
                      <input
                        type="time"
                        className="input mt-1"
                        disabled={ro}
                        value={rule.time ?? ""}
                        onChange={(e) =>
                          set({
                            schedule: sched.map((current, i) =>
                              i === index ? { ...current, time: e.target.value } : current,
                            ),
                          })
                        }
                      />
                    </label>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <label className="field-label">
                        Início
                        <input
                          type="time"
                          className="input mt-1"
                          disabled={ro}
                          value={rule.start ?? ""}
                          onChange={(e) =>
                            set({
                              schedule: sched.map((current, i) =>
                                i === index ? { ...current, start: e.target.value } : current,
                              ),
                            })
                          }
                        />
                      </label>
                      <label className="field-label">
                        Fim
                        <input
                          type="time"
                          className="input mt-1"
                          disabled={ro}
                          value={rule.end ?? ""}
                          onChange={(e) =>
                            set({
                              schedule: sched.map((current, i) =>
                                i === index ? { ...current, end: e.target.value } : current,
                              ),
                            })
                          }
                        />
                      </label>
                    </div>
                  )}
                  {sched.length > 1 ? (
                    <button
                      type="button"
                      className="btn-ghost text-xs"
                      disabled={ro}
                      onClick={() =>
                        set({ schedule: sched.filter((_, i) => i !== index) })
                      }
                    >
                      Remover
                    </button>
                  ) : null}
                </div>
              ))}
              <button
                type="button"
                className="rounded-lg border border-primary px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
                disabled={ro}
                onClick={() =>
                  set({
                    schedule: [
                      ...sched,
                      scheduleMode === "coleta"
                        ? { mode: "coleta", days: "Todos os dias", time: "15:00" }
                        : {
                            mode: "janela",
                            days: "Todos os dias",
                            start: "08:00",
                            end: "18:00",
                          },
                    ],
                  })
                }
              >
                + Adicionar dia/horário
              </button>
            </div>
          ) : null}
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Entrega agendada</h3>
          <select
            className="input"
            disabled={ro}
            value={scd === undefined ? "skip" : scd.enabled ? "on" : "off"}
            onChange={(e) => {
              const m = e.target.value;
              if (m === "skip") unset("scheduled");
              else if (m === "off") set({ scheduled: { enabled: false } });
              else set({ scheduled: { enabled: true, maxDays: scd?.maxDays ?? 7, start: scd?.start ?? "08:00", end: scd?.end ?? "18:00" } });
            }}
          >
            <option value="skip">Não verificar</option>
            <option value="off">Desabilitada</option>
            <option value="on">Habilitada</option>
          </select>
          {scd?.enabled ? (
            <div className="space-y-3">
              <label className="field-label">
                Prazo máximo (dias)
                <input
                  type="number"
                  className="input mt-1"
                  disabled={ro}
                  value={scd.maxDays ?? ""}
                  onChange={(e) => set({ scheduled: { ...scd, maxDays: Number(e.target.value) } })}
                />
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="field-label">
                  Início da janela
                  <input
                    type="time"
                    className="input mt-1"
                    disabled={ro}
                    value={scd.start ?? ""}
                    onChange={(e) => set({ scheduled: { ...scd, start: e.target.value } })}
                  />
                </label>
                <label className="field-label">
                  Fim da janela
                  <input
                    type="time"
                    className="input mt-1"
                    disabled={ro}
                    value={scd.end ?? ""}
                    onChange={(e) => set({ scheduled: { ...scd, end: e.target.value } })}
                  />
                </label>
              </div>
              <label className="field-label">
                Verificação de capacidade
                <select
                  className="input mt-1"
                  disabled={ro}
                  value={
                    scd.capacityEnabled === undefined ? "skip" : scd.capacityEnabled ? "on" : "off"
                  }
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "skip") {
                      const next = { ...scd };
                      delete next.capacityEnabled;
                      delete next.unit;
                      delete next.windows;
                      set({ scheduled: next });
                      return;
                    }
                    const windows =
                      scd.windows ??
                      (availableCapacityDays[0]
                        ? [
                            {
                              days: availableCapacityDays[0],
                              capacity: 1,
                              additional: 0,
                              start: "08:00",
                              end: "18:00",
                            } satisfies ScheduledCapacityRule,
                          ]
                        : []);
                    set({
                      scheduled: {
                        ...scd,
                        capacityEnabled: value === "on",
                        unit: scd.unit ?? "Itens",
                        windows,
                      },
                    });
                  }}
                >
                  <option value="skip">Não verificar</option>
                  <option value="off">Desabilitada</option>
                  <option value="on">Habilitada</option>
                </select>
              </label>
              {scd.capacityEnabled ? (
                <div className="space-y-3 rounded-lg border border-border p-3">
                  <fieldset className="flex flex-wrap gap-4 text-sm">
                    <legend className="field-label mb-1">Unidade de capacidade</legend>
                    {(["Itens", "Pedidos"] as const).map((unit) => (
                      <label key={unit} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="standard-scheduled-unit"
                          disabled={ro}
                          checked={(scd.unit ?? "Itens") === unit}
                          onChange={() => set({ scheduled: { ...scd, unit } })}
                        />
                        {unit}
                      </label>
                    ))}
                  </fieldset>
                  {(scd.windows ?? []).map((window, index) => {
                    const selected = normalizeDaySelection(window.days);
                    return (
                    <div key={`${formatDaySelection(window.days)}-${index}`} className="space-y-2 rounded-md border border-border p-3">
                      <div className="flex flex-wrap gap-2">
                        {DAY_GROUPS.map((day) => {
                          const occupied = scd.windows?.some(
                            (other, otherIndex) =>
                              otherIndex !== index && normalizeDaySelection(other.days).includes(day),
                          );
                          const selectedDay = selected.includes(day);
                          return (
                            <button
                              key={day}
                              type="button"
                              disabled={ro || (occupied && !selectedDay)}
                              onClick={() =>
                                set({
                                  scheduled: {
                                    ...scd,
                                    windows: (scd.windows ?? []).map((current, currentIndex) => {
                                      if (currentIndex !== index) return current;
                                      const currentSelected = normalizeDaySelection(current.days);
                                      const nextSelected = selectedDay
                                        ? currentSelected.filter((item) => item !== day)
                                        : [...currentSelected, day];
                                      return {
                                        ...current,
                                        days: nextSelected.length ? nextSelected : currentSelected,
                                      };
                                    }),
                                  },
                                })
                              }
                              className={
                                "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
                                (selectedDay
                                  ? "border-primary bg-primary/10 text-primary"
                                  : occupied
                                    ? "border-border text-muted-foreground opacity-40"
                                    : "border-border hover:bg-muted/60")
                              }
                            >
                              {day}
                            </button>
                          );
                        })}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="field-label">
                          Capacidade ({scd.unit ?? "Itens"})
                          <input
                            type="number"
                            min={1}
                            className="input mt-1"
                            disabled={ro}
                            value={window.capacity}
                            onChange={(e) =>
                              set({
                                scheduled: {
                                  ...scd,
                                  windows: (scd.windows ?? []).map((current, currentIndex) =>
                                    currentIndex === index
                                      ? { ...current, capacity: Number(e.target.value) }
                                      : current,
                                  ),
                                },
                              })
                            }
                          />
                        </label>
                        <label className="field-label">
                          Valor adicional (R$)
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            className="input mt-1"
                            disabled={ro}
                            value={window.additional}
                            onChange={(e) =>
                              set({
                                scheduled: {
                                  ...scd,
                                  windows: (scd.windows ?? []).map((current, currentIndex) =>
                                    currentIndex === index
                                      ? { ...current, additional: Number(e.target.value) }
                                      : current,
                                  ),
                                },
                              })
                            }
                          />
                        </label>
                        <label className="field-label">
                          Horário de início
                          <input
                            type="time"
                            className="input mt-1"
                            disabled={ro}
                            value={window.start}
                            onChange={(e) =>
                              set({
                                scheduled: {
                                  ...scd,
                                  windows: (scd.windows ?? []).map((current, currentIndex) =>
                                    currentIndex === index
                                      ? { ...current, start: e.target.value }
                                      : current,
                                  ),
                                },
                              })
                            }
                          />
                        </label>
                        <label className="field-label">
                          Horário de término
                          <input
                            type="time"
                            className="input mt-1"
                            disabled={ro}
                            value={window.end}
                            onChange={(e) =>
                              set({
                                scheduled: {
                                  ...scd,
                                  windows: (scd.windows ?? []).map((current, currentIndex) =>
                                    currentIndex === index
                                      ? { ...current, end: e.target.value }
                                      : current,
                                  ),
                                },
                              })
                            }
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        className="btn-ghost text-xs text-danger"
                        disabled={ro}
                        onClick={() =>
                          set({
                            scheduled: {
                              ...scd,
                              windows: (scd.windows ?? []).filter((_, currentIndex) => currentIndex !== index),
                            },
                          })
                        }
                      >
                        Remover janela
                      </button>
                    </div>
                    );
                  })}
                  <button
                    type="button"
                    className="rounded-lg border border-primary px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-40"
                    disabled={ro || availableCapacityDays.length === 0}
                    onClick={() => {
                      const day = availableCapacityDays[0] as DayGroup | undefined;
                      if (!day) return;
                      set({
                        scheduled: {
                          ...scd,
                          windows: [
                            ...(scd.windows ?? []),
                            {
                              days: [day],
                              capacity: 1,
                              additional: 0,
                              start: "08:00",
                              end: "18:00",
                            },
                          ],
                        },
                      });
                    }}
                  >
                    + Adicionar janela de capacidade
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Fins de semana e itens</h3>
          {FLAGS.map(([key, label]) => (
            <div key={key} className="grid grid-cols-[1fr_10rem] items-center gap-2 text-sm">
              <span>{label}</span>
              <select
                className="input"
                disabled={ro}
                value={form[key] === undefined ? "skip" : form[key] ? "on" : "off"}
                onChange={(e) => {
                  const m = e.target.value;
                  if (m === "skip") unset(key);
                  else set({ [key]: m === "on" } as Partial<StandardRules>);
                }}
              >
                <option value="skip">Não verificar</option>
                <option value="on">Habilitado</option>
                <option value="off">Desabilitado</option>
              </select>
            </div>
          ))}
          <div className="grid grid-cols-[1fr_10rem] items-center gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                disabled={ro}
                checked={form.minItems !== undefined}
                onChange={(e) => (e.target.checked ? set({ minItems: 1 }) : unset("minItems"))}
              />
              Mínimo de itens
            </label>
            <input
              type="number"
              className="input"
              disabled={ro || form.minItems === undefined}
              value={form.minItems ?? ""}
              onChange={(e) => set({ minItems: Number(e.target.value) })}
            />
          </div>
        </section>

        {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}

        {canEdit ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
            {scope && resolved.origin === "loja" ? (
              <button type="button" disabled={busy} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/60" onClick={() => void onUseGeneral()}>
                Restaurar para padrão geral
              </button>
            ) : null}
            {!scope && factory ? (
              <button type="button" disabled={busy} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/60" onClick={() => void onFactory()}>
                Restaurar padrão inicial
              </button>
            ) : null}
            <button type="button" disabled={busy || !modality} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90" onClick={() => void onSave()}>
              {busy ? "Salvando..." : "Salvar"}
            </button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Somente o perfil Editor pode alterar os padrões.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
