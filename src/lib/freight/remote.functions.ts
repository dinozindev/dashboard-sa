/**
 * FUNÇÕES DE SERVIDOR — DADOS COMPARTILHADOS DE FRETE
 * ===================================================
 *
 * Toda a persistência (políticas, polígonos, tabelas de frete, docas,
 * matriz de políticas e auditoria) vive no banco. Sem login por enquanto:
 * o acesso é público e controlado pela aplicação.
 */

import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { WeightBand } from "./types";

/** Cliente com chave pública (leitura/escrita liberadas pelas políticas do banco). */
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

// ============================================================================
// SNAPSHOT (leitura única de tudo que o painel precisa)
// ============================================================================

export interface FreightSnapshotDto {
  stores: Array<{
    name: string;
    region: "SP" | "RJ";
    note: string | null;
    center: [number, number] | null;
    polygonCount: number;
  }>;
  policies: Array<{ clientId: string; store: string; data: object; updatedAt: string }>;
  freightTables: Array<{
    id: string;
    store: string;
    policyClientId: string | null;
    name: string;
    source: string;
    fileName: string | null;
    bands: WeightBand[];
  }>;
  polygons: Array<{
    id: string;
    store: string;
    district: string | null;
    uf: string | null;
    band: string | null;
    radius: number | null;
    rMin: number | null;
    rMax: number | null;
    areaKm2: number | null;
    center: [number, number] | null;
    policyClientId: string;
    kind: "Entrega" | "Retira" | null;
    geojson: { type: string; coordinates: number[][][][] } | null;
  }>;
  statePolygons: Array<{
    uf: string;
    name: string;
    source: string | null;
    updatedAt: string;
    geojson: { type: string; coordinates: number[][][][] } | null;
  }>;
  dockLinks: Array<{ store: string; dock: string; policyClientId: string }>;
  policyCells: Array<{ store: string; modality: string; status: string; note: string }>;
  customModalities: string[];
  audit: Array<{
    id: string;
    at: string;
    store: string;
    module: string;
    field: string;
    before: string | null;
    after: string | null;
    action: string;
    description: string | null;
  }>;
}

export const getFreightSnapshot = createServerFn({ method: "GET" }).handler(
  async (): Promise<FreightSnapshotDto> => {
    const supabase = publicClient();
    const { data, error } = await supabase.rpc("get_freight_snapshot");
    fail(error);
    return data as FreightSnapshotDto;
  },
);

// ============================================================================
// LOJAS
// ============================================================================

type SupabaseClient = ReturnType<typeof publicClient>;

/** Garante que a loja exista (auxiliar interno compartilhado). */
async function ensureStoreRecord(
  supabase: SupabaseClient,
  name: string,
  region: "SP" | "RJ",
): Promise<string> {
  const { data: existing } = await supabase
    .from("stores")
    .select("id")
    .eq("name", name)
    .maybeSingle();
  if (existing?.id) return existing.id as string;
  const { data: created, error } = await supabase
    .from("stores")
    .insert({ name, region, note: null, center_lng: null, center_lat: null })
    .select("id")
    .single();
  fail(error);
  return created!.id as string;
}

export const ensureStore = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { name: string; region: "SP" | "RJ"; note?: string | null; center?: [number, number] | null }) =>
      input,
  )
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: existing } = await supabase
      .from("stores")
      .select("id, note, center_lng, center_lat")
      .eq("name", data.name)
      .maybeSingle();
    if (existing?.id) return { id: existing.id as string, created: false };
    const { data: created, error } = await supabase
      .from("stores")
      .insert({
        name: data.name,
        region: data.region,
        note: data.note ?? null,
        center_lng: data.center?.[0] ?? null,
        center_lat: data.center?.[1] ?? null,
      })
      .select("id")
      .single();
    fail(error);
    return { id: created!.id as string, created: true };
  });

// ============================================================================
// POLÍTICAS DE ENVIO
// ============================================================================

export interface PolicyPayload {
  clientId: string;
  store: string;
  region: "SP" | "RJ";
  data: object;
}

export const upsertPolicy = createServerFn({ method: "POST" })
  .inputValidator((input: { draft: PolicyPayload }) => input)
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const storeId = await ensureStoreRecord(supabase, data.draft.store, data.draft.region);
    const { error } = await supabase.from("policies").upsert(
      {
        client_id: data.draft.clientId,
        store_id: storeId,
        data: data.draft.data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id" },
    );
    fail(error);
    return { ok: true };
  });

export const deletePolicies = createServerFn({ method: "POST" })
  .inputValidator((input: { clientIds: string[] }) => input)
  .handler(async ({ data }) => {
    const supabase = publicClient();
    if (data.clientIds.length) {
      const { error } = await supabase.from("policies").delete().in("client_id", data.clientIds);
      fail(error);
    }
    return { ok: true };
  });

export const replacePolicies = createServerFn({ method: "POST" })
  .inputValidator((input: { drafts: PolicyPayload[] }) => input)
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const ids = new Map<string, string>();
    for (const draft of data.drafts) {
      const storeId = await ensureStoreRecord(supabase, draft.store, draft.region);
      ids.set(draft.store, storeId);
    }
    const { error: delError } = await supabase.from("policies").delete().neq("client_id", "\u0000");
    fail(delError);
    if (data.drafts.length) {
      const { error } = await supabase.from("policies").insert(
        data.drafts.map((draft) => ({
          client_id: draft.clientId,
          store_id: ids.get(draft.store)!,
          data: draft.data as object,
        })),
      );
      fail(error);
    }
    return { ok: true };
  });

// ============================================================================
// MATRIZ DE POLÍTICAS (células e modalidades)
// ============================================================================

export const updatePolicyCell = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { store: string; modality: string; status?: string; note?: string }) => input,
  )
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { error } = await supabase.from("policy_cells").upsert(
      {
        store: data.store,
        modality: data.modality,
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.note !== undefined ? { note: data.note } : {}),
      },
      { onConflict: "store,modality" },
    );
    fail(error);
    return { ok: true };
  });

export const addCustomModality = createServerFn({ method: "POST" })
  .inputValidator((input: { name: string }) => input)
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: existing } = await supabase
      .from("modalities")
      .select("name")
      .eq("name", data.name)
      .maybeSingle();
    if (existing) return { ok: true, existed: true };
    const { error } = await supabase
      .from("modalities")
      .insert({ name: data.name, position: Date.now() % 1_000_000 });
    fail(error);
    return { ok: true, existed: false };
  });

export const removeCustomModality = createServerFn({ method: "POST" })
  .inputValidator((input: { name: string }) => input)
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { error } = await supabase.from("modalities").delete().eq("name", data.name);
    fail(error);
    return { ok: true };
  });

export const replaceMatrixData = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { modalities: string[]; cells: Array<{ store: string; modality: string; status: string; note: string }> }) =>
      input,
  )
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { error: delMod } = await supabase.from("modalities").delete().neq("name", "\u0000");
    fail(delMod);
    const { error: delCells } = await supabase
      .from("policy_cells")
      .delete()
      .neq("store", "\u0000");
    fail(delCells);
    if (data.modalities.length) {
      const { error } = await supabase
        .from("modalities")
        .insert(data.modalities.map((name, i) => ({ name, position: i })));
      fail(error);
    }
    if (data.cells.length) {
      const { error } = await supabase.from("policy_cells").insert(data.cells);
      fail(error);
    }
    return { ok: true };
  });

export const resetMatrixData = createServerFn({ method: "POST" }).handler(async () => {
  const supabase = publicClient();
  const { error: delMod } = await supabase.from("modalities").delete().neq("name", "\u0000");
  fail(delMod);
  const { error: delCells } = await supabase.from("policy_cells").delete().neq("store", "\u0000");
  fail(delCells);
  return { ok: true };
});

// ============================================================================
// DOCAS
// ============================================================================

export const setDockLink = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { store: string; region: "SP" | "RJ"; dock: string; policyClientId: string; linked: boolean }) =>
      input,
  )
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: policy } = await supabase
      .from("policies")
      .select("id, store_id")
      .eq("client_id", data.policyClientId)
      .maybeSingle();
    if (!policy?.id) throw new Error("Política não encontrada no banco.");
    if (data.linked) {
      const { error } = await supabase
        .from("policy_docks")
        .upsert(
          { store_id: policy.store_id, dock: data.dock, policy_id: policy.id },
          { onConflict: "store_id,dock,policy_id" },
        );
      fail(error);
    } else {
      const { error } = await supabase
        .from("policy_docks")
        .delete()
        .eq("policy_id", policy.id)
        .eq("dock", data.dock);
      fail(error);
    }
    return { ok: true };
  });

export const removePolicyFromAllDocks = createServerFn({ method: "POST" })
  .inputValidator((input: { policyClientId: string }) => input)
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: policy } = await supabase
      .from("policies")
      .select("id")
      .eq("client_id", data.policyClientId)
      .maybeSingle();
    if (policy?.id) {
      const { error } = await supabase.from("policy_docks").delete().eq("policy_id", policy.id);
      fail(error);
    }
    return { ok: true };
  });

// ============================================================================
// TABELAS DE FRETE
// ============================================================================

export interface FreightTablePayload {
  store: string;
  region: "SP" | "RJ";
  name: string;
  source: "existente" | "upload";
  fileName?: string | null;
  bands: WeightBand[];
  policyClientId?: string | null;
}

export const saveFreightTable = createServerFn({ method: "POST" })
  .inputValidator((input: { table: FreightTablePayload }) => input)
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const t = data.table;
    const storeId = await ensureStoreRecord(supabase, t.store, t.region);

    let policyId: string | null = null;
    if (t.policyClientId) {
      const { data: policy } = await supabase
        .from("policies")
        .select("id")
        .eq("client_id", t.policyClientId)
        .maybeSingle();
      policyId = (policy?.id as string) ?? null;
    }

    const { data: existing } = await supabase
      .from("freight_tables")
      .select("id")
      .eq("store_id", storeId)
      .eq("name", t.name)
      .maybeSingle();

    let tableId: string;
    if (existing?.id) {
      tableId = existing.id as string;
      const { error } = await supabase
        .from("freight_tables")
        .update({ source: t.source, file_name: t.fileName ?? null, policy_id: policyId })
        .eq("id", tableId);
      fail(error);
      const { error: delBands } = await supabase
        .from("freight_bands")
        .delete()
        .eq("table_id", tableId);
      fail(delBands);
    } else {
      const { data: created, error } = await supabase
        .from("freight_tables")
        .insert({
          store_id: storeId,
          policy_id: policyId,
          name: t.name,
          source: t.source,
          file_name: t.fileName ?? null,
        })
        .select("id")
        .single();
      fail(error);
      tableId = created!.id as string;
    }

    if (t.bands.length) {
      const { error } = await supabase.from("freight_bands").insert(
        t.bands.map((band, index) => ({
          table_id: tableId,
          band_index: index,
          ws: band.ws,
          we: band.we,
          amc: band.amc,
          pew: band.pew,
          pct: band.pct ?? null,
          max_vol: band.maxVol ?? null,
          time: band.time ?? null,
          country: band.country ?? null,
          min_ins: band.minIns ?? null,
        })),
      );
      fail(error);
    }
    return { id: tableId };
  });

export const linkFreightTable = createServerFn({ method: "POST" })
  .inputValidator((input: { tableId: string; policyClientId: string | null }) => input)
  .handler(async ({ data }) => {
    const supabase = publicClient();
    let policyId: string | null = null;
    if (data.policyClientId) {
      const { data: policy } = await supabase
        .from("policies")
        .select("id")
        .eq("client_id", data.policyClientId)
        .maybeSingle();
      policyId = (policy?.id as string) ?? null;
    }
    const { error } = await supabase
      .from("freight_tables")
      .update({ policy_id: policyId })
      .eq("id", data.tableId);
    fail(error);
    return { ok: true };
  });

// ============================================================================
// POLÍGONOS
// ============================================================================

export interface PolygonRowPayload {
  clientId: string;
  storeId: string;
  /** null = coleção base da loja (sem política) */
  policyId: string | null;
  /** Tipo da coleção: "Entrega" (padrão) ou "Retira" */
  kind?: "Entrega" | "Retira";
  district?: string | null;
  uf?: string | null;
  band?: string | null;
  radius?: number | null;
  rMin?: number | null;
  rMax?: number | null;
  areaKm2?: number | null;
  centerLng?: number | null;
  centerLat?: number | null;
  geojson: string;
}

export const insertPolygonRows = createServerFn({ method: "POST" })
  .inputValidator((input: { rows: PolygonRowPayload[] }) => input)
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const inserted = await supabase.rpc("insert_polygons", { payload: data.rows });
    fail(inserted.error);
    return { inserted: (inserted.data as number) ?? 0 };
  });

/** Remove a coleção de polígonos de uma loja para um tipo (Entrega/Retira). */
export const deletePolygonCollection = createServerFn({ method: "POST" })
  .inputValidator((input: { storeId: string; kind: "Entrega" | "Retira" }) => input)
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { error } = await supabase
      .from("polygons")
      .delete()
      .eq("store_id", data.storeId)
      .eq("kind", data.kind);
    fail(error);
    return { ok: true };
  });

// ============================================================================
// AUDITORIA
// ============================================================================

export interface AuditRowPayload {
  at: string;
  store: string;
  module: string;
  field: string;
  before: string;
  after: string;
  action: string;
  description: string;
}

export const insertAuditEntries = createServerFn({ method: "POST" })
  .inputValidator((input: { entries: AuditRowPayload[] }) => input)
  .handler(async ({ data }) => {
    if (!data.entries.length) return { ok: true };
    const supabase = publicClient();
    const { error } = await supabase.from("audit_log").insert(data.entries);
    fail(error);
    return { ok: true };
  });

export const clearAuditEntries = createServerFn({ method: "POST" }).handler(async () => {
  const supabase = publicClient();
  const { error } = await supabase.from("audit_log").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  fail(error);
  return { ok: true };
});
