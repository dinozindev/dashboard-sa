/**
 * CAPACIDADE DE ENTREGA (entrega agendada)
 * Regras puras: quais dias aparecem, com qual capacidade e horário, a partir da
 * política de envio e dos feriados. Dias anteriores a hoje nunca são recalculados.
 */
import { normalizeDaySelection, type ShippingPolicyDraft, type DayGroup } from "./policy-registry";

export const SCHEDULED_MODALITIES = [
  "Entrega Agendada",
  "Entrega Conforto Manhã",
  "Entrega Conforto Tarde",
  "Retira Televendas",
] as const;

export interface Holiday {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  scope: "nacional" | "estadual";
  state: string | null;
}

export interface CapacityDay {
  day: string; // YYYY-MM-DD
  modality: string;
  deliveryTime: string;
  capacity: number;
}

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function addDays(iso: string, n: number): string {
  const [y = 0, m = 1, d = 1] = iso.split("-").map(Number);
  return isoDate(new Date(y, m - 1, d + n));
}

export function formatBr(iso: string, short = false): string {
  const [y, m, d] = iso.split("-");
  return short ? `${d}/${m}` : `${d}/${m}/${y}`;
}

function groupOf(iso: string): DayGroup {
  const [y = 0, m = 1, d = 1] = iso.split("-").map(Number);
  const wd = new Date(y, m - 1, d).getDay();
  return wd === 0 ? "Domingo" : wd === 6 ? "Sábado" : "Segunda a sexta-feira";
}

export function holidayOn(iso: string, region: string, holidays: Holiday[]): Holiday | null {
  return (
    holidays.find((h) => {
      const end = h.end_date || h.start_date;
      if (iso < h.start_date || iso > end) return false;
      return h.scope === "nacional" || (h.state ?? "").toUpperCase() === region.toUpperCase();
    }) ?? null
  );
}

/** Dia configurado na política (ou null se o dia não foi definido / é feriado). */
export function expectedDay(
  policy: ShippingPolicyDraft,
  modality: string,
  iso: string,
  region: string,
  holidays: Holiday[],
): CapacityDay | null {
  const s = policy.scheduledDelivery;
  if (!s?.enabled || !s.capacityEnabled) return null;
  if (holidayOn(iso, region, holidays)) return null;
  const g = groupOf(iso);
  const w = s.windows.find((x) => normalizeDaySelection(x.days).includes(g));
  if (!w) return null;
  return { day: iso, modality, deliveryTime: `${w.start} - ${w.end}`, capacity: w.capacity };
}

export function nextScheduledDays(
  start: string,
  count: number,
  modalities: readonly string[],
  policies: ReadonlyMap<string, ShippingPolicyDraft>,
  region: string,
  holidays: Holiday[],
): string[] {
  const hasSchedule = modalities.some((modality) => {
    const scheduled = policies.get(modality)?.scheduledDelivery;
    return (
      scheduled?.enabled &&
      scheduled.capacityEnabled &&
      scheduled.windows.some((window) => normalizeDaySelection(window.days).length > 0)
    );
  });
  if (!hasSchedule || count <= 0) return [];

  const lastHoliday = holidays
    .filter(
      (holiday) =>
        holiday.scope === "nacional" ||
        (holiday.state ?? "").toUpperCase() === region.toUpperCase(),
    )
    .reduce((last, holiday) => {
      const end = holiday.end_date || holiday.start_date;
      return end > last ? end : last;
    }, start);
  const searchEnd = addDays(lastHoliday, count * 7);
  const result: string[] = [];

  for (let day = start; day <= searchEnd && result.length < count; day = addDays(day, 1)) {
    if (
      modalities.some((modality) => {
        const policy = policies.get(modality);
        return policy && expectedDay(policy, modality, day, region, holidays);
      })
    ) {
      result.push(day);
    }
  }

  return result;
}
