import json, math, os, sys
sys.path.insert(0,'/dev-server/scripts')
TOL=0.0004
def dp(pts,tol):
    if len(pts)<3: return pts
    dmax,idx=0,0
    (x1,y1),(x2,y2)=pts[0],pts[-1]
    for i in range(1,len(pts)-1):
        x0,y0=pts[i]
        dx,dy=x2-x1,y2-y1
        den=math.hypot(dx,dy)
        d=abs(dy*x0-dx*y0+x2*y1-y2*x1)/den if den else math.hypot(x0-x1,y0-y1)
        if d>dmax: dmax,idx=d,i
    if dmax>tol:
        return dp(pts[:idx+1],tol)[:-1]+dp(pts[idx:],tol)
    return [pts[0],pts[-1]]
def simplify_ring(ring):
    r=dp(ring,TOL)
    if len(r)<4: r=ring
    r=[[round(x,5),round(y,5)] for x,y in r]
    if r[0]!=r[-1]: r.append(r[0])
    return r
def ring_area_m2(ring):
    lat0=sum(p[1] for p in ring)/len(ring); k=math.cos(math.radians(lat0)); R=6378137.0; s=0
    for i in range(len(ring)-1):
        x1,y1=math.radians(ring[i][0])*k*R, math.radians(ring[i][1])*R
        x2,y2=math.radians(ring[i+1][0])*k*R, math.radians(ring[i+1][1])*R
        s+=x1*y2-x2*y1
    return abs(s)/2

p="/dev-server/src/data/freight-data.json"
out=json.load(open(p,encoding="utf-8"))
existing={x["store"] for x in out["polygons"]}
NEW={"Mooca":"/mnt/user-uploads/Mooca.geojson",
     "Praia Grande":"/mnt/user-uploads/Praia_grande.geojson",
     "Piracicaba":"/mnt/user-uploads/Piracicaba.geojson"}
out["polygons"]=[x for x in out["polygons"] if x["store"] not in NEW]
out["stores"]=[s for s in out["stores"] if s["name"] not in NEW]
for store,path in NEW.items():
    gj=json.load(open(path,encoding="utf-8")); pts5=[]
    for f in gj["features"]:
        pr=f["properties"]; g=f["geometry"]
        polys=g["coordinates"] if g["type"]=="MultiPolygon" else [g["coordinates"]]
        rings,area=[],0.0
        for poly in polys:
            sr=[]
            for i,ring in enumerate(poly):
                s=simplify_ring(ring); sr.append(s); area+=ring_area_m2(s)*(1 if i==0 else -1)
            rings.append(sr)
        if not rings: continue
        band=str(pr.get("Faixa","")).upper()
        xs=[c[0] for s in rings for c in s[0]]; ys=[c[1] for s in rings for c in s[0]]
        cx,cy=sum(xs)/len(xs),sum(ys)/len(ys)
        if band=="5KM": pts5.append((cx,cy,area))
        out["polygons"].append({"id":pr.get("Nome_Poligono"),"store":store,
            "district":pr.get("NM_DIST"),"uf":pr.get("NM_UF"),"band":band,
            "radius":pr.get("Raio"),"rMin":pr.get("Raio_Min"),"rMax":pr.get("Raio_Max"),
            "areaKm2":round(area/1e6,3),"center":[round(cx,5),round(cy,5)],
            "tariff":None,"geom":rings})
    tw=sum(a for _,_,a in pts5) or 1
    out["stores"].append({"name":store,
        "center":[round(sum(x*a for x,_,a in pts5)/tw,5),round(sum(y*a for _,y,a in pts5)/tw,5)],
        "note":"Ponto de referencia calculado como centroide ponderado dos poligonos da faixa 5KM do GeoJSON. Sem tabela de frete."})
out["sources"]["geojson"]=sorted(set(out["sources"]["geojson"])|{"Mooca.geojson","Praia_grande.geojson","Piracicaba.geojson"})
json.dump(out,open(p,"w",encoding="utf-8"),ensure_ascii=False,separators=(",",":"))
print(len(out["polygons"]),"poligonos", [s["name"] for s in out["stores"]], round(os.path.getsize(p)/1e6,2),"MB")
