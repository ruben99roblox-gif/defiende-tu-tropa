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

ahora = int(time.time())
filas.append({"t": ahora, "playing": g["playing"], "visits": g["visits"], "fav": g["favoritedCount"],
              "up": v["upVotes"], "down": v["downVotes"]})
filas = [f for f in filas if f["t"] >= ahora - GUARDAR]

datos = {
    "filas": filas,
    "servidores": servidores,
    "serversT": ahora,
    "juego": {"name": g["name"], "placeId": g["rootPlaceId"], "created": g.get("created"),
              "updated": g.get("updated"), "maxPlayers": g.get("maxPlayers")},
}
json.dump(datos, open(ruta, "w", encoding="utf-8"), separators=(",", ":"))
print(f"ok: {len(filas)} lecturas, {g['playing']} jugando, {len(servidores)} servidores")
