/**
 * CAPACIDADE OPERACIONAL — CÁLCULO DE OCUPAÇÃO ATÉ D+3
 * =====================================================
 *
 * Unidade sempre em pedidos. Para cada política comercial, a capacidade do dia
 * vem do limite configurado para aquele dia da semana. O que ultrapassa o
 * limite do dia é alocado nos dias seguintes (regra "continuar a receber
 * pedidos"), respeitando o horizonte fixo de D+3.
 */

import {
  CAPACITY_HORIZON_DAYS,
  weekdayKeyOf,
  type CapacityLimits,
  type CapacityPolicyDto,
  type CapacityStoreDto,
} from "./capacity-remote.functions";

export interface DayBucket {
  /** yyyy-mm-dd */
  day: string;
  date: Date;
  /** 0 = hoje, 1 = D+1 ... */
  offset: number;
  capacity: number;
  /** Pedidos gerados no próprio dia e alocados nele */
  own: number;
  /** Pedidos transbordados de dias anteriores */
  carried: number;
  used: number;
  remaining: number;
  utilization: number;
  full: boolean;
}

export interface PolicyProjection {
  policy: string;
  enabled: boolean;
  limits: CapacityLimits;
  days: DayBucket[];
  /** Pedidos que não couberam em nenhum dia até D+3 */
  unallocated: number;
}

export interface StoreProjection {
  storeId: string;
  store: string;
  region: string;
  status: "active" | "paused";
  unlimited: boolean;
  overflowRule: CapacityStoreDto["overflowRule"];
  policies: PolicyProjection[];
  totals: DayBucket[];
  exceeded: boolean;
  /** Ocupação de hoje somando todas as políticas */
  todayUtilization: number;
}

export function isoDay(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function horizonDates(today = new Date()): Date[] {
  const base = new Date(today);
  base.setHours(0, 0, 0, 0);
  return Array.from({ length: CAPACITY_HORIZON_DAYS + 1 }, (_, i) => {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    return d;
  });
}

export const DAY_LABELS = ["Hoje", "D+1", "D+2", "D+3"];

function emptyBucket(date: Date, offset: number, capacity: number): DayBucket {
  return {
    day: isoDay(date),
    date,
    offset,
    capacity,
    own: 0,
    carried: 0,
    used: 0,
    remaining: capacity,
    utilization: 0,
    full: capacity > 0 ? false : true,
  };
}

function finalize(b: DayBucket) {
  b.used = b.own + b.carried;
  b.remaining = Math.max(0, b.capacity - b.used);
  b.utilization = b.capacity > 0 ? (b.used / b.capacity) * 100 : b.used > 0 ? 100 : 0;
  b.full = b.capacity > 0 ? b.used >= b.capacity : true;
}

/** Projeta a ocupação de uma política ao longo dos 4 dias do horizonte. */
export function projectPolicy(
  policy: CapacityPolicyDto,
  ordersByDay: Map<string, number>,
  dates: Date[],
  opts: { unlimited: boolean; spill: boolean },
): PolicyProjection {
  const buckets = dates.map((date, i) =>
    emptyBucket(date, i, opts.unlimited ? Number.POSITIVE_INFINITY : policy.limits[weekdayKeyOf(date)]),
  );

  let unallocated = 0;
  for (let i = 0; i < buckets.length; i++) {
    const bucket = buckets[i]!;
    let incoming = ordersByDay.get(bucket.day) ?? 0;
    const free = Math.max(0, bucket.capacity - bucket.used);
    const fits = Math.min(incoming, free);
    bucket.own += fits;
    incoming -= fits;
    finalize(bucket);

    if (incoming > 0) {
      if (!opts.spill) {
        // Sem transbordo: pausa no fim do dia, o excedente fica marcado
        bucket.own += incoming;
        finalize(bucket);
        continue;
      }
      let rest = incoming;
      for (let j = i + 1; j < buckets.length && rest > 0; j++) {
        const next = buckets[j]!;
        const room = Math.max(0, next.capacity - next.used);
        const take = Math.min(rest, room);
        next.carried += take;
        rest -= take;
        finalize(next);
      }
      unallocated += rest;
    }
  }

  return {
    policy: policy.policy,
    enabled: policy.enabled,
    limits: policy.limits,
    days: buckets,
    unallocated,
  };
}

/** Projeta a ocupação de uma loja inteira (todas as políticas + total). */
export function projectStore(dto: CapacityStoreDto, today = new Date()): StoreProjection {
  const dates = horizonDates(today);
  const spill = dto.overflowRule === "continue_next_days";

  const byPolicy = new Map<string, Map<string, number>>();
  for (const c of dto.consumption) {
    const m = byPolicy.get(c.policy) ?? new Map<string, number>();
    m.set(c.day, (m.get(c.day) ?? 0) + c.orders);
    byPolicy.set(c.policy, m);
  }

  const policies = dto.policies.map((p) =>
    projectPolicy(p, byPolicy.get(p.policy) ?? new Map(), dates, {
      unlimited: dto.unlimited,
      spill,
    }),
  );

  const totals = dates.map((date, i) => {
    const b = emptyBucket(date, i, 0);
    for (const p of policies) {
      const d = p.days[i]!;
      b.capacity += Number.isFinite(d.capacity) ? d.capacity : 0;
      b.own += d.own;
      b.carried += d.carried;
    }
    finalize(b);
    return b;
  });

  const exceeded =
    policies.some((p) => p.unallocated > 0) ||
    totals.some((t) => t.capacity > 0 && t.used > t.capacity);

  return {
    storeId: dto.storeId,
    store: dto.store,
    region: dto.region,
    status: dto.status,
    unlimited: dto.unlimited,
    overflowRule: dto.overflowRule,
    policies,
    totals,
    exceeded,
    todayUtilization: totals[0]?.utilization ?? 0,
  };
}

export function formatDay(date: Date): string {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function weekdayName(date: Date): string {
  return date.toLocaleDateString("pt-BR", { weekday: "long" });
}
