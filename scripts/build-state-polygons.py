"""
GERA OS POLÍGONOS ESTADUAIS (RETIRA)
====================================

Entradas reais enviadas pelo usuário (nada é aproximado ou inventado):
  - Polígono_SP.txt            -> anel único [[lng,lat], ...] do estado de São Paulo
  - RIO_DE_JANEIRO_RETIRA.geojson -> FeatureCollection de municípios do RJ

Saída: src/data/state-polygons.json no formato MultiPolygon usado no mapa
       (geom[poligono][anel][ponto][lng, lat]).

As geometrias são apenas simplificadas (Douglas-Peucker) para caber no bundle;
nenhum contorno é criado artificialmente.
"""

import json
import os

SRC_SP = "/mnt/user-uploads/Polígono_SP.txt"
SRC_RJ = "/mnt/user-uploads/RIO_GEOJSON.geojson"
OUT = "src/data/state-polygons.json"
TOL = 0.004  # ~400 m: suficiente para o contorno estadual


def simplify(points, tol):
    if len(points) < 3:
        return points
    stack = [(0, len(points) - 1)]
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    while stack:
        i, j = stack.pop()
        ax, ay = points[i]
        bx, by = points[j]
        dx, dy = bx - ax, by - ay
        norm = (dx * dx + dy * dy) ** 0.5 or 1e-12
        best, bi = 0.0, None
        for k in range(i + 1, j):
            px, py = points[k]
            d = abs(dy * px - dx * py + bx * ay - by * ax) / norm
            if d > best:
                best, bi = d, k
        if bi is not None and best > tol:
            keep[bi] = True
            stack.append((i, bi))
            stack.append((bi, j))
    return [p for p, k in zip(points, keep) if k]


def simplify_ring(pts, tol):
    """Anéis fechados têm início == fim; simplifica em duas metades para não
    degenerar a linha-base do Douglas-Peucker."""
    if len(pts) < 8:
        return pts
    mid = len(pts) // 2
    return simplify(pts[: mid + 1], tol)[:-1] + simplify(pts[mid:], tol)


def ring(coords):
    pts = simplify_ring([[round(float(x), 5), round(float(y), 5)] for x, y in coords], TOL)
    if len(pts) < 4:
        return None
    if pts[0] != pts[-1]:
        pts.append(pts[0])
    return pts


def area(pts):
    s = 0.0
    for i in range(len(pts) - 1):
        s += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1]
    return abs(s) / 2


def from_geometry(geom, out):
    t = geom.get("type")
    if t == "Polygon":
        polys = [geom["coordinates"]]
    elif t == "MultiPolygon":
        polys = geom["coordinates"]
    else:
        return
    for poly in polys:
        rings = [r for r in (ring(c) for c in poly) if r]
        if not rings:
            continue
        if area(rings[0]) < 0.0005:  # descarta ilhotas irrelevantes na escala estadual
            continue
        out.append(rings)


def build_sp():
    with open(SRC_SP, encoding="utf-8") as f:
        coords = json.load(f)
    r = ring(coords)
    if not r:
        raise SystemExit("Polígono de SP inválido")
    return {"uf": "SP", "name": "São Paulo", "geom": [[r]]}


def build_rj():
    with open(SRC_RJ, encoding="utf-8") as f:
        fc = json.load(f)
    polys = []
    for feat in fc.get("features", []):
        g = feat.get("geometry")
        if g:
            from_geometry(g, polys)
    if not polys:
        raise SystemExit("Nenhuma geometria encontrada no GeoJSON do RJ")
    return {"uf": "RJ", "name": "Rio de Janeiro", "geom": polys}


def main():
    data = {
        "source": "Polígono_SP.txt e RIO_GEOJSON.geojson enviados pelo usuário "
        "(contornos reais, apenas simplificados para exibição).",
        "generatedBy": "scripts/build-state-polygons.py",
        "states": [build_sp(), build_rj()],
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    for s in data["states"]:
        pts = sum(len(r) for p in s["geom"] for r in p)
        print(f"{s['uf']}: {len(s['geom'])} polígonos, {pts} pontos")
    print("tamanho:", round(os.path.getsize(OUT) / 1024), "KB")


main()
