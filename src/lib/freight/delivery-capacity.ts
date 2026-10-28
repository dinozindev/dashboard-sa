/**
 * CAPACIDADE DE ENTREGA (entrega agendada)
 * Regras puras: quais dias aparecem, com qual capacidade e horário, a partir da
 * política de envio. Dias bloqueados por feriado/inventário também contam no período.
 * Dias anteriores a hoje nunca são recalculados.
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
  scope: "nacional" | "estadual" | "municipal";
  /** lojas abrangidas por feriados municipais */
  store_ids?: string[] | null;
  state: string | null;
  /** feriado: recorre todos os anos; inventario: vale apenas no ano definido */
  kind: "feriado" | "inventario";
  /** loja específica para inventários (null para feriados gerais) */
  store_id: string | null;
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

function scheduledWindow(
  policy: ShippingPolicyDraft,
  iso: string,
  holiday?: Holiday | null,
) {
  const scheduled = policy.scheduledDelivery;
  if (!scheduled?.enabled || !scheduled.capacityEnabled) return null;
  if (holiday?.kind === "inventario") return null;
  const group = holiday ? "Feriado" : groupOf(iso);
  return (
    scheduled.windows.find((window) => normalizeDaySelection(window.days).includes(group)) ?? null
  );
}

export function holidayOn(
  iso: string,
  region: string,
  holidays: Holiday[],
  storeId?: string,
): Holiday | null {
  return (
    holidays.find((h) => {
      if (h.store_id) {
        // Inventário por loja: aplica-se apenas à loja selecionada
        if (h.store_id !== storeId) return false;
      } else if (h.scope === "municipal") {
        // Feriado municipal: aplica-se apenas às lojas selecionadas
        if (!storeId || !(h.store_ids ?? []).includes(storeId)) return false;
      } else if (h.scope !== "nacional" && (h.state ?? "").toUpperCase() !== region.toUpperCase()) {
        return false;
      }
      const end = h.end_date || h.start_date;
      if (h.kind === "inventario") {
        // Inventário vale apenas no ano em que foi definido.
        return iso >= h.start_date && iso <= end;
      }
      // Feriado recorre todos os anos: compara apenas mês e dia.
      const md = iso.slice(5);
      const s = h.start_date.slice(5);
      const e = end.slice(5);
      return s <= e ? md >= s && md <= e : md >= s || md <= e; // virada de ano (ex.: 25/12–05/01)
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
  storeId?: string,
): CapacityDay | null {
  const holiday = holidayOn(iso, region, holidays, storeId);
  const w = scheduledWindow(policy, iso, holiday);
  if (!w) return null;
  return { day: iso, modality, deliveryTime: `${w.start} - ${w.end}`, capacity: w.capacity };
}

export function nextScheduledDays(
  start: string,
  count: number,
  modalities: readonly string[],
  policies: ReadonlyMap<string, ShippingPolicyDraft>,
  region = "",
  holidays: readonly Holiday[] = [],
  storeId?: string,
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

  const result: string[] = [];

  for (let day = start; result.length < count; day = addDays(day, 1)) {
    if (
      modalities.some((modality) => {
        const policy = policies.get(modality);
        const holiday = holidayOn(day, region, holidays as Holiday[], storeId);
        return (
          policy &&
          (scheduledWindow(policy, day, null) ||
            (holiday?.kind === "feriado" && scheduledWindow(policy, day, holiday)))
        );
      })
    ) {
      result.push(day);
    }
  }

  return result;
}
