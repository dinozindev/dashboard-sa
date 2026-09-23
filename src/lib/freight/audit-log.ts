/**
 * HISTÓRICO DE AUDITORIA
 * ======================
 *
 * Registra automaticamente as alterações feitas nas abas de
 * "Cadastro de Política de Envio", "Políticas de Envio" e "Envio de Polígonos".
 * Os registros são gravados no banco: todas as pessoas veem o mesmo histórico.
 */

import { useEffect, useSyncExternalStore } from "react";
import { commitLocal, getLive, refreshLive, subscribeLive } from "./live";
import { clearAuditEntries, insertAuditEntries, type AuditRowPayload } from "./remote.functions";

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
  | "Pontos de Retirada"
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

/** Mantido por compatibilidade com importações antigas. */
export const AUDIT_LOG_STORAGE_KEY = "freight.audit-log.v1";

const EMPTY: AuditEntry[] = [];
const MAX_ENTRIES = 2000;

let seq = 0;
let refreshTimer: number | null = null;

/** Recarrega o histórico do banco com um pequeno atraso (agrupa várias gravações). */
function scheduleRefresh() {
  if (refreshTimer !== null) return;
  refreshTimer = window.setTimeout(() => {
    refreshTimer = null;
    void refreshLive();
  }, 1200);
}

export function hydrateAuditLog() {
  void refreshLive();
}

export const subscribeAuditLog = subscribeLive;

export function getAuditLog(): AuditEntry[] {
  return getLive()?.audit ?? EMPTY;
}

/** Sempre null: o histórico vive no banco, não no navegador. */
export const getAuditStorageError = () => null;

/** Registra uma alteração no histórico (gravação otimista + banco). */
export function logAudit(entry: Omit<AuditEntry, "id" | "at"> & { at?: string }) {
  const full: AuditEntry = {
    id: `tmp-${Date.now()}-${++seq}`,
    at: entry.at ?? new Date().toISOString(),
    store: entry.store,
    module: entry.module,
    field: entry.field,
    before: entry.before,
    after: entry.after,
    action: entry.action,
    description: entry.description,
  };
  commitLocal((state) => {
    state.audit.unshift(full);
    if (state.audit.length > MAX_ENTRIES) state.audit.length = MAX_ENTRIES;
  });
  const row: AuditRowPayload = {
    at: full.at,
    store: full.store,
    module: full.module,
    field: full.field,
    before: full.before,
    after: full.after,
    action: full.action,
    description: full.description,
  };
  void insertAuditEntries({ data: { entries: [row] } })
    .then(scheduleRefresh)
    .catch((err) => {
      console.error("Falha ao gravar auditoria no banco", err);
      scheduleRefresh();
    });
}

export function clearAuditLog() {
  commitLocal((state) => {
    state.audit.length = 0;
  });
  void clearAuditEntries()
    .then(() => refreshLive())
    .catch(() => refreshLive());
}

export function useAuditLog() {
  useEffect(() => {
    void refreshLive();
  }, []);
  return useSyncExternalStore(subscribeLive, getAuditLog, () => EMPTY);
}

/** Formata data/hora com segundos (pt-BR). */
export const formatAuditDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" });
};
