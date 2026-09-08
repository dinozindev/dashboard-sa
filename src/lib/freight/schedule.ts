import type { Modality, StoreName } from "./types";

export type DayKey = "seg" | "ter" | "qua" | "qui" | "sex" | "sab" | "dom" | "feriado";

export const DAY_LABEL: Record<DayKey, string> = {
  seg: "Seg",
  ter: "Ter",
  qua: "Qua",
  qui: "Qui",
  sex: "Sex",
  sab: "Sáb",
  dom: "Dom",
  feriado: "Feriado",
};

export const DAY_ORDER: DayKey[] = ["seg", "ter", "qua", "qui", "sex", "sab", "dom", "feriado"];

type Grid = Record<DayKey, { open: string; close: string }>;

const g = (
  weekday: [string, string],
  sat: [string, string],
  sun: [string, string],
  holiday: [string, string],
): Grid => ({
  seg: { open: weekday[0], close: weekday[1] },
  ter: { open: weekday[0], close: weekday[1] },
  qua: { open: weekday[0], close: weekday[1] },
  qui: { open: weekday[0], close: weekday[1] },
  sex: { open: weekday[0], close: weekday[1] },
  sab: { open: sat[0], close: sat[1] },
  dom: { open: sun[0], close: sun[1] },
  feriado: { open: holiday[0], close: holiday[1] },
});

/** Regra 15 — grade de horários (configuração, separada da lógica de preço). */
export const SCHEDULES: Record<Modality, Partial<Record<StoreName, Grid>>> = {
  Retira: {
    Aricanduva: g(["07:00", "22:00"], ["07:00", "22:00"], ["09:00", "19:00"], ["09:00", "19:00"]),
    Suzano: g(["07:00", "21:00"], ["07:00", "21:00"], ["09:00", "17:00"], ["08:00", "20:00"]),
  },
  Entrega: {
    Aricanduva: g(["07:00", "16:00"], ["07:00", "16:00"], ["09:00", "16:00"], ["09:00", "16:00"]),
    Suzano: g(["07:00", "16:00"], ["07:00", "16:00"], ["09:00", "16:00"], ["08:00", "16:00"]),
  },
};

/** Feriados configuráveis (YYYY-MM-DD). Vazio por padrão — nada é inventado. */
export const HOLIDAYS: string[] = [];

const WEEK: DayKey[] = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

export function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function currentDayKey(now: Date, holidays: string[] = HOLIDAYS): DayKey {
  if (holidays.includes(isoDate(now))) return "feriado";
  return WEEK[now.getDay()] ?? "seg";
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

export interface OpenStatus {
  dayKey: DayKey;
  open: string;
  close: string;
  isOpen: boolean;
}

export function getStatus(
  store: StoreName,
  modality: Modality,
  now: Date,
  holidays: string[] = HOLIDAYS,
  const dayKey = currentDayKey(now, holidays);
  const { open, close } = SCHEDULES[modality][store][dayKey];
  const mins = now.getHours() * 60 + now.getMinutes();
  return { dayKey, open, close, isOpen: mins >= toMin(open) && mins < toMin(close) };
}
