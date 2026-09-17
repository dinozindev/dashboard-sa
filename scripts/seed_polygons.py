"""Seed dos polígonos base (coleção sem política) via RPC insert_polygons.
Uso: python3 scripts/seed_polygons.py
Requer SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY no ambiente."""
import json, os, sys, urllib.request

url = os.environ['SUPABASE_URL'].rstrip('/')
key = os.environ['SUPABASE_PUBLISHABLE_KEY']

def req(path, payload=None, method=None):
    r = urllib.request.Request(url + path, method=method or ('POST' if payload is not None else 'GET'))
    r.add_header('apikey', key)
    if payload is not None:
        r.add_header('Content-Type', 'application/json')
        r.add_header('Prefer', 'return=minimal')
    with urllib.request.urlopen(r, (json.dumps(payload) if payload is not None else None).encode() if payload is not None else None) as resp:
        body = resp.read()
    return json.loads(body) if body else None

stores = {s['name']: s['id'] for s in req('/rest/v1/stores?select=id,name')}
d = json.load(open('src/data/freight-data.json'))

rows = []
for p in d['polygons']:
    sid = stores.get(p['store'])
    if not sid:
        print('loja ausente:', p['store']); continue
    rows.append({
        'clientId': 'seed|' + p['id'],
        'storeId': sid,
        'policyId': None,
        'district': p.get('district'),
        'uf': p.get('uf'),
        'band': p.get('band'),
        'radius': p.get('radius'),
        'rMin': p.get('rMin'),
        'rMax': p.get('rMax'),
        'areaKm2': p.get('areaKm2'),
        'centerLng': (p.get('center') or [None, None])[0],
        'centerLat': (p.get('center') or [None, None])[1],
        'geojson': {'type': 'MultiPolygon', 'coordinates': p['geom']},
    })

print('rows:', len(rows))
total = 0
for i in range(0, len(rows), 300):
    chunk = rows[i:i+300]
    res = req('/rest/v1/rpc/insert_polygons', chunk)
    total += res or 0
    print(f'lote {i//300+1}: {res} inseridas ({i+len(chunk)}/{len(rows)})', flush=True)
print('total inseridas:', total)
