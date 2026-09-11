# Reconstroi src/data/freight-data.json:
# - mantem Aricanduva e Suzano ja existentes
# - adiciona as 9 lojas da planilha Cardapio_Frete_por_Loja_final.xlsx
#   (tarifas nas abas por loja + coordenadas WKT nas abas DE_PARA_*)
import json, math, re, os
import pandas as pd

XLSX = "/mnt/user-uploads/Cardapio_Frete_por_Loja_final.xlsx"
OUT = "/dev-server/src/data/freight-data.json"
TOL = 0.0004

SHEETS = {
    "JACAREPAGUA": ("Jacarepagua", "RJ"),
    "GUADALUPE": ("Guadalupe", "RJ"),
    "DUQUE_DE_CAXIAS": ("Duque de Caxias", "RJ"),
    "BENFICA": ("Benfica", "RJ"),
    "MESQUITA": ("Mesquita", "RJ"),
    "NITEROI": ("Niteroi", "RJ"),
    "PRAIA_GRANDE": ("Praia Grande", "SP"),
    "PIRACICABA": ("Piracicaba", "SP"),
    "MOOCA": ("Mooca", "SP"),
}


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


def parse_wkt(wkt):
    """MultiPolygon/Polygon WKT -> [poligono][anel][ponto][lng,lat]"""
    s = str(wkt).strip()
    up = s.upper()
    if up.startswith("MULTIPOLYGON"):
        body = s[s.index("(") + 1 : s.rindex(")")]
        multi = True
    elif up.startswith("POLYGON"):
        body = s[s.index("(") + 1 : s.rindex(")")]
        multi = False
    else:
        return []

    def rings(txt):
        out = []
        for m in re.finditer(r"\(([^()]*)\)", txt):
            pts = []
            for pair in m.group(1).split(","):
                parts = pair.split()
                if len(parts) < 2:
                    continue
                pts.append([float(parts[0]), float(parts[1])])
            if len(pts) >= 4:
                out.append(pts)
        return out

    if not multi:
        rs = rings(body)
        return [rs] if rs else []

    polys, depth, start = [], 0, None
    for i, ch in enumerate(body):
        if ch == "(":
            if depth == 0:
                start = i
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth == 0 and start is not None:
                polys.append(body[start : i + 1])
                start = None
    out = []
    for p in polys:
        rs = rings(p)
        if rs:
            out.append(rs)
    return out


def num(v):
    try:
        f = float(v)
        return None if math.isnan(f) else f
    except Exception:
        return None


data = json.load(open(OUT, encoding="utf-8"))
keep = [p for p in data["polygons"] if p["store"] in ("Aricanduva", "Suzano")]
old_tariffs = data["tariffs"]

tariffs, tariff_index = [], {}
polygons = []
for p in keep:
    t = None
    if p["tariff"] is not None:
        bands = old_tariffs[p["tariff"]]
        key = json.dumps(bands, sort_keys=True)
        if key not in tariff_index:
            tariff_index[key] = len(tariffs)
            tariffs.append(bands)
        t = tariff_index[key]
    polygons.append({**p, "tariff": t})

stores = [s for s in data["stores"] if s["name"] in ("Aricanduva", "Suzano")]

xl = pd.ExcelFile(XLSX)
for sheet, (store, uf) in SHEETS.items():
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
        rates[str(name)] = bands

    geo = xl.parse(f"DE_PARA_{sheet}", header=1)
    geo.columns = [str(c).strip() for c in geo.columns]
    pts5 = []
    count = 0
    for _, row in geo.iterrows():
        name = str(row["PolygonName"]).strip()
        if not name or name == "nan":
            continue
        raw = parse_wkt(row["wkt_geom"])
        if not raw:
            continue
        rings_all, area = [], 0.0
        for poly in raw:
            sr = []
            for i, ring in enumerate(poly):
                s = simplify_ring(ring)
                sr.append(s)
                area += ring_area_m2(s) * (1 if i == 0 else -1)
            rings_all.append(sr)
        m = re.search(r"_(\d+)\s*km", name, re.I)
        radius = int(m.group(1)) if m else 0
        band = f"{radius}KM"
        district = re.split(r"_\d+\s*km", name, flags=re.I)[0].replace("_", " ").strip()
        bands = rates.get(name)
        tid = None
        if bands:
            key = json.dumps(bands, sort_keys=True)
            if key not in tariff_index:
                tariff_index[key] = len(tariffs)
                tariffs.append(bands)
            tid = tariff_index[key]
        xs = [c[0] for sr in rings_all for c in sr[0]]
        ys = [c[1] for sr in rings_all for c in sr[0]]
        cx, cy = sum(xs) / len(xs), sum(ys) / len(ys)
        if radius == 5:
            pts5.append((cx, cy, area))
        polygons.append(
            {
                "id": f"{store.replace(' ', '_')}_{name}",
                "store": store,
                "district": district or None,
                "uf": uf,
                "band": band,
                "radius": radius,
                "rMin": max(0, radius - 5),
                "rMax": radius,
                "areaKm2": round(area / 1e6, 3),
                "center": [round(cx, 5), round(cy, 5)],
                "tariff": tid,
                "geom": rings_all,
            }
        )
        count += 1
    tw = sum(a for _, _, a in pts5) or 1
    if pts5:
        cx = sum(x * a for x, _, a in pts5) / tw
        cy = sum(y * a for _, y, a in pts5) / tw
    else:
        cx, cy = 0.0, 0.0
    stores.append(
        {
            "name": store,
            "center": [round(cx, 5), round(cy, 5)],
            "note": "Ponto de referencia calculado como centroide ponderado dos poligonos de 5 km da planilha Cardapio_Frete_por_Loja_final.xlsx.",
        }
    )
    print(sheet, count, "poligonos")

out = {
    "generatedAt": data.get("generatedAt", ""),
    "sources": {
        "geojson": ["distritos_Aricanduva.geojson", "distritos_Suzano.geojson"],
        "excel": "TABELA_DE_PRECO_1.xls (Aricanduva, Suzano) + Cardapio_Frete_por_Loja_final.xlsx (demais lojas, coordenadas nas abas DE_PARA_*)",
    },
    "joinKey": "PolygonName (planilha) == PolygonName (aba DE_PARA da mesma loja)",
    "stores": stores,
    "tariffs": tariffs,
    "polygons": polygons,
}
json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(len(polygons), "poligonos,", len(tariffs), "tabelas,", round(os.path.getsize(OUT) / 1e6, 2), "MB")
