"""Robot de GitHub Actions: cada ~5 min guarda una lectura del juego en historial.json
(rama 'datos'). La web la lee para las graficas, ayer y los ultimos 7 dias."""
import json, sys, time, urllib.request

UNIVERSO = 10741812327
GUARDAR = 14 * 86400  # 14 dias de historial
ruta = sys.argv[1]


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "dtt-stats/1.0"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read().decode("utf-8"))


try:
    datos = json.load(open(ruta, encoding="utf-8"))
except Exception:
    datos = {}
filas = datos.get("filas", [])

g = get(f"https://games.roblox.com/v1/games?universeIds={UNIVERSO}")["data"][0]
v = get(f"https://games.roblox.com/v1/games/votes?universeIds={UNIVERSO}")["data"][0]
servidores, cursor = [], ""
for _ in range(5):
    try:
        r = get(f"https://games.roblox.com/v1/games/{g['rootPlaceId']}/servers/Public?limit=100&cursor={cursor}")
    except Exception:
        break
    servidores += [{"playing": s.get("playing", 0), "max": s.get("maxPlayers", 0),
                    "fps": round(s.get("fps") or 0), "ping": s.get("ping") or 0} for s in r.get("data", [])]
    cursor = r.get("nextPageCursor")
    if not cursor:
        break

grupo = None
creador = g.get("creator") or {}
if creador.get("type") == "Group":
    try:
        grupo = get(f"https://groups.roblox.com/v1/groups/{creador['id']}")
    except Exception:
        grupo = None

# imagenes de la pagina del juego (se piden pocas veces: se reutilizan si ya estan)
imagenes = datos.get("imagenes") or []
if not imagenes or len(filas) % 72 == 0:
    try:
        ids = [m["imageId"] for m in get(f"https://games.roblox.com/v2/games/{UNIVERSO}/media")["data"] if m.get("imageId")]
        if ids:
            th = get("https://thumbnails.roblox.com/v1/assets?assetIds=" + ",".join(map(str, ids[:10]))
                     + "&returnPolicy=PlaceHolder&size=768x432&format=Png")["data"]
            imagenes = [x["imageUrl"] for x in th if x.get("imageUrl")]
    except Exception:
        pass

ahora = int(time.time())
fila = {"t": ahora, "playing": g["playing"], "visits": g["visits"], "fav": g["favoritedCount"],
        "up": v["upVotes"], "down": v["downVotes"]}
if grupo:
    fila["grp"] = grupo.get("memberCount")
filas.append(fila)
filas = [f for f in filas if f["t"] >= ahora - GUARDAR]

datos = {
    "filas": filas,
    "servidores": servidores,
    "serversT": ahora,
    "imagenes": imagenes,
    "grupo": {"name": grupo.get("name"), "members": grupo.get("memberCount"), "id": grupo.get("id")} if grupo else None,
    "juego": {k: g.get(k) for k in ("name", "rootPlaceId", "description", "created", "updated", "maxPlayers",
                                     "genre_l1", "universeAvatarType", "createVipServersAllowed", "copyingAllowed",
                                     "price", "isContentRestricted", "canonicalUrlPath")},
}
json.dump(datos, open(ruta, "w", encoding="utf-8"), separators=(",", ":"))
print(f"ok: {len(filas)} lecturas, {g['playing']} jugando, {len(servidores)} servidores")
