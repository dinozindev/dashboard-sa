/**
 * CAPACIDADE OPERACIONAL
 * =======================
 * 
 * Regra 16 do documento: Dados de capacidade de entrega.
 * Usado para calcular utilização e alertar quando próximo do limite.
 */

import type { StoreName } from "./types";

/**
 * Parâmetros de capacidade operacional de uma loja.
 * 
 * @param vehicles - Número de veículos disponíveis
 * @param perVehicle - Entregas por veículo (por dia)
 * @param dailyDemand - Demanda esperada (entregas/dia)
 * @param operatingDays - Dias de operação (típico 6, seg-sab)
 */
export interface CapacityInput {
  vehicles: number;
  perVehicle: number;
  dailyDemand: number;
  operatingDays: number;
}

/**
 * Dados base de capacidade por loja.
 * 
 * Aricanduva: 12 veículos × 5 entregas = 60/dia; demanda 52/dia
 * Suzano:      8 veículos × 5 entregas = 40/dia; demanda 31/dia
 * 
 * Outras lojas não têm dados operacionais configurados.
 */
export const CAPACITY_BASE: Partial<Record<StoreName, CapacityInput>> = {
  Aricanduva: { vehicles: 12, perVehicle: 5, dailyDemand: 52, operatingDays: 6 },
  Suzano: { vehicles: 8, perVehicle: 5, dailyDemand: 31, operatingDays: 6 },
};

/**
 * Threshold (%) acima do qual alertar que a loja está saturada.
 * Exemplo: 85% utilização = aviso de capacidade próxima.
 */
export const UTILIZATION_ALERT = 85;

/**
 * Calcula métricas de capacidade a partir dos parâmetros.
 * 
 * Retorna:
 * - daily: capacidade total (veículos × perVehicle)
 * - utilization: % de ocupação (demanda / capacidade)
 * - available: slots livres (capacidade - demanda)
 * - weekly: capacidade semanal (capacidade × dias operação)
 * - atRisk: boolean se utilização > UTILIZATION_ALERT
 * 
 * @param input - CapacityInput
 * @returns Métricas calculadas
 */
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
