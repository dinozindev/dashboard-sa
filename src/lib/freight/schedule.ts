/**
 * CALENDÁRIO E HORÁRIOS DE OPERAÇÃO
 * ==================================
 * 
 * Regra 15 do documento: Horários de atendimento por modalidade (Entrega e Retira)
 * e por dia da semana. Suporta feriados customizáveis.
 * 
 * Estado independente da lógica de preço — separação de responsabilidades.
 */

import type { Modality, StoreName } from "./types";

// ============================================================================
// 1. TIPOS E ENUMS
// ============================================================================

/** Dias da semana + feriado */
export type DayKey = "seg" | "ter" | "qua" | "qui" | "sex" | "sab" | "dom" | "feriado";

/** Rótulos dos dias em português */
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

/** Ordem para exibição em tabela/UI */
export const DAY_ORDER: DayKey[] = ["seg", "ter", "qua", "qui", "sex", "sab", "dom", "feriado"];

// ============================================================================
// 2. GRADE DE HORÁRIOS
// ============================================================================

/** Tipo interno: horários para um dia específico */
type Grid = Record<DayKey, { open: string; close: string }>;

/**
 * Função auxiliar para criar grade de horários.
 * Simplifica a declaração de horários por reduzindo verbosidade.
 * 
 * @param weekday - [abertura, fechamento] seg-sex (HH:MM)
 * @param sat - [abertura, fechamento] sábado
 * @param sun - [abertura, fechamento] domingo
 * @param holiday - [abertura, fechamento] feriado
 * @returns Grid com todos os 8 dias (seg-dom + feriado)
 */
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

/**
 * Horários de funcionamento por modalidade e loja.
 * 
 * Estrutura: SCHEDULES[modalidade][loja] = grade de 8 dias
 * 
 * Exemplo:
 *   SCHEDULES["Entrega"]["Aricanduva"] = {
 *     seg: { open: "07:00", close: "16:00" },
 *     ter: { open: "07:00", close: "16:00" },
 *     ...
 *   }
 * 
 * Lojas ausentes = não tem operação configurada
 */
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

// ============================================================================
// 3. FERIADOS
// ============================================================================

/**
 * Lista de feriados (YYYY-MM-DD, formato ISO).
 * 
 * Vazio por padrão — nenhum feriado é inventado.
 * Admin pode adicionar via configuração.
 * 
 * Exemplo: ["2026-01-01", "2026-12-25", "2026-09-07"]
 */
export const HOLIDAYS: string[] = [];

// ============================================================================
// 4. MAPEAMENTO ORDEM DOS DIAS
// ============================================================================

/** Mapeamento: índice getDay() de Date → DayKey */
const WEEK: DayKey[] = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

// ============================================================================
// 5. FUNÇÕES DE FORMATAÇÃO E CONVERSÃO
// ============================================================================

/**
 * Formata Date como YYYY-MM-DD (ISO).
 * Usado para comparação com lista de feriados.
 * 
 * @param d - Date object
 * @returns String ISO 8601 date
 */
export function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Obtém o dia da semana para uma data, respeitando feriados.
 * 
 * @param now - Date object
 * @param holidays - Lista de feriados em ISO (YYYY-MM-DD)
 * @returns DayKey ("seg", "ter", ..., "feriado")
 */
export function currentDayKey(now: Date, holidays: string[] = HOLIDAYS): DayKey {
  if (holidays.includes(isoDate(now))) return "feriado";
  return WEEK[now.getDay()] ?? "seg";
}

/**
 * Converte HH:MM para minutos desde meia-noite.
 * Usado para comparar horários com Date.getHours() * 60 + getMinutes().
 * 
 * @param hhmm - Formato "HH:MM"
 * @returns Minutos desde 00:00
 */
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

// ============================================================================
// 6. CONSULTA DE STATUS OPERACIONAL
// ============================================================================

/**
 * Status de abertura/fechamento em um momento específico.
 * Resultado da consulta getStatus().
 */
export interface OpenStatus {
  /** Dia da semana (seg, ter, ..., feriado) */
  dayKey: DayKey;
  /** Horário de abertura (HH:MM) */
  open: string;
  /** Horário de fechamento (HH:MM) */
  close: string;
  /** true se loja está aberta neste momento */
  isOpen: boolean;
}

/**
 * Consulta se uma loja está aberta em um momento específico.
 * 
 * Procura:
 * 1. Identifica o dia (respeitando feriados)
 * 2. Busca horários na grade SCHEDULES[modalidade][loja]
 * 3. Compara horário atual com intervalo open:close
 * 
 * @param store - Loja (StoreName)
 * @param modality - Modalidade (Entrega ou Retira)
 * @param now - Momento a consultar (Date)
 * @param holidays - Lista de feriados (opcional)
 * @returns OpenStatus ou null se loja não tem operação configurada
 */
export function getStatus(
  store: StoreName,
  modality: Modality,
  now: Date,
  holidays: string[] = HOLIDAYS,
): OpenStatus | null {
  const dayKey = currentDayKey(now, holidays);
  const grid = SCHEDULES[modality][store];
  if (!grid) return null;
  const { open, close } = grid[dayKey];
  const mins = now.getHours() * 60 + now.getMinutes();
  return { dayKey, open, close, isOpen: mins >= toMin(open) && mins < toMin(close) };
}
