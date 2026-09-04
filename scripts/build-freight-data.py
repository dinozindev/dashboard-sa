# Gera src/data/freight-data.json a partir dos arquivos originais (somente leitura).
import json, math, pandas as pd, os

SRC_XLSX = "/tmp/t.xlsx"  # conversao do TABELA_DE_PRECO_1.xls (BIFF) via libreoffice
GEO = {"Aricanduva": "/mnt/user-uploads/distritos_Aricanduva.geojson",
       "Suzano": "/mnt/user-uploads/distritos_Suzano.geojson"}
TOL = 0.0004

def num(v):
    if v is None: return None
    s = str(v).strip()
    if s in ("", "nan"): return None
    s = s.replace(".", "") if s.count(",") == 1 and s.count(".") > 1 else s
    s = s.replace(",", ".")
    try: return float(s)
    except: return None

def dp(pts, tol):
    if len(pts) < 3: return pts
    dmax, idx = 0, 0
    (x1, y1), (x2, y2) = pts[0], pts[-1]
    for i in range(1, len(pts) - 1):
        x0, y0 = pts[i]
        dx, dy = x2 - x1, y2 - y1
        den = math.hypot(dx, dy)
        d = abs(dy * x0 - dx * y0 + x2 * y1 - y2 * x1) / den if den else math.hypot(x0 - x1, y0 - y1)
        if d > dmax: dmax, idx = d, i
    if dmax > tol:
        return dp(pts[:idx + 1], tol)[:-1] + dp(pts[idx:], tol)
    return [pts[0], pts[-1]]

def simplify_ring(ring):
    r = dp(ring, TOL)
    if len(r) < 4: r = ring
    r = [[round(x, 5), round(y, 5)] for x, y in r]
    if r[0] != r[-1]: r.append(r[0])
    return r

def ring_area_m2(ring):  # shoelace em projecao equirretangular local
    lat0 = sum(p[1] for p in ring) / len(ring)
    k = math.cos(math.radians(lat0))
    R = 6378137.0
    s = 0
    for i in range(len(ring) - 1):
        x1, y1 = math.radians(ring[i][0]) * k * R, math.radians(ring[i][1]) * R
        x2, y2 = math.radians(ring[i + 1][0]) * k * R, math.radians(ring[i + 1][1]) * R
        s += x1 * y2 - x2 * y1
    return abs(s) / 2

xl = pd.ExcelFile(SRC_XLSX)
tariff_index, tariffs = {}, []
polygons, stores = [], []

for store, path in GEO.items():
    df = xl.parse(store)
    rates = {}
    for name, grp in df.groupby("PolygonName"):
        bands = []
        for _, r in grp.iterrows():
            bands.append({
                "ws": num(r["WeightStart"]), "we": num(r["WeightEnd"]),
                "amc": num(r["AbsoluteMoneyCost"]), "pew": num(r["PriceByExtraWeight"]),
            })
        bands.sort(key=lambda b: (b["ws"] if b["ws"] is not None else 0))
        rates[str(name)] = bands
    gj = json.load(open(path, encoding="utf-8"))
    pts5, feats = [], []
    for f in gj["features"]:
        p = f["properties"]; g = f["geometry"]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        rings, area = [], 0.0
        for poly in polys:
            srings = []
            for i, ring in enumerate(poly):
                sr = simplify_ring(ring)
                srings.append(sr)
                area += ring_area_m2(sr) * (1 if i == 0 else -1)
            rings.append(srings)
        if not rings: continue
        name = p.get("Nome_Poligono")
        bands = rates.get(name)
        key = json.dumps(bands, sort_keys=True) if bands else None
        tid = None
        if key is not None:
            if key not in tariff_index:
                tariff_index[key] = len(tariffs); tariffs.append(bands)
            tid = tariff_index[key]
        xs = [c[0] for sr in rings for c in sr[0]]; ys = [c[1] for sr in rings for c in sr[0]]
        cx, cy = sum(xs) / len(xs), sum(ys) / len(ys)
        if p.get("Faixa") == "5KM": pts5.append((cx, cy, area))
        feats.append({
            "id": name, "store": store, "district": p.get("NM_DIST"), "uf": p.get("NM_UF"),
            "band": p.get("Faixa"), "radius": p.get("Raio"),
            "rMin": p.get("Raio_Min"), "rMax": p.get("Raio_Max"),
            "areaKm2": round(area / 1e6, 3), "center": [round(cx, 5), round(cy, 5)],
            "tariff": tid, "geom": rings,
        })
    polygons.extend(feats)
    tw = sum(a for _, _, a in pts5) or 1
    stores.append({
        "name": store,
        "center": [round(sum(x * a for x, _, a in pts5) / tw, 5), round(sum(y * a for _, y, a in pts5) / tw, 5)],
        "note": "Ponto de referencia calculado como centroide ponderado dos poligonos da faixa 5KM do GeoJSON.",
    })

out = {"generatedAt": "2026-09-02", "sources": {
        "geojson": ["distritos_Aricanduva.geojson", "distritos_Suzano.geojson"],
        "excel": "TABELA_DE_PRECO_1.xls (abas Aricanduva, Suzano)"},
       "joinKey": "GeoJSON.Nome_Poligono == Excel.PolygonName",
       "stores": stores, "tariffs": tariffs, "polygons": polygons}
p = "/dev-server/src/data/freight-data.json"
json.dump(out, open(p, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(len(polygons), "poligonos,", len(tariffs), "tabelas unicas,", round(os.path.getsize(p) / 1e6, 2), "MB")
