/**
 * LEITURA DE PLANILHAS DE FRETE (.xlsx)
 * =====================================
 *
 * Interpreta a planilha enviada no navegador e extrai as faixas de peso
 * (Weight_Start, Weight_End, AbsoluteMoneyCost, PriceByExtraWeight e extras).
 * Colunas são reconhecidas por nome (inglês ou português), sem presumir ordem.
 */

import type { WeightBand } from "./types";

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

const HEADER_ALIASES: Record<string, string[]> = {
  ws: ["weightstart", "pesoinicial", "pesoinicio", "inicio", "pesode", "iniciodofaixa", "iniciofaixa"],
  we: ["weightend", "pesofinal", "fim", "pesoate", "fimdaFaixa".toLowerCase(), "fimfaixa"],
  amc: ["absolutemoneycost", "valorfixo", "preco", "preobase", "precobase", "precopadrao"],
  pew: [
    "pricebyextraweight",
    "adicionalporkg",
    "adicionalkg",
    "valoradicional",
    "precoadicionalkg",
    "precoextra",
    "adicionalexcedente",
    "precoportkgadicional",
  ],
  pct: ["pricepercent", "percentual", "percentualpreco"],
  maxVol: ["maxvolume", "volumemaximo", "maxvol"],
  time: ["timecost", "prazo"],
  country: ["country", "pais"],
  minIns: ["minimumvalueinsurance", "valorminimoseguro", "seguro"],
  polygonName: ["polygonname", "nomepoligono", "nomedopoligono", "poligono"],
};

function toNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v).replace(/[R$\s\u00a0]/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export interface FreightSheet {
  bands: WeightBand[];
  /** Nome do polígono informado na planilha (ex.: SAO_PAULO_RETIRA), quando houver */
  polygonName: string | null;
}

/** Lê o conteúdo de um arquivo .xlsx/.xls e devolve as faixas de peso ordenadas. */
export async function parseBandsFromXlsx(data: ArrayBuffer): Promise<WeightBand[]> {
  return (await parseFreightSheet(data)).bands;
}

/** Lê a planilha e devolve faixas de peso + nome do polígono (quando presente). */
export async function parseFreightSheet(data: ArrayBuffer): Promise<FreightSheet> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(data, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName || !wb.Sheets[sheetName]) throw new Error("A planilha está vazia.");
  const sheet = wb.Sheets[sheetName]!;
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });

  let headerIdx = -1;
  let colMap: Record<string, number> | null = null;
  const limit = Math.min(rows.length, 25);
  for (let i = 0; i < limit; i++) {
    const cells = (rows[i] ?? []).map((c) => (c == null ? "" : norm(String(c))));
    const map: Record<string, number> = {};
    cells.forEach((c, ci) => {
      for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
        if (map[field] != null) return;
        if (aliases.includes(c)) map[field] = ci;
      }
    });
    if (map["ws"] != null && map["we"] != null && (map["amc"] != null || map["pew"] != null)) {
      headerIdx = i;
      colMap = map;
      break;
    }
  }
  if (!colMap) {
    throw new Error(
      "Não encontrei as colunas de faixa de peso (Peso Inicial/Peso Final e Preço) na primeira aba da planilha.",
    );
  }

  const cell = (row: unknown[], field: string): unknown => {
    const ci = colMap![field];
    return ci == null ? null : row[ci];
  };
  const text = (row: unknown[], field: string): string | null => {
    const v = cell(row, field);
    return v == null || v === "" ? null : String(v);
  };

  const bands: WeightBand[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (!row || !row.length) continue;
    const ws = toNumber(cell(row, "ws"));
    const we = toNumber(cell(row, "we"));
    const amc = toNumber(cell(row, "amc"));
    const pew = toNumber(cell(row, "pew"));
    if (ws == null && we == null && amc == null && pew == null) continue;
    bands.push({
      ws,
      we,
      amc,
      pew,
      pct: toNumber(cell(row, "pct")),
      maxVol: toNumber(cell(row, "maxVol")),
      time: text(row, "time"),
      country: text(row, "country"),
      minIns: toNumber(cell(row, "minIns")),
    });
  }

  bands.sort((a, b) => (a.ws ?? -1) - (b.ws ?? -1));
  if (!bands.length) throw new Error("A planilha não contém faixas de peso válidas.");
  return bands;
}
