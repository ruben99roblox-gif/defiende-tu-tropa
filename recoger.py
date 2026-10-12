"""Robot de GitHub Actions: cada ~5 min guarda una lectura del juego en historial.json
(rama 'datos'). La web la lee para graficas, comparativas, records, servidores, tienda...
Lo que apenas cambia (tienda, grupo, competencia, lugares) se pide una vez por hora."""
import json, sys, time, urllib.request

UNIVERSO = 10741812327
GUARDAR = 30 * 86400  # 30 dias de historial
ruta = sys.argv[1]


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "dtt-stats/1.0"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read().decode("utf-8"))


def intentar(f, defecto=None):
    try:
        return f()
    except Exception as e:
        print("aviso:", e)
        return defecto


try:
    datos = json.load(open(ruta, encoding="utf-8"))
except Exception:
    datos = {}
filas = datos.get("filas", [])
ahora = int(time.time())
cada_hora = ahora - datos.get("lentoT", 0) >= 3300

g = get(f"https://games.roblox.com/v1/games?universeIds={UNIVERSO}")["data"][0]
v = get(f"https://games.roblox.com/v1/games/votes?universeIds={UNIVERSO}")["data"][0]
place = g["rootPlaceId"]

# servidores (con id para poder unirse desde la web)
servidores, cursor = [], ""
for _ in range(5):
    r = intentar(lambda: get(f"https://games.roblox.com/v1/games/{place}/servers/Public?limit=100&cursor={cursor}"))
    if not r:
        break
    servidores += [{"id": s.get("id"), "playing": s.get("playing", 0), "max": s.get("maxPlayers", 0),
                    "fps": round(s.get("fps") or 0), "ping": s.get("ping") or 0} for s in r.get("data", [])]
    cursor = r.get("nextPageCursor")
    if not cursor:
        break

creador = g.get("creator") or {}
gid = creador.get("id") if creador.get("type") == "Group" else None
grupo = intentar(lambda: get(f"https://groups.roblox.com/v1/groups/{gid}")) if gid else None

# historial de actualizaciones del juego (cuando cambia 'updated')
actualizaciones = datos.get("actualizaciones", [])
if g.get("updated") and (not actualizaciones or actualizaciones[-1] != g["updated"]):
    actualizaciones.append(g["updated"])
actualizaciones = actualizaciones[-60:]

# competencia: juegos que Roblox recomienda junto al tuyo (cada vez: cambia rapido)
similares = intentar(lambda: [{"name": x.get("name"), "universeId": x.get("universeId"), "placeId": x.get("placeId"),
                               "playing": x.get("playerCount", 0), "up": x.get("totalUpVotes", 0), "down": x.get("totalDownVotes", 0)}
                              for x in get(f"https://games.roblox.com/v1/games/recommendations/game/{UNIVERSO}?maxRows=12")["games"]],
                     datos.get("similares", []))

lento = datos.get("lento", {})
if cada_hora or not lento:
    def thumbs(tipo, ids, size="150x150"):
        if not ids:
            return {}
        r = get(f"https://thumbnails.roblox.com/v1/{tipo}?{'gamePassIds' if tipo == 'game-passes' else 'assetIds'}="
                + ",".join(map(str, ids[:50])) + f"&size={size}&format=Png&returnPolicy=PlaceHolder")
        return {x["targetId"]: x.get("imageUrl") for x in r.get("data", [])}

    pases = intentar(lambda: get(f"https://apis.roblox.com/game-passes/v1/universes/{UNIVERSO}/game-passes?passView=Full&pageSize=100")["gamePasses"], [])
    tp = intentar(lambda: thumbs("game-passes", [p["id"] for p in pases]), {})
    prods = intentar(lambda: get(f"https://apis.roblox.com/developer-products/v2/universes/{UNIVERSO}/developerproducts?limit=100")["developerProducts"], [])
    ti = intentar(lambda: thumbs("assets", [p.get("IconImageAssetId") for p in prods if p.get("IconImageAssetId")]), {})
    ids_media = intentar(lambda: [m["imageId"] for m in get(f"https://games.roblox.com/v2/games/{UNIVERSO}/media")["data"] if m.get("imageId")], [])
    tm = intentar(lambda: thumbs("assets", ids_media[:10], "768x432"), {})
    lento = {
        "pases": [{"id": p["id"], "name": p.get("displayName") or p.get("name"), "price": p.get("price"),
                   "forSale": p.get("isForSale"), "icon": tp.get(p["id"]), "created": p.get("created")} for p in pases],
        "productos": [{"id": p.get("ProductId"), "name": p.get("displayName") or p.get("Name"), "price": p.get("PriceInRobux"),
                       "forSale": p.get("IsForSale"), "icon": ti.get(p.get("IconImageAssetId"))} for p in prods],
        "imagenes": [tm[i] for i in ids_media[:10] if tm.get(i)],
        "lugares": intentar(lambda: [{"id": p["id"], "name": p["name"]} for p in get(f"https://develop.roblox.com/v1/universes/{UNIVERSO}/places?limit=50")["data"]], []),
        "juegosGrupo": intentar(lambda: [{"name": x.get("name"), "id": x.get("id"), "placeId": (x.get("rootPlace") or {}).get("id"),
                                         "visits": x.get("placeVisits", 0)} for x in get(f"https://games.roblox.com/v2/groups/{gid}/gamesV2?accessFilter=Public&limit=50")["data"]], []) if gid else [],
        "roles": intentar(lambda: [{"name": r["name"].strip(), "rank": r["rank"], "members": r.get("memberCount", 0)}
                                   for r in get(f"https://groups.roblox.com/v1/groups/{gid}/roles")["roles"] if r["rank"] > 0], []) if gid else [],
    }
    dueno = (grupo or {}).get("owner") or {}
    if dueno.get("userId"):
        lento["dueno"] = {"id": dueno["userId"], "name": dueno.get("displayName") or dueno.get("username"),
                          "user": dueno.get("username"),
                          "followers": intentar(lambda: get(f"https://friends.roblox.com/v1/users/{dueno['userId']}/followers/count")["count"])}
    datos["lentoT"] = ahora

fila = {"t": ahora, "playing": g["playing"], "visits": g["visits"], "fav": g["favoritedCount"],
        "up": v["upVotes"], "down": v["downVotes"], "srv": len(servidores)}
if grupo:
    fila["grp"] = grupo.get("memberCount")
if lento.get("dueno", {}).get("followers") is not None:
    fila["fol"] = lento["dueno"]["followers"]
filas.append(fila)
filas = [f for f in filas if f["t"] >= ahora - GUARDAR]

datos.update({
    "filas": filas,
    "servidores": servidores,
    "serversT": ahora,
    "actualizaciones": actualizaciones,
    "similares": similares,
    "lento": lento,
    "imagenes": lento.get("imagenes", []),
    "grupo": {"name": grupo.get("name"), "members": grupo.get("memberCount"), "id": grupo.get("id")} if grupo else None,
    "juego": {k: g.get(k) for k in ("name", "rootPlaceId", "description", "created", "updated", "maxPlayers",
                                     "genre_l1", "universeAvatarType", "createVipServersAllowed", "copyingAllowed",
                                     "price", "isContentRestricted", "canonicalUrlPath")},
})
json.dump(datos, open(ruta, "w", encoding="utf-8"), separators=(",", ":"))
print(f"ok: {len(filas)} lecturas, {g['playing']} jugando, {len(servidores)} servidores, "
      f"{len(lento.get('pases', []))} pases, {len(lento.get('productos', []))} productos, {len(similares)} similares")
