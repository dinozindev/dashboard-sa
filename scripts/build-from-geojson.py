# Reconstroi src/data/freight-data.json:
# - mantem Aricanduva e Suzano ja existentes
# - reconstroi as 9 lojas a partir dos GeoJSONs oficiais (geometria completa)
# - associa as tarifas das abas da planilha por nome normalizado (sem acento, minusculo)
import json, math, os, re, unicodedata
import pandas as pd

XLSX = "/mnt/user-uploads/Cardapio_Frete_por_Loja_final.xlsx"
OUT = "/dev-server/src/data/freight-data.json"
TOL = 0.0004

STORES = {
    "JACAREPAGUA": ("Jacarepagua", "RJ", "distritos_Jacarepagua.geojson"),
    "GUADALUPE": ("Guadalupe", "RJ", "distritos_Guadalupe.geojson"),
    "DUQUE_DE_CAXIAS": ("Duque de Caxias", "RJ", "distritos_Duque_de_Caxias.geojson"),
    "BENFICA": ("Benfica", "RJ", "distritos_Benfica.geojson"),
    "MESQUITA": ("Mesquita", "RJ", "distritos_Mesquita.geojson"),
    "NITEROI": ("Niteroi", "RJ", "distritos_Niteroi.geojson"),
    "PRAIA_GRANDE": ("Praia Grande", "SP", "distritos_Praia_Grande.geojson"),
    "PIRACICABA": ("Piracicaba", "SP", "distritos_Piracicaba.geojson"),
    "MOOCA": ("Mooca", "SP", "distritos_Mooca.geojson"),
}
GEODIR = "/mnt/user-uploads"


def norm(s):
    s = unicodedata.normalize("NFKD", str(s))
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"\s+", "", s).strip().lower()


def dp(pts, tol):
    if len(pts) < 3:
        return pts
    dmax, idx = 0, 0
    (x1, y1), (x2, y2) = pts[0], pts[-1]
    for i in range(1, len(pts) - 1):
        x0, y0 = pts[i]
        dx, dy = x2 - x1, y2 - y1
        den = math.hypot(dx, dy)
        d = abs(dy * x0 - dx * y0 + x2 * y1 - y2 * x1) / den if den else math.hypot(x0 - x1, y0 - y1)
        if d > dmax:
            dmax, idx = d, i
    if dmax > tol:
        return dp(pts[: idx + 1], tol)[:-1] + dp(pts[idx:], tol)
    return [pts[0], pts[-1]]


def simplify_ring(ring):
    r = dp(ring, TOL)
    if len(r) < 4:
        r = ring
    r = [[round(x, 5), round(y, 5)] for x, y in r]
    if r[0] != r[-1]:
        r.append(r[0])
    return r


def ring_area_m2(ring):
    lat0 = sum(p[1] for p in ring) / len(ring)
    k = math.cos(math.radians(lat0))
    R = 6378137.0
    s = 0
    for i in range(len(ring) - 1):
        x1, y1 = math.radians(ring[i][0]) * k * R, math.radians(ring[i][1]) * R
        x2, y2 = math.radians(ring[i + 1][0]) * k * R, math.radians(ring[i + 1][1]) * R
        s += x1 * y2 - x2 * y1
    return abs(s) / 2


def num(v):
    try:
        f = float(v)
        return None if math.isnan(f) else f
    except Exception:
        return None


data = json.load(open(OUT, encoding="utf-8"))
old_tariffs = data["tariffs"]
tariffs, tariff_index = [], {}
polygons = []
for p in data["polygons"]:
    if p["store"] not in ("Aricanduva", "Suzano"):
        continue
    t = None
    if p["tariff"] is not None:
        key = json.dumps(old_tariffs[p["tariff"]], sort_keys=True)
        if key not in tariff_index:
            tariff_index[key] = len(tariffs)
            tariffs.append(old_tariffs[p["tariff"]])
        t = tariff_index[key]
    polygons.append({**p, "tariff": t})

stores = [s for s in data["stores"] if s["name"] in ("Aricanduva", "Suzano")]

xl = pd.ExcelFile(XLSX)
for sheet, (store, uf, geofile) in STORES.items():
    rates = {}
    df = xl.parse(sheet)
    for name, grp in df.groupby("PolygonName"):
        bands = []
        for _, r in grp.iterrows():
            bands.append(
                {
                    "ws": num(r["WeightStart"]),
                    "we": num(r["WeightEnd"]),
                    "amc": num(r["AbsoluteMoneyCost"]),
                    "pew": num(r["PriceByExtraWeight"]),
                    "pct": num(r.get("PricePercent")),
                    "maxVol": num(r.get("MaxVolume")),
                    "time": None if pd.isna(r.get("TimeCost")) else str(r.get("TimeCost")),
                    "country": None if pd.isna(r.get("Country")) else str(r.get("Country")),
                    "minIns": num(r.get("MinimumValueInsurance")),
                }
            )
        bands.sort(key=lambda b: b["ws"] if b["ws"] is not None else 0)
        rates[norm(name)] = (str(name), bands)

    # A aba DE_PARA lista os PolygonName na MESMA ordem das feicoes do GeoJSON
    # (contagens identicas e centroides coincidentes), servindo de ponte quando
    # o nome do GeoJSON usa o distrito e a planilha usa o municipio.
    depara = xl.parse(f"DE_PARA_{sheet}", header=1)
    depara.columns = [str(c).strip() for c in depara.columns]
    order = [str(v).strip() for v in depara["PolygonName"].tolist()]

    gj = json.load(open(os.path.join(GEODIR, geofile), encoding="utf-8"))
    if len(order) != len(gj["features"]):
        print(f"AVISO {store}: DE_PARA {len(order)} x GeoJSON {len(gj['features'])}")
    pts5, matched, total = [], 0, 0
    for fi, f in enumerate(gj["features"]):
        pr = f["properties"]
        g = f["geometry"]
        raw = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        rings_all, area = [], 0.0
        for poly in raw:
            sr = []
            for i, ring in enumerate(poly):
                s = simplify_ring(ring)
                sr.append(s)
                area += ring_area_m2(s) * (1 if i == 0 else -1)
            rings_all.append(sr)
        if not rings_all:
            continue
        total += 1
        gname = str(pr.get("Nome_Poligono"))
        hit = rates.get(norm(gname))
        if not hit and fi < len(order):
            hit = rates.get(norm(order[fi]))
        tid = None
        if hit:
            matched += 1
            key = json.dumps(hit[1], sort_keys=True)
            if key not in tariff_index:
                tariff_index[key] = len(tariffs)
                tariffs.append(hit[1])
            tid = tariff_index[key]
        radius = pr.get("Raio_Max")
        radius = int(radius / 1000) if radius else 0
        m = re.search(r"_(\d+)\s*km", gname, re.I)
        if m:
            radius = int(m.group(1))
        district = str(pr.get("NM_DIST") or "").replace("_", " ").strip() or None
        polygons.append(
            {
                "id": f"{store.replace(' ', '_')}_{gname}",
                "store": store,
                "district": district,
                "uf": uf,
                "band": f"{radius}KM",
                "radius": radius,
                "rMin": (pr.get("Raio_Min") or 0) / 1000 if pr.get("Raio_Min") is not None else max(0, radius - 5),
                "rMax": radius,
                "areaKm2": round(area / 1e6, 3),
                "center": [
                    round(sum(c[0] for sr in rings_all for c in sr[0]) / sum(len(sr[0]) for sr in rings_all), 5),
                    round(sum(c[1] for sr in rings_all for c in sr[0]) / sum(len(sr[0]) for sr in rings_all), 5),
                ],
                "tariff": tid,
                "tariffName": hit[0] if hit else None,
                "geom": rings_all,
            }
        )
        if radius == 5:
            cx = sum(c[0] for sr in rings_all for c in sr[0]) / sum(len(sr[0]) for sr in rings_all)
            cy = sum(c[1] for sr in rings_all for c in sr[0]) / sum(len(sr[0]) for sr in rings_all)
            pts5.append((cx, cy, area))
    tw = sum(a for _, _, a in pts5) or 1
    cx = sum(x * a for x, _, a in pts5) / tw if pts5 else 0.0
    cy = sum(y * a for _, y, a in pts5) / tw if pts5 else 0.0
    stores.append(
        {
            "name": store,
            "center": [round(cx, 5), round(cy, 5)],
            "note": "Ponto de referencia calculado como centroide ponderado dos poligonos de 5 km do GeoJSON da loja.",
        }
    )
    print(f"{store}: {total} poligonos do GeoJSON, {matched} com tarifa ({len(rates)} na planilha)")

out = {
    "generatedAt": data.get("generatedAt", ""),
    "sources": {
        "geojson": sorted(
            ["distritos_Aricanduva.geojson", "distritos_Suzano.geojson"] + [g for _, _, g in STORES.values()]
        ),
        "excel": "TABELA_DE_PRECO_1.xls (Aricanduva, Suzano) + Cardapio_Frete_por_Loja_final.xlsx (tarifas das demais lojas)",
    },
    "joinKey": "GeoJSON.Nome_Poligono == Excel.PolygonName (comparacao sem acentos, minusculo)",
    "stores": stores,
    "tariffs": tariffs,
    "polygons": polygons,
}
json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(len(polygons), "poligonos,", len(tariffs), "tabelas,", round(os.path.getsize(OUT) / 1e6, 2), "MB")
