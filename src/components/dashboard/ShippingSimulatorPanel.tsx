import { lazy, Suspense, useMemo, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { useLive } from "@/lib/freight/live";
import { brl, kg } from "@/lib/freight/pricing";
import { formatTimeCost, simulate, type SimOption } from "@/lib/freight/shipping-simulator";

const FreightMap = lazy(() => import("./FreightMap"));

interface Address {
  cep?: string;
  street?: string;
  district?: string;
  city?: string;
  uf?: string;
}

async function geocodeCep(cep: string): Promise<{ lat: number; lng: number; address: Address }> {
  const clean = cep.replace(/\D/g, "");
  const via = await fetch(`https://viacep.com.br/ws/${clean}/json/`).then((r) => r.json());
  if (via.erro) throw new Error("CEP não encontrado.");
  const address: Address = {
    cep: via.cep,
    street: via.logradouro,
    district: via.bairro,
    city: via.localidade,
    uf: via.uf,
  };
  const queries = [
    `${via.logradouro}, ${via.bairro}, ${via.localidade}, ${via.uf}, Brasil`,
    `${via.logradouro}, ${via.localidade}, ${via.uf}, Brasil`,
    `${via.bairro}, ${via.localidade}, ${via.uf}, Brasil`,
    `${via.localidade}, ${via.uf}, Brasil`,
  ];
  for (const q of queries) {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`,
    ).then((r) => r.json());
    if (res?.[0]) return { lat: Number(res[0].lat), lng: Number(res[0].lon), address };
  }
  throw new Error("Não foi possível localizar as coordenadas deste CEP.");
}

async function reverseGeocode(lat: number, lng: number): Promise<Address> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
    ).then((x) => x.json());
    const a = r?.address ?? {};
    const iso: string = a["ISO3166-2-lvl4"] ?? "";
    return {
      cep: a.postcode,
      street: a.road,
      district: a.suburb ?? a.neighbourhood ?? a.city_district,
      city: a.city ?? a.town ?? a.village ?? a.municipality,
      uf: iso.startsWith("BR-") ? iso.slice(3) : a.state,
    };
  } catch {
    return {};
  }
}

export function ShippingSimulatorPanel() {
  const live = useLive();
  const [weight, setWeight] = useState("1");
  const [cep, setCep] = useState("");
  const [latIn, setLatIn] = useState("");
  const [lngIn, setLngIn] = useState("");
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState<Address | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [calcWeight, setCalcWeight] = useState<number | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const parsedWeight = Number(weight.replace(",", "."));

  const result = useMemo(() => {
    if (!live || !point || calcWeight == null) return null;
    return simulate(live, point.lng, point.lat, calcWeight);
  }, [live, point, calcWeight]);

  const usePoint = async (lat: number, lng: number, addr?: Address) => {
    setPoint({ lat, lng });
    setLatIn(lat.toFixed(6));
    setLngIn(lng.toFixed(6));
    setAddress(addr ?? (await reverseGeocode(lat, lng)));
  };

  const calculate = async () => {
    setError(null);
    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0 || parsedWeight > 100000) {
      setError("Informe um peso válido em kg.");
      return;
    }
    setLoading(true);
    try {
      const clean = cep.replace(/\D/g, "");
      if (clean) {
        if (clean.length !== 8) throw new Error("O CEP deve ter 8 dígitos.");
        const g = await geocodeCep(clean);
        await usePoint(g.lat, g.lng, g.address);
      } else if (latIn && lngIn) {
        const lat = Number(latIn.replace(",", "."));
        const lng = Number(lngIn.replace(",", "."));
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
          throw new Error("Latitude/longitude inválidas.");
        await usePoint(lat, lng);
      } else if (!point) {
        throw new Error("Informe o CEP, a latitude/longitude ou clique no mapa.");
      }
      setCalcWeight(parsedWeight);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao calcular.");
    } finally {
      setLoading(false);
    }
  };

  const options = result?.options ?? [];
  const valid = options.filter((o) => o.price.ok);

  return (
    <div className="space-y-4">
      <section className="surface space-y-4 p-5">
        <h2 className="section-title text-xl">Simulador de Envio</h2>
        <div className="grid gap-3 sm:grid-cols-[160px_160px]">
          <label className="field-label">
            País *
            <select className="input mt-1" value="BRA" disabled>
              <option value="BRA">BRA — Brasil</option>
            </select>
          </label>
          <label className="field-label">
            Peso do pedido (kg) *
            <input
              className="input mt-1"
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </label>
        </div>
        <div className="grid items-end gap-3 md:grid-cols-[180px_auto_160px_160px]">
          <label className="field-label">
            CEP
            <input
              className="input mt-1"
              placeholder="00000-000"
              maxLength={9}
              value={cep}
              onChange={(e) => setCep(e.target.value)}
            />
          </label>
          <span className="pb-2 text-center text-sm font-semibold text-muted-foreground">ou</span>
          <label className="field-label">
            Latitude
            <input
              className="input mt-1"
              value={latIn}
              onChange={(e) => {
                setLatIn(e.target.value);
                setCep("");
              }}
            />
          </label>
          <label className="field-label">
            Longitude
            <input
              className="input mt-1"
              value={lngIn}
              onChange={(e) => {
                setLngIn(e.target.value);
                setCep("");
              }}
            />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          Ou clique em qualquer ponto do mapa abaixo para escolher o local.
        </p>
        <div className="flex items-center gap-3">
          <button className="btn-primary" onClick={calculate} disabled={loading || !live}>
            {loading ? "Calculando…" : "Calcular"}
          </button>
          {!live ? <span className="text-xs text-muted-foreground">Carregando dados…</span> : null}
          {error ? <span className="text-xs font-medium text-danger">{error}</span> : null}
        </div>
      </section>

      <section className="overflow-hidden surface">
        <ClientOnly fallback={<div className="h-[420px] w-full animate-pulse bg-muted" />}>
          <Suspense fallback={<div className="h-[420px] w-full animate-pulse bg-muted" />}>
            <div className="h-[420px]">
              <FreightMap
                visible={result?.hits ?? []}
                selectedId={null}
                tooltipFor={(r) => `${r.store} · ${r.id.split("|").pop()}`}
                onSelect={() => undefined}
                onMapClick={(lng, lat) => {
                  setCep("");
                  void usePoint(lat, lng);
                  setCalcWeight(Number.isFinite(parsedWeight) && parsedWeight > 0 ? parsedWeight : 1);
                }}
                fitKey={`sim|${result?.hits.map((h) => h.id).join(",") ?? ""}`}
                markerStores={[...new Set(options.map((o) => o.store))]}
              />
            </div>
          </Suspense>
        </ClientOnly>
      </section>

      {result && point ? (
        <>
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <section className="space-y-2">
              <h3 className="section-title text-lg">Pré-visualização do checkout</h3>
              <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4">
                <p className="mb-2 text-sm font-semibold">Escolha uma das opções de envio</p>
                {valid.length ? (
                  <ul className="divide-y divide-border rounded-lg border border-border bg-card text-sm">
                    {valid.map((o) => (
                      <li key={o.id} className="px-3 py-2">
                        {o.modality} ({o.store}) — {brl(o.price.total)} — {formatTimeCost(o.time)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma opção de envio para este local.
                  </p>
                )}
              </div>
            </section>
            <section className="space-y-2">
              <h3 className="section-title text-lg">Endereço</h3>
              <div className="surface grid grid-cols-2 gap-2 p-4 text-sm">
                <p className="col-span-2"><strong>CEP:</strong> {address?.cep ?? "—"}</p>
                <p><strong>Rua:</strong> {address?.street ?? "—"}</p>
                <p><strong>Bairro:</strong> {address?.district ?? "—"}</p>
                <p><strong>Cidade:</strong> {address?.city ?? "—"}</p>
                <p><strong>Estado:</strong> {address?.uf ?? "—"}</p>
                <p className="col-span-2 text-xs text-muted-foreground">
                  {point.lat.toFixed(6)}, {point.lng.toFixed(6)} · Peso {kg(calcWeight)}
                </p>
              </div>
            </section>
          </div>

          <section className="surface space-y-2 p-4">
            <h3 className="text-sm font-semibold">Melhores opções de envio segundo custo-benefício</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="p-2">Loja / Modalidade</th>
                    <th className="p-2">Tipo</th>
                    <th className="p-2">Tarifa de envio</th>
                    <th className="p-2">Prazo de entrega total</th>
                    <th className="p-2">Peso</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {options.map((o) => (
                    <OptionRow
                      key={o.id}
                      o={o}
                      weight={calcWeight ?? 0}
                      open={open === o.id}
                      onToggle={() => setOpen(open === o.id ? null : o.id)}
                    />
                  ))}
                  {options.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-muted-foreground">
                        Nenhuma tabela de frete de entrega ou retira cobre este local.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function OptionRow({
  o,
  weight,
  open,
  onToggle,
}: {
  o: SimOption;
  weight: number;
  open: boolean;
  onToggle: () => void;
}) {
  const p = o.price;
  return (
    <>
      <tr className="border-b border-border align-top">
        <td className="p-2">
          <p className="font-semibold">{o.store}</p>
          <span className="inline-block rounded bg-primary px-1.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
            {o.modality}
          </span>
        </td>
        <td className="p-2">{o.kind}</td>
        <td className="p-2 tabular-nums">{p.ok ? brl(p.total) : <span className="text-danger">{p.message}</span>}</td>
        <td className="p-2">
          {formatTimeCost(o.time)}
          {o.time ? <span className="block text-[11px] text-muted-foreground">{o.time}</span> : null}
        </td>
        <td className="p-2">{kg(weight)}</td>
        <td className="p-2">
          <button className="text-xs font-medium text-primary hover:underline" onClick={onToggle}>
            {open ? "Ocultar detalhes" : "Mostrar detalhes"}
          </button>
        </td>
      </tr>
      {open ? (
        <tr className="border-b border-border bg-muted/30 text-xs">
          <td colSpan={6} className="space-y-1 p-3">
            <p><strong>Tabela:</strong> {o.table}</p>
            <p><strong>Polígono:</strong> {o.polygon}</p>
            {p.ok && p.band ? (
              o.kind === "Retira" ? (
                <p>Valor único da retira (sem adicional por peso excedente): {brl(p.total)}</p>
              ) : (
                <>
                  <p>
                    <strong>Faixa:</strong> {p.band.ws} – {p.band.we} kg
                  </p>
                  <p>
                    Valor base {brl(p.basePrice)} + {p.extraWeight.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} kg excedente ×{" "}
                    {brl(p.extraRate)}/kg = <strong>{brl(p.total)}</strong>
                  </p>
                </>
              )
            ) : null}
          </td>
        </tr>
      ) : null}
    </>
  );
}
