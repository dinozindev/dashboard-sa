/**
 * LOJAS COM POLÍGONOS CADASTRADOS
 * ===============================
 *
 * O banco começa vazio: uma loja aparece no painel depois que seus polígonos
 * são enviados na aba "Envio de Polígonos". A lista vem do banco, então é a
 * mesma para todas as pessoas.
 */

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { availableStoreNames, getLive, liveStores, refreshLive, subscribeLive } from "./live";

/** Mantido por compatibilidade: o banco começa vazio, sem lojas fixas. */
export const BASE_STORES: string[] = [];

export const SUBMITTED_STORES_STORAGE_KEY = "freight.submitted-stores.v1";

export function hydrateSubmittedStores() {
  void refreshLive();
}

export const subscribeSubmittedStores = subscribeLive;

export const getSubmittedStores = () => availableStoreNames(getLive());

export function useSubmittedStores() {
  useEffect(() => {
    void refreshLive();
  }, []);
  const live = useSyncExternalStore(subscribeLive, getLive, () => null);
  return useMemo(() => availableStoreNames(live), [live]);
}

/** Todas as lojas cadastradas no banco (com ou sem polígonos). */
export function useDbStores() {
  useEffect(() => {
    void refreshLive();
  }, []);
  const live = useSyncExternalStore(subscribeLive, getLive, () => null);
  return useMemo(() => liveStores(live), [live]);
}
