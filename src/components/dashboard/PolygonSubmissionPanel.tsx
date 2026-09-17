/**
 * ENVIO DE POLÍGONOS (BANCO)
 * ==========================
 *
 * Envia coleções reais de polígonos (GeoJSON) para o banco, associadas a uma
 * loja e a uma política de envio. O arquivo é validado, mostrado em
 * pré-visualização e só é gravado após a confirmação — nada é inventado.
 */

import { useMemo, useRef, useState } from "react";
import { useLive, liveStores, refreshLive, storeRegionOf } from "@/lib/freight/live";
import {
  deletePolygonCollection,
  deleteStatePolygon,
  ensureStore,
  insertPolygonRows,
  upsertStatePolygon,
} from "@/lib/freight/remote.functions";
import { logAudit } from "@/lib/freight/audit-log";
import { useSubmittedStores, useDbStores } from "@/lib/freight/submitted-stores";

/** Features aceitas: Feature (Polygon/MultiPolygon) ou geometria direta */
type AnyGeom = { type: "Polygon" | "MultiPolygon"; coordinates: unknown };

function asMulti(geom: AnyGeom): number[][][][] {
  if (geom.type === "MultiPolygon") return geom.coordinates as number[][][][];
  return [geom.coordinates as number[][][]];
}

function centroidOf(coords: number[][][][]): [number, number] {
  // centro aproximado: média dos vértices do primeiro anel externo
  let sx = 0;
  let sy = 0;
  let n = 0;
  const ring = coords[0]?.[0] ?? [];
  for (const point of ring) {
    sx += point[0] ?? 0;
    sy += point[1] ?? 0;
    n += 1;
  }
  return n ? [sx / n, sy / n] : [0, 0];
}

/** Área aproximada em km² (equiretangular local) — estimativa para exibição */
function areaKm2Of(coords: number[][][][]): number {
  const ring = coords[0]?.[0] ?? [];
  if (ring.length < 3) return 0;
  const latRef = ring.reduce((s, p) => s + (p[1] ?? 0), 0) / ring.length;
  const kmPerDegLat = 110.574;
  const kmPerDegLng = 111.32 * Math.cos((latRef * Math.PI) / 180);
  let a = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const p1 = ring[i] as number[];
    const p2 = ring[i + 1] as number[];
    const x1 = (p1[0] ?? 0) * kmPerDegLng;
    const y1 = (p1[1] ?? 0) * kmPerDegLat;
    const x2 = (p2[0] ?? 0) * kmPerDegLng;
    const y2 = (p2[1] ?? 0) * kmPerDegLat;
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a / 2);
}

type Kind = "Entrega" | "Retira";

export function PolygonSubmissionPanel({ onGoToMap }: { onGoToMap: () => void }) {
  const live = useLive();
  const submitted = useSubmittedStores();
  const dbStores = useDbStores();
  const drafts = live?.drafts ?? [];

  const [store, setStore] = useState("");
  const [kind, setKind] = useState<Kind>("Entrega");
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [parsed, setParsed] = useState<{ name: string; count: number; bands: Set<string>; area: number } | null>(null);
  const [geo, setGeo] = useState<AnyGeom[]>([]);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [newStore, setNewStore] = useState("");
  const [stateFeedback, setStateFeedback] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const storeOptions = useMemo(
    () => Array.from(new Set([...dbStores.map((s) => s.name), ...drafts.map((d) => d.store)])),
    [dbStores, drafts],
  );

  /** Resumo por loja + tipo (Entrega/Retira) já cadastrado no banco */
  const collections = useMemo(() => {
    const map = new Map<string, { store: string; kind: Kind; count: number; area: number }>();
    for (const p of live?.polygons ?? []) {
      const k: Kind = p.kind === "Retira" ? "Retira" : "Entrega";
      const key = `${p.store}||${k}`;
      const cur = map.get(key) ?? { store: p.store, kind: k, count: 0, area: 0 };
      cur.count += 1;
      cur.area += p.areaKm2 ?? 0;
      map.set(key, cur);
    }
    return [...map.values()];
  }, [live]);

  const onFile = async (file: File | undefined) => {
    setFeedback(null);
    setParsed(null);
    setGeo([]);
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text) as
        | AnyGeom
        | { type: "Feature"; geometry: AnyGeom }
        | { type: "FeatureCollection"; features: Array<{ geometry: AnyGeom }> };
      let geoms: AnyGeom[] = [];
      if (json.type === "FeatureCollection") {
        geoms = (json.features ?? []).map((f) => f.geometry).filter(Boolean);
      } else if (json.type === "Feature") {
        geoms = [(json as { geometry: AnyGeom }).geometry];
      } else {
        geoms = [json];
      }
      geoms = geoms.filter((g) => g && (g.type === "Polygon" || g.type === "MultiPolygon"));
      if (!geoms.length) throw new Error("Nenhuma geometria Polygon/MultiPolygon encontrada no arquivo.");
      const bands = new Set<string>();
      let area = 0;
      for (const g of geoms) area += areaKm2Of(asMulti(g));
      setGeo(geoms);
      setParsed({ name: file.name, count: geoms.length, bands, area });
    } catch (e) {
      setFeedback({
        kind: "err",
        text: e instanceof Error ? e.message : "Não foi possível ler o arquivo GeoJSON.",
      });
    }
  };

  const handleSubmit = async () => {
    const storeName = (newStore.trim() || store).trim();
    if (!storeName) {
      setFeedback({ kind: "err", text: "Selecione ou informe a loja." });
      return;
    }
    if (!geo.length) {
      setFeedback({ kind: "err", text: "Selecione um arquivo GeoJSON." });
      return;
    }
    const region = storeRegionOf(live, storeName) ?? "SP";
    setSending(true);
    try {
      const { id: storeId } = await ensureStore({ data: { name: storeName, region } });

      if (replaceExisting) {
        await deletePolygonCollection({ data: { storeId, kind } });
      }

      const rows = geo.map((g, i) => {
        const coords = asMulti(g);
        const center = centroidOf(coords);
        return {
          clientId: `${storeName}|${kind}|${Date.now()}|${i}`,
          storeId,
          policyId: null,
          kind,
          district: null,
          uf: region,
          band: "—",
          radius: null,
          rMin: null,
          rMax: null,
          areaKm2: areaKm2Of(coords),
          centerLng: center[0],
          centerLat: center[1],
          geojson: JSON.stringify({ type: "MultiPolygon", coordinates: coords }),
        };
      });

      // envia em lotes de 200 para não estourar o limite da requisição
      let inserted = 0;
      for (let i = 0; i < rows.length; i += 200) {
        const res = await insertPolygonRows({ data: { rows: rows.slice(i, i + 200) } });
        inserted += res.inserted;
      }

      logAudit({
        store: storeName,
        module: "Criação de Polígonos",
        field: `Polígonos (${kind})`,
        before: replaceExisting ? "—" : "0",
        after: String(inserted),
        action: "Adição",
        description: `${inserted.toLocaleString("pt-BR")} polígonos de ${kind} enviados de ${parsed?.name ?? "arquivo"} para a loja de ${storeName}`,
      });

      setFeedback({
        kind: "ok",
        text: `${inserted.toLocaleString("pt-BR")} polígonos de ${storeName} gravados no banco.`,
      });
      setParsed(null);
      setGeo([]);
      if (fileRef.current) fileRef.current.value = "";
      await refreshLive();
    } catch (e) {
      setFeedback({
        kind: "err",
        text: e instanceof Error ? e.message : "Falha ao enviar os polígonos.",
      });
    } finally {
      setSending(false);
    }
  };

  const handleRemoveCollection = async (storeName: string, collectionKind: Kind) => {
    const target = liveStores(live).find((s) => s.name === storeName);
    if (!target) return;
    if (!window.confirm(`Remover os polígonos de ${collectionKind} da loja de ${storeName}?`)) return;
    const { id: storeId } = await ensureStore({ data: { name: storeName, region: target.region } });
    await deletePolygonCollection({ data: { storeId, kind: collectionKind } });
    logAudit({
      store: storeName,
      module: "Criação de Polígonos",
      field: `Polígonos (${collectionKind})`,
      before: "Cadastrada",
      after: "—",
      action: "Remoção",
      description: `Coleção de ${collectionKind} removida da loja de ${storeName}`,
    });
    await refreshLive();
  };

  return (
    <div className="space-y-4">
      <section className="surface space-y-3 p-4">
        <div>
          <h2 className="section-title text-lg">Envio de polígonos (loja + tipo)</h2>
          <p className="text-xs text-muted-foreground">
            Envie o GeoJSON com as áreas de uma loja e indique se elas são de{" "}
            <strong>Entrega</strong> ou de <strong>Retira</strong>. As áreas não dependem de
            política de envio — o que muda por política é a tabela de frete. Os dados ficam
            gravados no banco — visíveis para todos.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="field-label">
            Loja existente
            <select
              className="input mt-1 w-56"
              value={store}
              onChange={(e) => {
                setStore(e.target.value);
                setNewStore("");
                setFeedback(null);
              }}
            >
              <option value="">— nova loja —</option>
              {storeOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            ou nova loja
            <input
              className="input mt-1 w-44"
              value={newStore}
              onChange={(e) => {
                setNewStore(e.target.value);
                setStore("");
              }}
              placeholder="Ex.: Campinas"
            />
          </label>
          <label className="field-label">
            Tipo da coleção
            <select
              className="input mt-1 w-40"
              value={kind}
              onChange={(e) => setKind(e.target.value as Kind)}
            >
              <option value="Entrega">Entrega</option>
              <option value="Retira">Retira</option>
            </select>
          </label>
          <label className="field-label">
            Arquivo GeoJSON
            <input
              ref={fileRef}
              type="file"
              accept=".geojson,.json,application/geo+json,application/json"
              className="input mt-1 w-64 text-xs"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-primary"
              checked={replaceExisting}
              onChange={(e) => setReplaceExisting(e.target.checked)}
            />
            substituir a coleção anterior desse tipo
          </label>
        </div>

        {parsed ? (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
            <p className="font-semibold">{parsed.name}</p>
            <p className="mt-1 text-muted-foreground">
              {parsed.count.toLocaleString("pt-BR")} geometria(s) · área aproximada{" "}
              {parsed.area.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km²
            </p>
            <button
              type="button"
              className="btn-primary mt-2 text-xs"
              disabled={sending}
              onClick={() => void handleSubmit()}
            >
              {sending ? "Enviando…" : "Confirmar envio"}
            </button>
          </div>
        ) : null}

        {feedback ? (
          <p
            className={
              "rounded-lg border p-2 text-xs font-medium " +
              (feedback.kind === "ok"
                ? "border-success/40 bg-success/10 text-success"
                : "border-danger/40 bg-danger/10 text-danger")
            }
          >
            {feedback.text}
          </p>
        ) : null}

        <button className="btn-ghost text-xs" onClick={onGoToMap}>
          Ver no mapa
        </button>
      </section>

      <section className="surface space-y-3 p-4">
        <h3 className="section-title text-base">Coleções cadastradas no banco</h3>
        {submitted.length ? (
          <div className="flex flex-wrap gap-2">
            {submitted.map((s) => (
              <span
                key={s}
                className="rounded-full border border-success/40 bg-success/10 px-3 py-1 text-xs font-semibold text-success"
              >
                {s}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhuma loja com polígonos ainda.</p>
        )}
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-2 py-2 text-left">Loja</th>
                <th className="px-2 py-2 text-left">Tipo</th>
                <th className="px-2 py-2 text-right">Polígonos</th>
                <th className="px-2 py-2 text-right">Área (km²)</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {collections.map((c) => (
                <tr key={`${c.store}||${c.kind}`} className="border-t border-border">
                  <td className="px-2 py-1.5 font-medium">{c.store}</td>
                  <td className="px-2 py-1.5">{c.kind}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {c.count.toLocaleString("pt-BR")}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {c.area.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <button
                      className="text-[11px] text-danger underline hover:bg-danger/10"
                      onClick={() => void handleRemoveCollection(c.store, c.kind)}
                    >
                      remover
                    </button>
                  </td>
                </tr>
              ))}
              {collections.length === 0 ? (
                <tr>
                  <td className="px-2 py-3 text-xs text-muted-foreground" colSpan={5}>
                    Nenhuma coleção enviada ainda.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="surface space-y-3 p-4">
        <div>
          <h3 className="section-title text-base">Malhas estaduais (Retira)</h3>
          <p className="text-xs text-muted-foreground">
            Contornos de São Paulo e Rio de Janeiro usados na modalidade Retira. Ficam gravados no
            banco e podem ser substituídos por um novo arquivo GeoJSON.
          </p>
        </div>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-2 py-2 text-left">Estado</th>
                <th className="px-2 py-2 text-right">Partes</th>
                <th className="px-2 py-2 text-right">Pontos</th>
                <th className="px-2 py-2 text-left">Substituir</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {(live?.statePolygons ?? []).map((s) => (
                <tr key={s.uf} className="border-t border-border">
                  <td className="px-2 py-1.5 font-medium">
                    {s.name} ({s.uf})
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{s.geom.length}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {s.geom
                      .reduce((t, poly) => t + poly.reduce((r, ring) => r + ring.length, 0), 0)
                      .toLocaleString("pt-BR")}
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="file"
                      accept=".geojson,.json,application/geo+json,application/json"
                      className="input w-52 text-[11px]"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        void handleStateFile(s.uf, s.name, f);
                      }}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <button
                      className="text-[11px] text-danger underline hover:bg-danger/10"
                      onClick={() => void handleRemoveState(s.uf, s.name)}
                    >
                      remover
                    </button>
                  </td>
                </tr>
              ))}
              {(live?.statePolygons ?? []).length === 0 ? (
                <tr>
                  <td className="px-2 py-3 text-xs text-muted-foreground" colSpan={5}>
                    Nenhuma malha estadual gravada no banco.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {stateFeedback ? (
          <p
            className={`text-xs ${stateFeedback.kind === "ok" ? "text-success" : "text-danger"}`}
          >
            {stateFeedback.text}
          </p>
        ) : null}
      </section>
    </div>
  );
}
