/**
 * CAPACIDADE OPERACIONAL — FUNÇÕES DE SERVIDOR
 * ============================================
 *
 * Cada loja cadastrada tem uma configuração de capacidade (status, regra ao
 * atingir o limite) e uma ou mais políticas comerciais. A política principal
 * (Ecommerce) é obrigatória. A unidade é sempre "pedidos" e os limites são
 * definidos dia a dia da semana. O acompanhamento vai sempre até D+3.
 */

import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

function publicClient() {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/** Políticas comerciais suportadas. A primeira é a obrigatória. */
export const COMMERCIAL_POLICIES = [
  "Ecommerce",
  "Televendas",
  "Venda Assistida",
  "App",
] as const;
export type CommercialPolicy = (typeof COMMERCIAL_POLICIES)[number];

/** Política principal: sempre presente e não removível. */
export const PRIMARY_POLICY: CommercialPolicy = "Ecommerce";

/** Horizonte fixo de acompanhamento e transbordo: hoje + 3 dias. */
export const CAPACITY_HORIZON_DAYS = 3;

/** Dias passados mantidos no consumo para o histórico de excedentes. */
export const CAPACITY_HISTORY_DAYS = 30;

export type WeekdayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export const WEEKDAYS: Array<{ key: WeekdayKey; label: string; short: string }> = [
  { key: "mon", label: "Segunda-feira", short: "Seg" },
  { key: "tue", label: "Terça-feira", short: "Ter" },
  { key: "wed", label: "Quarta-feira", short: "Qua" },
  { key: "thu", label: "Quinta-feira", short: "Qui" },
  { key: "fri", label: "Sexta-feira", short: "Sex" },
  { key: "sat", label: "Sábado", short: "Sáb" },
  { key: "sun", label: "Domingo", short: "Dom" },
];

export type CapacityLimits = Record<WeekdayKey, number>;

export const EMPTY_LIMITS: CapacityLimits = {
  mon: 0,
  tue: 0,
  wed: 0,
  thu: 0,
  fri: 0,
  sat: 0,
  sun: 0,
};

/** Limites iniciais de uma loja recém-criada: 10 pedidos por dia, domingo fechado. */
export const DEFAULT_LIMITS: CapacityLimits = {
  mon: 10,
  tue: 10,
  wed: 10,
  thu: 10,
  fri: 10,
  sat: 10,
  sun: 0,
};


export function normalizeLimits(value: unknown): CapacityLimits {
  const raw = (value ?? {}) as Record<string, unknown>;
  const out = { ...EMPTY_LIMITS };
  for (const { key } of WEEKDAYS) {
    const n = Number(raw[key]);
    out[key] = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }
  return out;
}

/** Ordem JS de getDay() (0 = domingo) mapeada para as chaves de limite. */
const JS_DAY_TO_KEY: WeekdayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function weekdayKeyOf(date: Date): WeekdayKey {
  return JS_DAY_TO_KEY[date.getDay()]!;
}

export interface CapacityPolicyDto {
  id: string;
  policy: CommercialPolicy;
  isPrimary: boolean;
  enabled: boolean;
  limits: CapacityLimits;
}

export interface CapacityStoreDto {
  storeId: string;
  store: string;
  region: string;
  status: "active" | "paused";
  unlimited: boolean;
  overflowRule: "continue_next_days" | "pause_until_end_of_day";
  overflowDays: number;
  policies: CapacityPolicyDto[];
  /** Consumo bruto por política e dia (yyyy-mm-dd). */
  consumption: Array<{ policy: string; day: string; orders: number; carriedOver: number }>;
}

/** Lê a configuração e o consumo de capacidade de todas as lojas. */
export const getCapacityOverview = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ stores: CapacityStoreDto[] }> => {
    const supabase = publicClient();

    const [storesRes, settingsRes, policiesRes] = await Promise.all([
      supabase.from("stores").select("id,name,region").order("name"),
      supabase.from("capacity_settings").select("*"),
      supabase.from("capacity_policies").select("*"),
    ]);
    fail(storesRes.error);
    fail(settingsRes.error);
    fail(policiesRes.error);

    // Auto-criação: nenhuma loja pode ficar sem configuração nem sem a
    // política principal (Ecommerce). Se faltar, criamos agora e persistimos.
    const allStores = storesRes.data ?? [];
    const settingsRows = [...(settingsRes.data ?? [])];
    const policyRows = [...(policiesRes.data ?? [])];

    const haveSettings = new Set(settingsRows.map((s) => s.store_id as string));
    const havePrimary = new Set(
      policyRows.filter((p) => p.policy === PRIMARY_POLICY).map((p) => p.store_id as string),
    );

    const missingSettings = allStores
      .map((s) => s.id as string)
      .filter((id) => !haveSettings.has(id));
    const missingPrimary = allStores
      .map((s) => s.id as string)
      .filter((id) => !havePrimary.has(id));

    if (missingSettings.length) {
      const ins = await supabase
        .from("capacity_settings")
        .upsert(
          missingSettings.map((store_id) => ({ store_id })),
          { onConflict: "store_id" },
        )
        .select("*");
      fail(ins.error);
      settingsRows.push(...(ins.data ?? []));
    }

    if (missingPrimary.length) {
      const ins = await supabase
        .from("capacity_policies")
        .upsert(
          missingPrimary.map((store_id) => ({
            store_id,
            policy: PRIMARY_POLICY,
            is_primary: true,
            enabled: true,
            limits: DEFAULT_LIMITS,
          })),
          { onConflict: "store_id,policy" },
        )
        .select("*");
      fail(ins.error);
      policyRows.push(...(ins.data ?? []));
    }


    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const to = new Date(today);
    to.setDate(to.getDate() + CAPACITY_HORIZON_DAYS);
    const historyStart = new Date(today);
    historyStart.setDate(historyStart.getDate() - (CAPACITY_HISTORY_DAYS - 1));
    const iso = (d: Date) => d.toISOString().slice(0, 10);

    const consRes = await supabase
      .from("capacity_consumption")
      .select("store_id,policy,day,orders,carried_over")
      .gte("day", iso(historyStart))
      .lte("day", iso(to));
    fail(consRes.error);

    const settingsByStore = new Map(settingsRows.map((s) => [s.store_id as string, s]));
    const policiesByStore = new Map<string, CapacityPolicyDto[]>();
    for (const p of policyRows) {
      const list = policiesByStore.get(p.store_id as string) ?? [];
      list.push({
        id: p.id as string,
        policy: p.policy as CommercialPolicy,
        isPrimary: Boolean(p.is_primary),
        enabled: Boolean(p.enabled),
        limits: normalizeLimits(p.limits),
      });
      policiesByStore.set(p.store_id as string, list);
    }
    const consByStore = new Map<string, CapacityStoreDto["consumption"]>();
    for (const c of consRes.data ?? []) {
      const list = consByStore.get(c.store_id as string) ?? [];
      list.push({
        policy: c.policy as string,
        day: c.day as string,
        orders: Number(c.orders) || 0,
        carriedOver: Number(c.carried_over) || 0,
      });
      consByStore.set(c.store_id as string, list);
    }

    const stores: CapacityStoreDto[] = (storesRes.data ?? []).map((s) => {
      const id = s.id as string;
      const cfg = settingsByStore.get(id);
      const list = (policiesByStore.get(id) ?? []).sort((a, b) =>
        a.isPrimary === b.isPrimary
          ? COMMERCIAL_POLICIES.indexOf(a.policy) - COMMERCIAL_POLICIES.indexOf(b.policy)
          : a.isPrimary
            ? -1
            : 1,
      );
      return {
        storeId: id,
        store: s.name as string,
        region: (s.region as string) ?? "",
        status: (cfg?.status as "active" | "paused") ?? "active",
        unlimited: Boolean(cfg?.unlimited),
        overflowRule:
          (cfg?.overflow_rule as CapacityStoreDto["overflowRule"]) ?? "continue_next_days",
        overflowDays: Number(cfg?.overflow_days) || CAPACITY_HORIZON_DAYS,
        policies: list,
        consumption: consByStore.get(id) ?? [],
      };
    });

    return { stores };
  },
);

/** Ativa ou pausa a capacidade de uma ou mais lojas. */
export const setCapacityStatus = createServerFn({ method: "POST" })
  .inputValidator((input: { storeIds: string[]; status: "active" | "paused" }) => input)
  .handler(async ({ data }) => {
    if (!data.storeIds.length) return { ok: true };
    const supabase = publicClient();
    fail(
      (
        await supabase
          .from("capacity_settings")
          .update({ status: data.status, updated_at: new Date().toISOString() })
          .in("store_id", data.storeIds)
      ).error,
    );
    return { ok: true };
  });

/** Salva as configurações de capacidade de uma loja (regra + políticas). */
export const saveCapacityConfig = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      storeId: string;
      unlimited: boolean;
      overflowRule: "continue_next_days" | "pause_until_end_of_day";
      policies: Array<{ policy: CommercialPolicy; enabled: boolean; limits: CapacityLimits }>;
    }) => input,
  )
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const now = new Date().toISOString();

    fail(
      (
        await supabase.from("capacity_settings").upsert(
          {
            store_id: data.storeId,
            unlimited: data.unlimited,
            overflow_rule: data.overflowRule,
            overflow_days: CAPACITY_HORIZON_DAYS,
            updated_at: now,
          },
          { onConflict: "store_id" },
        )
      ).error,
    );

    // A política principal é sempre obrigatória
    const incoming = data.policies.filter((p) => COMMERCIAL_POLICIES.includes(p.policy));
    if (!incoming.some((p) => p.policy === PRIMARY_POLICY)) {
      throw new Error("A política Ecommerce é obrigatória e não pode ser removida.");
    }

    fail(
      (
        await supabase.from("capacity_policies").upsert(
          incoming.map((p) => ({
            store_id: data.storeId,
            policy: p.policy,
            is_primary: p.policy === PRIMARY_POLICY,
            enabled: p.policy === PRIMARY_POLICY ? true : p.enabled,
            limits: normalizeLimits(p.limits),
            updated_at: now,
          })),
          { onConflict: "store_id,policy" },
        )
      ).error,
    );

    const keep = incoming.map((p) => p.policy);
    fail(
      (
        await supabase
          .from("capacity_policies")
          .delete()
          .eq("store_id", data.storeId)
          .eq("is_primary", false)
          .not("policy", "in", `(${keep.map((k) => `"${k}"`).join(",")})`)
      ).error,
    );

    return { ok: true };
  });

/** Registra (ou ajusta) o consumo de pedidos de um dia para acompanhamento. */
export const setCapacityConsumption = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { storeId: string; policy: string; day: string; orders: number }) => input,
  )
  .handler(async ({ data }) => {
    const supabase = publicClient();
    fail(
      (
        await supabase.from("capacity_consumption").upsert(
          {
            store_id: data.storeId,
            policy: data.policy,
            day: data.day,
            orders: Math.max(0, Math.floor(data.orders)),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "store_id,policy,day" },
        )
      ).error,
    );
    return { ok: true };
  });
