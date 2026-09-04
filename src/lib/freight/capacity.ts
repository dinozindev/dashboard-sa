import type { StoreName } from "./types";

/** Regra 16 — dados de referência de capacidade operacional. */
export interface CapacityInput {
  vehicles: number;
  perVehicle: number;
  dailyDemand: number;
  operatingDays: number;
}

export const CAPACITY_BASE: Record<StoreName, CapacityInput> = {
  // 12 veículos x 5 entregas = 60/dia; demanda 52/dia; semanal 360 (6 dias operacionais)
  Aricanduva: { vehicles: 12, perVehicle: 5, dailyDemand: 52, operatingDays: 6 },
  // 8 veículos x 5 entregas = 40/dia; demanda 31/dia; semanal 240 (6 dias operacionais)
  Suzano: { vehicles: 8, perVehicle: 5, dailyDemand: 31, operatingDays: 6 },
};

export const UTILIZATION_ALERT = 85;

export function computeCapacity(input: CapacityInput) {
  const daily = input.vehicles * input.perVehicle;
  const utilization = daily > 0 ? (input.dailyDemand / daily) * 100 : 0;
  const weekly = daily * input.operatingDays;
  const weeklyDemand = input.dailyDemand * input.operatingDays;
  return {
    daily,
    dailyDemand: input.dailyDemand,
    utilization,
    available: daily - input.dailyDemand,
    weekly,
    weeklyDemand,
    weeklyIdle: weekly - weeklyDemand,
    atRisk: utilization > UTILIZATION_ALERT,
  };
}
