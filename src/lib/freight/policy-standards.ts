/**
 * PADRÕES DAS POLÍTICAS DE ENVIO (aba "Padrão" da planilha Definição_Políticas.xlsx)
 * ==================================================================================
 *
 * Valores pré-estabelecidos para cada modalidade. Usados para sinalizar
 * quando uma política cadastrada está fora do padrão. A modalidade
 * "ENTREGA TLV_VA_FRETE GRATIS" não possui verificações por enquanto.
 *
 * Na planilha, "X" significa campo desabilitado/não aplicável — ou seja,
 * o padrão é que aquele campo NÃO esteja configurado.
 */

import type { ShippingPolicyDraft } from "./policy-registry";

export interface FieldStandard {
  /** Rótulo amigável do campo (como aparece no formulário). */
  label: string;
  /** Valor esperado em texto livre (para exibição). */
  expected: string;
  /** Verifica o rascunho; retorna true quando está DENTRO do padrão. */
  check: (draft: ShippingPolicyDraft) => boolean;
  /** Descreve o valor atual do rascunho (para exibição do alerta). */
  actual: (draft: ShippingPolicyDraft) => string;
}

export interface ModalityStandard {
  modality: string;
  fields: FieldStandard[];
}

const fmtNum = (n: number) => (n ? String(n) : "não informado");
const onOff = (b: boolean) => (b ? "habilitado" : "desabilitado");

/** Normaliza "seg-dom", "Seg - dom" etc. para comparação. */
const normDays = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");

const DAY_SETS: Record<string, string[]> = {
  segdom: ["seg", "ter", "qua", "qui", "sex", "sab", "dom"],
  segsab: ["seg", "ter", "qua", "qui", "sex", "sab"],
  segsexta: ["seg", "ter", "qua", "qui", "sex"],
};

const DAY_ALIASES: Record<string, string> = {
  seg: "seg",
  segunda: "seg",
  "segunda-feira": "seg",
  ter: "ter",
  terca: "ter",
  qua: "qua",
  quarta: "qua",
  qui: "qui",
  quinta: "qui",
  sex: "sex",
  sexta: "sex",
  sab: "sab",
  sabado: "sab",
  dom: "dom",
  domingo: "dom",
};

function expandDays(raw: string): string[] {
  const key = normDays(raw);
  for (const [setKey, days] of Object.entries(DAY_SETS)) {
    if (key === setKey || key === setKey + "sabado" || key.replace(/\s/g, "") === setKey) {
      return days;
    }
  }
  // combinações como "seg-sexta + sábado"
  const tokens = raw
    .toLowerCase()
    .split(/[^a-zá-ú-]+/i)
    .filter(Boolean);
  const out = new Set<string>();
  for (const token of tokens) {
    const alias = DAY_ALIASES[token.normalize("NFD").replace(/[̀-ͯ]/g, "")];
    if (alias) out.add(alias);
  }
  if (out.size) return [...out];
  return DAY_SETS["segdom"]!;
}

const dim = (
  label: string,
  expected: number | null,
  get: (d: ShippingPolicyDraft) => number,
): FieldStandard => ({
  label,
  expected: expected === null ? "desabilitado" : String(expected),
  check: (d) => (expected === null ? !get(d) : get(d) === expected),
  actual: (d) => (get(d) ? String(get(d)) : "desabilitado"),
});

const flag = (
  label: string,
  expected: boolean,
  get: (d: ShippingPolicyDraft) => boolean,
): FieldStandard => ({
  label,
  expected: onOff(expected),
  check: (d) => get(d) === expected,
  actual: (d) => onOff(get(d)),
});

/** Padrão de horário: modo "coleta" (horário único) ou "janela" (faixa por dia). */
function scheduleStandard(opts: {
  mode: "janela" | "coleta";
  days: string;
  start?: string;
  end?: string;
  time?: string;
}): FieldStandard {
  const expectedDays = expandDays(opts.days);
  const expectedLabel =
    opts.mode === "coleta"
      ? `Coleta ${opts.days} às ${opts.time}`
      : `Janela ${opts.days} ${opts.start}–${opts.end}`;
  return {
    label: opts.mode === "coleta" ? "Horário de coleta" : "Janela de envio",
    expected: expectedLabel,
    check: (d) => {
      if (d.scheduleMode !== opts.mode) return false;
      if (opts.mode === "coleta") {
        if (!d.pickupTimes.length) return false;
        return d.pickupTimes.every((p) => {
          const days = expandDays(p.day);
          return (
            p.time === opts.time &&
            expectedDays.every((day) => days.includes(day)) &&
            days.every((day) => expectedDays.includes(day))
          );
        });
      }
      if (!d.shippingWindows.length) return false;
      return d.shippingWindows.every((w) => {
        const days = expandDays(w.day);
        return (
          w.start === opts.start &&
          w.end === opts.end &&
          expectedDays.every((day) => days.includes(day)) &&
          days.every((day) => expectedDays.includes(day))
        );
      });
    },
    actual: (d) => {
      if (d.scheduleMode !== opts.mode) {
        return d.scheduleMode === "coleta" ? "configurado como coleta" : "configurado como janela";
      }
      if (opts.mode === "coleta") {
        const p = d.pickupTimes[0];
        return p ? `Coleta ${p.day} às ${p.time}` : "sem horário de coleta";
      }
      const w = d.shippingWindows[0];
      return w ? `Janela ${w.day} ${w.start}–${w.end}` : "sem janela de envio";
    },
  };
}

function scheduledStandard(opts: {
  enabled: boolean;
  maxDays?: number;
  start?: string;
  end?: string;
}): FieldStandard[] {
  if (!opts.enabled) {
    return [flag("Entrega agendada", false, (d) => d.scheduledDelivery.enabled)];
  }
  return [
    flag("Entrega agendada", true, (d) => d.scheduledDelivery.enabled),
    {
      label: "Tempo máximo de entrega",
      expected: `${opts.maxDays} dias`,
      check: (d) => !d.scheduledDelivery.enabled || d.scheduledDelivery.maxDays === opts.maxDays,
      actual: (d) =>
        d.scheduledDelivery.enabled ? `${d.scheduledDelivery.maxDays} dias` : "desabilitado",
    },
    {
      label: "Janela da entrega agendada",
      expected: `${opts.start}–${opts.end}`,
      check: (d) =>
        !d.scheduledDelivery.enabled ||
        (d.scheduledDelivery.windows.length > 0 &&
          d.scheduledDelivery.windows.every((w) => w.start === opts.start && w.end === opts.end)),
      actual: (d) => {
        const w = d.scheduledDelivery.windows[0];
        return d.scheduledDelivery.enabled && w ? `${w.start}–${w.end}` : "não configurada";
      },
    },
  ];
}

const minItems: FieldStandard = {
  label: "Mínimo de itens",
  expected: "1",
  check: (d) => d.packageItems.minimum === 1,
  actual: (d) => fmtNum(d.packageItems.minimum),
};

const coletaSegDom15 = scheduleStandard({ mode: "coleta", days: "seg-dom", time: "15:00" });

export const POLICY_STANDARDS: ModalityStandard[] = [
  {
    modality: "Pequenos Volumes",
    fields: [
      dim("Maior aresta", 220, (d) => d.dimensions.largestEdge),
      dim("Soma das dimensões", null, (d) => d.dimensions.sumOfDimensions),
      dim("Fator peso cúbico", null, (d) => d.dimensions.cubicWeightFactor),
      dim("Fator peso mínimo", null, (d) => d.dimensions.minimumWeightFactor),
      coletaSegDom15,
      minItems,
    ],
  },
  {
    modality: "Retira Fácil (Clique & Retira)",
    fields: [
      coletaSegDom15,
      flag("Entrega aos sábados", true, (d) => d.weekend.saturday),
      minItems,
    ],
  },
  {
    modality: "Retira Televendas",
    fields: [
      coletaSegDom15,
      ...scheduledStandard({ enabled: true, maxDays: 8, start: "08:00", end: "21:00" }),
      flag("Entrega aos sábados", true, (d) => d.weekend.saturday),
      minItems,
    ],
  },
  {
    modality: "Retira Imediata",
    fields: [
      scheduleStandard({ mode: "janela", days: "Seg-dom", start: "07:00", end: "21:00" }),
      flag("Entrega aos sábados", true, (d) => d.weekend.saturday),
      flag("Entrega aos domingos", true, (d) => d.weekend.sunday),
      flag("Entrega em feriados", true, (d) => d.weekend.holidays),
      minItems,
    ],
  },
  {
    modality: "Saldo Borderô",
    fields: [
      scheduleStandard({ mode: "janela", days: "Seg-dom", start: "00:00", end: "23:59" }),
      flag("Entrega aos sábados", true, (d) => d.weekend.saturday),
      flag("Entrega aos domingos", true, (d) => d.weekend.sunday),
      flag("Entrega em feriados", true, (d) => d.weekend.holidays),
      minItems,
    ],
  },
  {
    modality: "Retira H+4 Ecommerce",
    fields: [
      scheduleStandard({ mode: "janela", days: "Seg-sab", start: "07:00", end: "15:00" }),
      flag("Entrega aos sábados", true, (d) => d.weekend.saturday),
      minItems,
    ],
  },
  {
    modality: "Entrega Normal",
    fields: [coletaSegDom15, minItems],
  },
  {
    modality: "Entrega Conforto Manhã",
    fields: [
      scheduleStandard({ mode: "coleta", days: "Seg-sab", time: "15:00" }),
      ...scheduledStandard({ enabled: true, maxDays: 7, start: "08:00", end: "12:00" }),
      minItems,
    ],
  },
  {
    modality: "Entrega Conforto Tarde",
    fields: [
      scheduleStandard({ mode: "coleta", days: "seg-sab", time: "15:00" }),
      ...scheduledStandard({ enabled: true, maxDays: 7, start: "12:00", end: "18:00" }),
      minItems,
    ],
  },
  {
    modality: "Entrega Agendada",
    fields: [
      coletaSegDom15,
      ...scheduledStandard({ enabled: true, maxDays: 8, start: "07:00", end: "18:00" }),
      flag("Entrega aos sábados", true, (d) => d.weekend.saturday),
      minItems,
    ],
  },
];

export function standardForModality(modality: string): ModalityStandard | undefined {
  return POLICY_STANDARDS.find((s) => s.modality === modality);
}

export interface StandardDivergence {
  label: string;
  expected: string;
  actual: string;
}

/**
 * Compara um rascunho de política com o padrão da modalidade.
 * Retorna a lista de campos fora do padrão (vazia = tudo conforme).
 * Modalidades sem padrão definido (ex.: TLV_VA_FRETE GRATIS) retornam [].
 */
export function findDivergences(
  draft: ShippingPolicyDraft,
  modality: string,
): StandardDivergence[] {
  const standard = standardForModality(modality);
  if (!standard) return [];
  return standard.fields
    .filter((field) => !field.check(draft))
    .map((field) => ({
      label: field.label,
      expected: field.expected,
      actual: field.actual(draft),
    }));
}

/** True quando a política tem algum campo fora do padrão em qualquer modalidade. */
export function hasDivergences(draft: ShippingPolicyDraft): boolean {
  return draft.modalities.some((m) => findDivergences(draft, m).length > 0);
}
