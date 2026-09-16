/**
 * HISTÓRICO DE AUDITORIA
 * ======================
 *
 * Registra automaticamente as alterações feitas nas abas de
 * "Cadastro de Política de Envio", "Políticas de Envio" e "Envio de Polígonos".
 *
 * Os registros são persistidos em JSON no navegador (localStorage) — não há
 * backend. Se o armazenamento estiver indisponível, o registro continua em
 * memória e a aba de auditoria exibe um aviso.
 */

import { useEffect, useSyncExternalStore } from "react";

export type AuditAction =
  | "Criação"
  | "Edição"
  | "Ativação"
  | "Desativação"
  | "Adição"
  | "Remoção"
  | "Liberação automática";

export type AuditModule =
  | "Cadastro de Política de Envio"
  | "Políticas de Envio"
  | "Docas"
  | "Criação de Polígonos";

export interface AuditEntry {
  id: string;
  /** ISO 8601 */
  at: string;
  store: string;
  module: AuditModule;
  field: string;
  before: string;
  after: string;
  action: AuditAction;
  description: string;
}

export const AUDIT_LOG_STORAGE_KEY = "freight.audit-log.v1";

const EMPTY: AuditEntry[] = [];
const MAX_ENTRIES = 2000;

let items: AuditEntry[] = EMPTY;
let hydrated = false;
let storageError: string | null = null;
const listeners = new Set<() => void>();

const emit = () => {
  for (const l of listeners) l();
};

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AUDIT_LOG_STORAGE_KEY, JSON.stringify(items));
    storageError = null;
  } catch {
    storageError =
      "Não foi possível salvar o histórico neste navegador (armazenamento cheio ou bloqueado). Os registros valem apenas até recarregar a página.";
  }
}

function normalize(list: unknown): AuditEntry[] {
  if (!Array.isArray(list)) return [];
  return list.filter((x): x is AuditEntry => !!x && typeof x === "object" && "at" in x);
}

export function hydrateAuditLog() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(AUDIT_LOG_STORAGE_KEY);
    if (!raw) return;
    const parsed = normalize(JSON.parse(raw));
    if (parsed.length) {
      items = parsed;
      emit();
    }
  } catch {
    /* JSON inválido — ignora */
  }
}

export const subscribeAuditLog = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export const getAuditLog = () => items;

export const getAuditStorageError = () => storageError;

let seq = 0;

/** Registra uma alteração no histórico (mais recente primeiro). */
export function logAudit(entry: Omit<AuditEntry, "id" | "at"> & { at?: string }) {
  const full: AuditEntry = {
    id: `aud-${Date.now()}-${++seq}`,
    at: entry.at ?? new Date().toISOString(),
    store: entry.store,
    module: entry.module,
    field: entry.field,
    before: entry.before,
    after: entry.after,
    action: entry.action,
    description: entry.description,
  };
  items = [full, ...items].slice(0, MAX_ENTRIES);
  persist();
  emit();
}

export function clearAuditLog() {
  items = EMPTY;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(AUDIT_LOG_STORAGE_KEY);
      storageError = null;
    } catch {
      /* ignore */
    }
  }
  emit();
}

export function useAuditLog() {
  useEffect(() => {
    hydrateAuditLog();
  }, []);
  return useSyncExternalStore(subscribeAuditLog, getAuditLog, () => EMPTY);
}

/** Formata data/hora com segundos (pt-BR). */
export const formatAuditDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" });
};
