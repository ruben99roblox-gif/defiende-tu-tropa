// Defiende tu tropa! Stats — logica de la web.
// Datos: en directo desde Roblox (via roproxy, cada pocos segundos, desde el propio movil)
// + historial.json que guarda el robot de GitHub cada ~5 min (votos, servidores, grupo,
// tienda, competencia...). Todo lo que se calcula sale de esas dos fuentes.
"use strict";

//==================================================================
// CONFIG
//==================================================================
const UNIVERSO = 10741812327;
const HIST_URL = "https://raw.githubusercontent.com/ruben99roblox-gif/defiende-tu-tropa/datos/historial.json";
const HITOS = [1e3, 2.5e3, 5e3, 1e4, 2.5e4, 5e4, 1e5, 2.5e5, 5e5, 1e6, 2.5e6, 5e6, 1e7, 2.5e7, 5e7, 1e8];
const VISTAS = ["inicio", "jugadores", "visitas", "servidores", "juego", "mas"];
const TARJETAS = {
  playing: ["Jugando ahora", "en todos los servidores"],
  hoy: ["Visitas hoy", "desde medianoche"],
  hora: ["Última hora", "visitas en 60 min"],
  dia: ["Últimas 24 h", "visitas"],
  pico: ["Pico de hoy", "jugadores a la vez"],
  media: ["Media hoy", "jugadores"],
  normal: ["Lo normal ahora", "jugadores a esta hora"],
  sesion: ["Sesión media", "minutos (estimado)"],
  fav: ["Favoritos", "en total"],
  favHoy: ["Favoritos hoy", "nuevos"],
  like: ["Me gusta", "de los votos"],
  porMin: ["Visitas / min", "media de 10 min"],
  nServ: ["Servidores", "abiertos"],
  libres: ["Plazas libres", "en los servidores"],
  record: ["Récord", "jugadores a la vez"],
  grupo: ["Grupo", "miembros"],
  seguidores: ["Seguidores", "del dueño"],
  proyeccion: ["Previstas hoy", "visitas al ritmo actual"],
  semanaV: ["Esta semana", "visitas en 7 días"],
  diasUpd: ["Última update", "días"],
};
const DEF = {
  tarjetas: ["playing", "hoy", "hora", "pico", "fav", "like", "nServ", "grupo"],
  tema: "dark", compacto: false, intervalo: 30, objVis: 100, objJug: 10,
  avisoOn: false, avisoN: 10, avisoViral: true, avisoRec: true, vibrar: true,
};

//==================================================================
// UTILIDADES
//==================================================================
const $ = id => document.getElementById(id);
const lento = matchMedia("(prefers-reduced-motion: reduce)").matches;
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const leer = (k, d = DEF[k]) => { try { const v = localStorage.getItem("dtt_" + k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const guardar = (k, v) => { try { localStorage.setItem("dtt_" + k, JSON.stringify(v)); } catch {} };
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
function fmt(n, dec = 0, compactoOk = true) {
  if (n == null || isNaN(n)) return "—";
  if (compactoOk && leer("compacto") && Math.abs(n) >= 10000) return Number(n).toLocaleString("es-ES", {notation: "compact", maximumFractionDigits: 1});
  return Number(n).toLocaleString("es-ES", {useGrouping: "always", maximumFractionDigits: dec});
}
const hace = iso => {
  if (!iso) return "—";
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 3600) return `hace ${Math.max(1, Math.round(s / 60))} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return `hace ${Math.round(s / 86400)} días`;
};
const duracion = seg => seg < 3600 ? `${Math.round(seg / 60)} min` : seg < 172800 ? `${Math.round(seg / 3600)} h` : seg < 86400 * 60 ? `${Math.round(seg / 86400)} días` : `${Math.round(seg / 86400 / 30)} meses`;
const fecha = t => new Date(t * 1000).toLocaleString("es-ES", {day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"});
const fechaDia = t => new Date(t * 1000).toLocaleDateString("es-ES", {day: "numeric", month: "short", year: "numeric"});
const diaNombre = t => new Date(t * 1000).toLocaleDateString("es-ES", {weekday: "long", day: "numeric"});
const horaTxt = t => new Date(t * 1000).toLocaleTimeString("es-ES", {hour: "2-digit", minute: "2-digit"});
const pct = (a, b) => b ? Math.round((a - b) / b * 100) : null;
const flecha = (a, b, txt = "vs ayer") => {
  if (b == null || a == null) return "";
  const d = a - b, p = pct(a, b);
  return `<span class="vs ${d >= 0 ? "sube" : "baja"}">${d >= 0 ? "▲" : "▼"} ${p == null ? fmt(Math.abs(d)) : Math.abs(p) + "%"} ${txt}</span>`;
};
const item = (izq, der, clase = "") => `<div class="item ${clase}"><span>${izq}</span><b>${der}</b></div>`;
const vibrar = p => { if (leer("vibrar") && navigator.vibrate) try { navigator.vibrate(p); } catch {} };

function toast(txt) {
  const t = $("toast"); t.textContent = txt; t.classList.add("ver");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("ver"), 3400);
}

// numeros que cuentan hasta su valor y destellan verde/rojo cuando cambian
const mostrado = new WeakMap();
function contar(el, valor) {
  if (!el) return;
  const dec = +(el.dataset.dec || 0), suf = el.dataset.suf || "";
  if (valor == null || isNaN(valor)) { el.textContent = "—"; mostrado.delete(el); return; }
  const habia = mostrado.has(el), desde = habia ? mostrado.get(el) : 0;
  mostrado.set(el, valor);
  if (habia && desde !== valor) {
    el.classList.remove("sube", "baja"); void el.offsetWidth;
    el.classList.add(valor > desde ? "sube" : "baja");
    setTimeout(() => el.classList.remove("sube", "baja"), 1400);
  }
  if (lento || (habia && desde === valor) || leer("compacto") && Math.abs(valor) >= 10000) { el.textContent = fmt(valor, dec) + suf; return; }
  const t0 = performance.now(), dur = habia ? 700 : 1100;
  const paso = ahora => {
    const u = Math.min(1, (ahora - t0) / dur), e = 1 - Math.pow(1 - u, 3);
    el.textContent = fmt(desde + (valor - desde) * e, u < 1 ? 0 : dec) + suf;
    if (u < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

// confeti (records e hitos)
function confeti() {
  if (lento) return;
  const cv = $("confeti"), c = cv.getContext("2d");
  cv.width = innerWidth; cv.height = innerHeight;
  const colores = [css("--acento"), css("--bien"), css("--aviso"), "#ff8fd8", "#ffffff"];
  const ps = Array.from({length: 140}, () => ({x: innerWidth / 2, y: innerHeight * 0.35, vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 14 - 4,
    r: Math.random() * 6 + 3, a: Math.random() * 6, va: (Math.random() - 0.5) * 0.4, col: colores[Math.floor(Math.random() * colores.length)]}));
  const t0 = performance.now();
  const paso = t => {
    c.clearRect(0, 0, cv.width, cv.height);
    ps.forEach(p => { p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += p.va;
      c.save(); c.translate(p.x, p.y); c.rotate(p.a); c.fillStyle = p.col; c.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); c.restore(); });
    if (t - t0 < 3200) requestAnimationFrame(paso); else c.clearRect(0, 0, cv.width, cv.height);
  };
  requestAnimationFrame(paso);
}

//==================================================================
// DATOS
//==================================================================
let robot = null, robotLeido = 0, icono = null, S = null;

async function json(url) {
  const r = await fetch(url, {cache: "no-store"});
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}

function calcular(filas, R) {
  R = R || {};
  const L = R.lento || {};
  const a = filas.at(-1), ahora = a.t;
  // busqueda binaria: primera fila con t >= x
  const en = x => { let lo = 0, hi = filas.length - 1; if (filas[hi].t < x) return a; while (lo < hi) { const m = (lo + hi) >> 1; if (filas[m].t >= x) hi = m; else lo = m + 1; } return filas[lo]; };
  const d0 = new Date(); d0.setHours(0, 0, 0, 0); const medianoche = Math.floor(d0 / 1000);
  const h1 = en(ahora - 3600), d1 = en(ahora - 86400), hoy = en(medianoche), m10 = en(ahora - 600);
  const hoyFilas = filas.filter(f => f.t >= medianoche), inicio = filas[0].t;
  const ult = k => { for (let i = filas.length - 1; i >= 0; i--) if (filas[i][k] != null) return filas[i]; return {}; };
  const vot = ult("up"), votos = (vot.up || 0) + (vot.down || 0);
  const votHoy = filas.find(f => f.t >= medianoche && f.up != null);
  const grp = ult("grp"), grpHoy = filas.find(f => f.t >= medianoche && f.grp != null);
  const fol = ult("fol"), folHoy = filas.find(f => f.t >= medianoche && f.fol != null);
  const hayAyer = inicio <= medianoche - 86400 + 900;

  let ayer = null;
  if (hayAyer) { const a0 = en(medianoche - 86400), a1 = en(ahora - 86400); ayer = {hoy: a1.visits - a0.visits, playing: a1.playing}; }

  // visitas por hora: hoy (0..23) y ayer (0..23)
  const cubo = t0 => t0 + 3600 < inicio || t0 > ahora ? null : Math.max(0, en(Math.min(t0 + 3600, ahora)).visits - en(Math.max(t0, inicio)).visits);
  const horasHoy = [], horasAyer = [];
  for (let h = 0; h < 24; h++) { horasHoy.push(cubo(medianoche + h * 3600)); horasAyer.push(cubo(medianoche - 86400 + h * 3600)); }

  let mejorHora = {v: 0, t: null};
  for (let t0 = inicio - inicio % 3600 + 3600; t0 + 3600 <= ahora; t0 += 3600) {
    const v = en(t0 + 3600).visits - en(t0).visits;
    if (v > mejorHora.v) mejorHora = {v, t: t0};
  }
  // dias (hasta 30)
  const dias = [];
  for (let i = 0; i < 30; i++) {
    const d = medianoche - i * 86400; if (d + 86400 < inicio) break;
    const fs = filas.filter(f => f.t >= d && f.t < d + 86400); if (!fs.length) continue;
    const gs = fs.filter(f => f.grp != null);
    dias.push({t: d, visitas: fs.at(-1).visits - fs[0].visits, pico: Math.max(...fs.map(f => f.playing)),
      media: fs.reduce((s, f) => s + f.playing, 0) / fs.length, fav: fs.at(-1).fav - fs[0].fav,
      grp: gs.length > 1 ? gs.at(-1).grp - gs[0].grp : null, completo: fs[0].t - d < 900 && (i > 0 ? fs.at(-1).t > d + 86400 - 900 : true)});
  }
  const validos = dias.filter(d => d.completo);
  const mejorDia = validos.reduce((m, d) => d.visitas > m.visitas ? d : m, {visitas: 0});
  const mejorFav = validos.reduce((m, d) => d.fav > m.fav ? d : m, {fav: 0});
  const mejorGrp = validos.reduce((m, d) => (d.grp ?? -1) > (m.grp ?? -1) ? d : m, {grp: null});
  // calor: media por hora del dia, y por dia de la semana x hora
  const suma = Array(24).fill(0), cuenta = Array(24).fill(0);
  const sem = Array.from({length: 7}, () => Array(24).fill(0)), semN = Array.from({length: 7}, () => Array(24).fill(0));
  filas.forEach(f => { const d = new Date(f.t * 1000), h = d.getHours(), w = (d.getDay() + 6) % 7; suma[h] += f.playing; cuenta[h]++; sem[w][h] += f.playing; semN[w][h]++; });
  const calor = suma.map((s, h) => cuenta[h] ? s / cuenta[h] : null);
  const semana = sem.map((fila, w) => fila.map((s, h) => semN[w][h] ? s / semN[w][h] : null));
  // lo normal a esta hora (dias anteriores, misma hora)
  const hAct = new Date().getHours();
  const previas = filas.filter(f => f.t < medianoche && new Date(f.t * 1000).getHours() === hAct);
  const normal = previas.length >= 3 ? previas.reduce((s, f) => s + f.playing, 0) / previas.length : null;
  // tendencia: pendiente de jugadores en la ultima hora
  const ultHora = filas.filter(f => f.t >= ahora - 3600);
  let tendencia = 0;
  if (ultHora.length >= 4) {
    const n = ultHora.length, mx = ultHora.reduce((s, f) => s + f.t, 0) / n, my = ultHora.reduce((s, f) => s + f.playing, 0) / n;
    const num = ultHora.reduce((s, f) => s + (f.t - mx) * (f.playing - my), 0), den = ultHora.reduce((s, f) => s + (f.t - mx) ** 2, 0);
    tendencia = den ? num / den * 3600 : 0; // jugadores por hora
  }
  // pico y valle de hoy (media por hora)
  const porHoraHoy = Array.from({length: 24}, (_, h) => { const fs = hoyFilas.filter(f => new Date(f.t * 1000).getHours() === h); return fs.length ? fs.reduce((s, f) => s + f.playing, 0) / fs.length : null; });
  const conDatos = porHoraHoy.map((v, h) => [h, v]).filter(x => x[1] != null);
  const horaPico = conDatos.length ? conDatos.reduce((m, x) => x[1] > m[1] ? x : m) : null;
  const horaValle = conDatos.length ? conDatos.reduce((m, x) => x[1] < m[1] ? x : m) : null;
  // ritmos y previsiones
  const ritmoHora = (a.visits - d1.visits) / Math.max(ahora - d1.t, 1) * 3600;
  const pasado = (ahora - medianoche) / 86400, hoyV = a.visits - hoy.visits;
  const proyeccion = pasado > 0.04 && hoy.t - medianoche < 1800 ? Math.round(hoyV / pasado) : null;
  const visitasMin = hoyFilas.length > 1 ? hoyV / Math.max((ahora - hoy.t) / 60, 1) : (a.visits - m10.visits) / Math.max((a.t - m10.t) / 60, 0.5);
  const media = hoyFilas.length ? hoyFilas.reduce((s, f) => s + f.playing, 0) / hoyFilas.length : a.playing;
  const sesion = visitasMin > 0.05 ? media / visitasMin : null; // ley de Little: jugadores / llegadas por minuto
  const semanaV = inicio <= ahora - 7 * 86400 + 900 ? a.visits - en(ahora - 7 * 86400).visits : null;
  const semanaAnt = inicio <= ahora - 14 * 86400 + 900 ? en(ahora - 7 * 86400).visits - en(ahora - 14 * 86400).visits : null;
  // hitos
  const sig = HITOS.find(h => h > a.visits) ?? null, prev = Math.max(0, ...HITOS.filter(h => h <= a.visits));
  const hitosFuturos = HITOS.filter(h => h > a.visits).slice(0, 5).map(h => ({h, eta: ritmoHora > 0 ? (h - a.visits) / ritmoHora * 3600 : null}));
  const hitosHechos = HITOS.filter(h => h <= a.visits).map(h => { const f = filas.find(x => x.visits >= h); return {h, t: f && f.t > inicio ? f.t : null}; });
  // servidores
  const servidores = [...(R.servidores || [])];
  const conMax = servidores.filter(s => s.max);
  const plazas = conMax.reduce((s, v) => s + v.max, 0), ocupadas = conMax.reduce((s, v) => s + v.playing, 0);
  const serieServ = filas.filter(f => f.srv != null).map(f => [f.t, f.srv]);
  const recServF = filas.filter(f => f.srv != null).reduce((m, f) => f.srv > (m.srv ?? -1) ? f : m, {});
  // me gusta en el tiempo
  const serieLike = filas.filter(f => f.up != null && f.up + f.down > 0).map(f => [f.t, f.up / (f.up + f.down) * 100]);
  // updates y su efecto
  const J = R.juego || {};
  const updates = (R.actualizaciones || []).map(iso => {
    const t = Math.floor(new Date(iso) / 1000);
    const antes = t - 86400 >= inicio ? en(t).visits - en(t - 86400).visits : null;
    const despues = t + 86400 <= ahora ? en(t + 86400).visits - en(t).visits : null;
    return {t, antes, despues};
  }).reverse();
  const diasUpd = J.updated ? (Date.now() - new Date(J.updated)) / 86400000 : null;
  // competencia
  const sim = (R.similares || []).filter(x => x.universeId !== UNIVERSO);
  const tu = {name: J.name || "Tu juego", playing: a.playing, up: vot.up || 0, down: vot.down || 0, tuyo: true, placeId: J.rootPlaceId};
  const comp = [...sim, tu].sort((x, y) => y.playing - x.playing);
  // tienda
  const pases = L.pases || [], productos = L.productos || [];
  const precios = [...pases, ...productos].filter(p => p.price).map(p => p.price);
  const rec = filas.reduce((m, f) => f.playing > m.playing ? f : m, filas[0]);
  const edad = J.created ? (Date.now() - new Date(J.created)) / 86400000 : null;

  return {
    t: ahora, juego: J, L, grupoInfo: R.grupo, imagenes: R.imagenes || L.imagenes || [], serversT: R.serversT,
    playing: a.playing, visits: a.visits, fav: a.fav,
    porMin: Math.round((a.visits - m10.visits) / Math.max((a.t - m10.t) / 60, 0.5) * 10) / 10,
    hora: a.visits - h1.visits, hoy: hoyV, dia: a.visits - d1.visits,
    pico: hoyFilas.length ? Math.max(...hoyFilas.map(f => f.playing)) : a.playing,
    picoT: hoyFilas.length ? hoyFilas.reduce((m, f) => f.playing > m.playing ? f : m).t : a.t,
    media, normal, tendencia, sesion, horaPico, horaValle,
    favHoy: a.fav - hoy.fav,
    like: votos ? Math.round(100 * vot.up / votos) : null, up: vot.up, down: vot.down,
    votosHoy: votHoy ? votos - votHoy.up - votHoy.down : null,
    grupo: grp.grp ?? (R.grupo && R.grupo.members) ?? null, grupoHoy: grpHoy && grp.grp != null ? grp.grp - grpHoy.grp : null,
    seguidores: fol.fol ?? (L.dueno && L.dueno.followers) ?? null, seguidoresHoy: folHoy && fol.fol != null ? fol.fol - folHoy.fol : null,
    ayer, hayAyer, horasHoy, horasAyer, dias, calor, semana,
    hitosHechos, hitosFuturos, proyeccion, semanaV, semanaAnt,
    mesPrev: Math.round(ritmoHora * 24 * 30), semanaPrev: Math.round(ritmoHora * 24 * 7), ritmoHora,
    mejorHora, mejorHoraV: mejorHora.v, mejorDia, mejorDiaV: mejorDia.visitas, mejorFav, mejorFavV: mejorFav.fav,
    mejorGrp, recGrp: mejorGrp.grp, recServ: recServF.srv ?? null, recServT: recServF.t,
    record: rec.playing, recordT: rec.t,
    hito: {sig, prev, eta: sig && ritmoHora > 0 ? (sig - a.visits) / ritmoHora * 3600 : null},
    hitoPct: sig ? Math.min(100, Math.floor((a.visits - prev) / (sig - prev) * 100)) : 100,
    servidores, nServ: servidores.length, plazas, libres: plazas - ocupadas,
    llenos: servidores.filter(s => s.max && s.playing >= s.max).length,
    ocupacion: plazas ? Math.round(100 * ocupadas / plazas) : null,
    porServ: servidores.length ? ocupadas / servidores.length : null,
    fpsMedio: servidores.length ? Math.round(servidores.reduce((s, v) => s + v.fps, 0) / servidores.length) : null,
    pingMedio: servidores.length ? Math.round(servidores.reduce((s, v) => s + v.ping, 0) / servidores.length) : null,
    serieServ, serieLike, updates, diasUpd: diasUpd == null ? null : Math.floor(diasUpd),
    comp, posComp: comp.findIndex(x => x.tuyo) + 1,
    pases, productos, nPases: pases.length, nProd: productos.length,
    precioMedio: precios.length ? Math.round(precios.reduce((s, p) => s + p, 0) / precios.length) : null,
    precioMin: precios.length ? Math.min(...precios) : null, precioMax: precios.length ? Math.max(...precios) : null,
    edad, edadD: edad == null ? null : Math.floor(edad),
    serie: filas.map(f => [f.t, f.playing]), filas, inicio, medianoche,
  };
}

//==================================================================
// PINTAR
//==================================================================
function pintar() {
  const s = S;
  document.querySelectorAll("#main [data-k]").forEach(el => contar(el, s[el.dataset.k]));
  if (icono && $("icono").dataset.ok !== "1") { $("icono").src = icono; $("icono").dataset.ok = "1"; }
  $("chipProy").hidden = s.proyeccion == null;
  pintarInicio(s); pintarJugadores(s); pintarVisitas(s); pintarServidores(s); pintarJuego(s); pintarMas(s);
  pintarTarjetas();
  graficas(true);
  avisos();
}

function fraseResumen(s) {
  const p = [];
  if (s.ayer && s.ayer.hoy) {
    const d = pct(s.hoy, s.ayer.hoy);
    p.push(`Hoy llevas <b>${fmt(s.hoy)}</b> visitas, un <b>${Math.abs(d)}% ${d >= 0 ? "más" : "menos"}</b> que ayer a esta hora.`);
  } else p.push(`Hoy llevas <b>${fmt(s.hoy)}</b> visitas.`);
  if (s.normal != null) {
    const d = s.playing - s.normal;
    p.push(Math.abs(d) < 1 ? `Hay la gente de siempre a esta hora (<b>${fmt(s.playing)}</b>).` : `Hay <b>${fmt(s.playing)}</b> jugando, ${d > 0 ? "más" : "menos"} de lo normal a esta hora (<b>${fmt(s.normal, 1)}</b>).`);
  } else p.push(`Ahora hay <b>${fmt(s.playing)}</b> jugando.`);
  if (s.hito.sig && s.hito.eta) p.push(`Al ritmo actual llegas a <b>${fmt(s.hito.sig)}</b> visitas en <b>${duracion(s.hito.eta)}</b>.`);
  if (s.llenos) p.push(`<b>${s.llenos}</b> servidor${s.llenos > 1 ? "es están" : " está"} lleno${s.llenos > 1 ? "s" : ""}.`);
  return p.join(" ");
}

function pintarInicio(s) {
  $("frase").innerHTML = fraseResumen(s);
  const t = $("tendencia"), tv = s.tendencia;
  t.className = "estado-pill " + (tv > 1 ? "sube" : tv < -1 ? "baja" : "igual");
  t.textContent = tv > 1 ? "▲ subiendo" : tv < -1 ? "▼ bajando" : "● estable";
  const oV = leer("objVis"), oJ = leer("objJug");
  $("objVTxt").textContent = `${fmt(s.hoy)} / ${fmt(oV)}`;
  $("objV").style.width = Math.min(100, s.hoy / oV * 100) + "%";
  $("objV").parentElement.classList.toggle("ok", s.hoy >= oV);
  $("objVSub").textContent = s.hoy >= oV ? "¡objetivo cumplido! 🎉" : `faltan ${fmt(oV - s.hoy)} visitas`;
  $("objJTxt").textContent = `${fmt(s.pico)} / ${fmt(oJ)}`;
  $("objJ").style.width = Math.min(100, s.pico / oJ * 100) + "%";
  $("objJ").parentElement.classList.toggle("ok", s.pico >= oJ);
  $("objJSub").textContent = s.pico >= oJ ? "¡conseguido hoy! 🎉" : `pico de hoy: ${fmt(s.pico)}`;
  $("hitoA").textContent = s.hito.sig ? `${fmt(s.visits)} / ${fmt(s.hito.sig)}` : "todos conseguidos";
  $("hitoBarra").style.width = s.hitoPct + "%";
  $("hitoEta").textContent = s.hito.eta ? `faltan ${fmt(s.hito.sig - s.visits)} · ~${duracion(s.hito.eta)}` : "midiendo el ritmo…";
  const edadRobot = robot && robot.filas && robot.filas.length ? (Date.now() / 1000 - robot.filas.at(-1).t) : null;
  $("estadoRobot").textContent = edadRobot == null ? "historial: sin datos todavía" :
    `historial: ${fmt((robot.filas || []).length)} lecturas desde ${fechaDia(s.inicio)} · última guardada ${edadRobot < 90 ? "ahora mismo" : "hace " + duracion(edadRobot)}${edadRobot > 1800 ? " ⚠️ el robot va con retraso" : ""}`;
}

function pintarJugadores(s) {
  $("vsJug").innerHTML = s.ayer ? flecha(s.playing, s.ayer.playing) : "vs ayer: desde mañana";
  $("picoHora").textContent = "a las " + horaTxt(s.picoT);
  $("normalTxt").innerHTML = s.normal == null ? "se calcula desde mañana" : flecha(s.playing, s.normal, "ahora");
  $("picoValle").textContent = s.horaPico ? `Hoy la mejor hora fue las ${s.horaPico[0]}:00 (${fmt(s.horaPico[1], 1)} de media) y la más floja las ${s.horaValle[0]}:00 (${fmt(s.horaValle[1], 1)}).` : "—";
  const ca = $("calor"), maxC = Math.max(1, ...s.calor.filter(v => v != null));
  if (!ca.children.length) for (let h = 0; h < 24; h++) { const d = document.createElement("div"); d.textContent = String(h).padStart(2, "0"); ca.appendChild(d); }
  s.calor.forEach((v, h) => {
    const d = ca.children[h]; d.title = v == null ? `${h}h: sin datos` : `${h}h: ${fmt(v, 1)} jugadores de media`;
    if (v != null) { const k = v / maxC; d.style.background = `color-mix(in srgb, var(--acento) ${8 + k * 80}%, var(--card2))`; d.style.color = k > 0.55 ? "var(--bg)" : "var(--fg)"; }
  });
  const se = $("semana"), dn = ["L", "M", "X", "J", "V", "S", "D"], maxS = Math.max(1, ...s.semana.flat().filter(v => v != null));
  se.textContent = "";
  s.semana.forEach((fila, w) => {
    const l = document.createElement("span"); l.textContent = dn[w]; se.appendChild(l);
    fila.forEach((v, h) => { const d = document.createElement("div"); d.title = `${dn[w]} ${h}h: ${v == null ? "sin datos" : fmt(v, 1) + " de media"}`; if (v != null) d.style.background = `color-mix(in srgb, var(--acento) ${8 + v / maxS * 80}%, var(--card2))`; se.appendChild(d); });
  });
}

function pintarVisitas(s) {
  $("vsHoy").innerHTML = s.ayer ? flecha(s.hoy, s.ayer.hoy) : "desde medianoche";
  $("vsSemana").innerHTML = s.semanaAnt != null ? flecha(s.semanaV, s.semanaAnt, "vs semana pasada") : s.semanaV == null ? "a partir del día 7" : "últimos 7 días";
  $("prevSemana").textContent = `≈ ${fmt(s.semanaPrev)} por semana`;
  $("likeBarra").style.width = (s.like ?? 0) + "%";
  $("likeTxt").textContent = s.up == null ? "—" : `${fmt(s.up)} 👍 · ${fmt(s.down)} 👎${s.votosHoy ? ` · +${fmt(s.votosHoy)} hoy` : ""}`;
  $("favTxt").textContent = `+${fmt(s.favHoy)} hoy · ${s.visits ? fmt(s.fav / s.visits * 1000, 1) : "—"} por cada 1.000 visitas`;
  const tb = $("dias");
  tb.innerHTML = s.dias.length ? s.dias.slice(0, 14).map((d, i) => {
    const n = i === 0 ? "Hoy" : i === 1 ? "Ayer" : new Date(d.t * 1000).toLocaleDateString("es-ES", {weekday: "short", day: "numeric"});
    return `<tr><td>${n}${d.completo || i === 0 ? "" : " *"}</td><td>${fmt(d.visitas)}</td><td>${fmt(d.pico)}</td><td>${fmt(d.media, 1)}</td><td>+${fmt(d.fav)}</td><td>${d.visitas ? fmt(d.fav / d.visitas * 1000, 1) : "—"}</td></tr>`;
  }).join("") : '<tr><td colspan="6" class="vacio">Aún no hay días guardados</td></tr>';
  // calendario 30 dias
  const cal = $("calendario"), porDia = new Map(s.dias.map(d => [d.t, d])), maxD = Math.max(1, ...s.dias.map(d => d.visitas));
  cal.innerHTML = "";
  for (let i = 29; i >= 0; i--) {
    const t = s.medianoche - i * 86400, d = porDia.get(t), c = document.createElement("div");
    if (d) c.style.background = `color-mix(in srgb, var(--acento) ${10 + d.visitas / maxD * 80}%, var(--card2))`;
    if (i === 0) c.classList.add("hoy");
    const txt = `${new Date(t * 1000).toLocaleDateString("es-ES", {weekday: "short", day: "numeric", month: "short"})}: ${d ? fmt(d.visitas) + " visitas" : "sin datos"}`;
    c.title = txt; c.onclick = () => toast(txt);
    cal.appendChild(c);
  }
  $("hitosEta").innerHTML = s.hitosFuturos.map(h => item(`🎯 ${fmt(h.h)} visitas`, h.eta ? `~${duracion(h.eta)} · ${new Date(Date.now() + h.eta * 1000).toLocaleDateString("es-ES", {day: "numeric", month: "short"})}` : "sin ritmo aún")).join("") || '<div class="vacio">¡Todos conseguidos!</div>';
}

let ordenServ = "lleno";
function pintarServidores(s) {
  $("servLlenos").textContent = s.llenos ? `${s.llenos} llenos` : "ninguno lleno";
  $("pingTxt").textContent = s.pingMedio == null ? "—" : `fps medio · ping ${s.pingMedio} ms`;
  $("servHora").textContent = s.serversT ? "lista vista a las " + horaTxt(s.serversT) + " (se refresca cada 5 min)" : "—";
  const cs = $("consejoServ");
  if (s.nServ && s.llenos / s.nServ >= 0.5) { cs.hidden = false; cs.className = "consejo"; cs.innerHTML = `💡 <span>La mitad o más de tus servidores están llenos. Si se repite, prueba a subir los <b>jugadores por servidor</b> (ahora ${s.juego.maxPlayers ?? "?"}) en Studio.</span>`; }
  else if (s.servidores.some(v => v.fps && v.fps < 40)) { cs.hidden = false; cs.className = "consejo"; cs.innerHTML = "⚠️ <span>Hay algún servidor con FPS bajo (menos de 40). Puede haber lag.</span>"; }
  else if (s.nServ) { cs.hidden = false; cs.className = "consejo bien"; cs.innerHTML = "✅ <span>Los servidores van bien: sin llenarse y con buen rendimiento.</span>"; }
  else cs.hidden = true;
  const orden = {lleno: (x, y) => y.playing - x.playing, ping: (x, y) => x.ping - y.ping, fps: (x, y) => x.fps - y.fps}[ordenServ];
  const sv = $("servers"), place = s.juego.rootPlaceId;
  sv.innerHTML = s.servidores.length ? [...s.servidores].sort(orden).map(v => {
    const enlace = place && v.id ? `roblox://experiences/start?placeId=${place}&gameInstanceId=${v.id}` : null;
    return `<div class="srv${v.max && v.playing >= v.max ? " lleno" : ""}"><div class="barra"><i style="width:${v.max ? v.playing / v.max * 100 : 0}%"></i></div><span>${v.playing}/${v.max}</span><span><span class="${v.fps < 40 ? "malo" : ""}">${v.fps}fps</span> · <span class="${v.ping > 200 ? "malo" : ""}">${v.ping}ms</span></span>${enlace ? `<a class="unirse" href="${enlace}">Unirse</a>` : "<span></span>"}</div>`;
  }).join("") : '<div class="vacio">No hay servidores abiertos ahora mismo.</div>';
}

function pintarJuego(s) {
  const J = s.juego || {}, L = s.L || {};
  const imgs = s.imagenes.length ? s.imagenes : (icono ? [icono] : []);
  const gal = $("galeria");
  if (gal.dataset.n !== String(imgs.length)) { gal.dataset.n = imgs.length; gal.innerHTML = imgs.map(u => `<img src="${esc(u)}" alt="Imagen del juego" loading="lazy">`).join(""); }
  const place = J.rootPlaceId, gid = s.grupoInfo && s.grupoInfo.id;
  const ic = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  $("enlaces").innerHTML = [
    place && [`https://www.roblox.com/games/${place}`, "Abrir en Roblox", ic('<path d="M6 4l14 8-14 8z"/>')],
    [`https://create.roblox.com/dashboard/creations/experiences/${UNIVERSO}/analytics/overview`, "Analíticas (Creator)", ic('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>')],
    [`https://create.roblox.com/dashboard/creations/experiences/${UNIVERSO}/monetization/passes`, "Tienda (Creator)", ic('<path d="M3 7h18l-2 13H5zM8 7a4 4 0 0 1 8 0"/>')],
    gid && [`https://www.roblox.com/communities/${gid}`, "Página del grupo", ic('<circle cx="9" cy="8" r="3"/><path d="M3 20c.8-3.5 3.2-5 6-5s5.2 1.5 6 5M17 11a3 3 0 0 0 0-6M21 20c-.4-2.2-1.6-3.6-3-4.4"/>')],
  ].filter(Boolean).map(([u, t, i]) => `<a class="enlace" href="${u}" target="_blank" rel="noopener">${i}${t}</a>`).join("");
  const cu = $("consejoUpd");
  if (s.diasUpd != null && s.diasUpd >= 7) { cu.hidden = false; cu.innerHTML = `💡 <span>Llevas <b>${s.diasUpd} días</b> sin actualizar el juego. Las updates suelen dar un empujón de visitas.</span>`; } else cu.hidden = true;
  $("updTxt").textContent = J.updated ? new Date(J.updated).toLocaleString("es-ES", {day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"}) : "—";
  $("edadTxt").textContent = s.edad ? `${fmt(s.visits / s.edad)} visitas/día de media` : "—";
  $("updates").innerHTML = s.updates.length ? s.updates.slice(0, 10).map(u => {
    const efecto = u.antes != null && u.despues != null ? flecha(u.despues, u.antes, "") : u.despues == null ? "midiendo (24 h)…" : "sin datos de antes";
    return item(`🛠️ ${fecha(u.t)}`, `${u.despues != null ? fmt(u.despues) + " visitas " : ""}${efecto}`);
  }).join("") : '<div class="vacio">Se apuntan solas cada vez que actualices el juego.</div>';
  $("posComp").textContent = s.comp.length > 1 ? `vas ${s.posComp}º de ${s.comp.length}` : "—";
  $("competencia").innerHTML = s.comp.length > 1 ? s.comp.map((x, i) => {
    const v = x.up + x.down, l = v ? Math.round(x.up / v * 100) + "% 👍" : "—";
    const nombre = x.placeId ? `<a href="https://www.roblox.com/games/${x.placeId}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none">${esc(x.name)}</a>` : esc(x.name);
    return item(`${i + 1}. ${nombre}${x.tuyo ? " (tú)" : ""}`, `${fmt(x.playing)} jugando · ${l}`, x.tuyo ? "tuyo" : "");
  }).join("") : '<div class="vacio">Aparecerá en unos minutos.</div>';
  $("pasesTxt").textContent = s.nPases ? `${s.pases.filter(p => p.forSale).length} a la venta` : "—";
  $("prodTxt").textContent = s.precioMin != null ? `de ${s.precioMin} a ${s.precioMax} R$` : "—";
  const tarjeta = p => `<div class="prod${p.forSale === false ? " off" : ""}">${p.icon ? `<img src="${esc(p.icon)}" alt="" loading="lazy">` : ""}<b title="${esc(p.name)}">${esc(p.name)}</b><span>${p.price != null ? "R$ " + fmt(p.price, 0, false) : "no a la venta"}</span></div>`;
  $("pases").innerHTML = s.pases.length ? s.pases.map(tarjeta).join("") : '<div class="vacio">Sin gamepasses (o aún cargando).</div>';
  const q = $("buscarProd").value.trim().toLowerCase();
  const prods = s.productos.filter(p => !q || (p.name || "").toLowerCase().includes(q));
  $("productos").innerHTML = prods.length ? prods.slice(0, 60).map(tarjeta).join("") + (prods.length > 60 ? `<div class="vacio">…y ${prods.length - 60} más (usa el buscador)</div>` : "") : '<div class="vacio">No hay productos que coincidan.</div>';
  $("grpTxt").textContent = s.grupoInfo ? `${s.grupoInfo.name}${s.grupoHoy ? ` · +${fmt(s.grupoHoy)} hoy` : ""}` : "—";
  $("folTxt").textContent = L.dueno ? `${L.dueno.name} (@${L.dueno.user})${s.seguidoresHoy ? ` · +${fmt(s.seguidoresHoy)} hoy` : ""}` : "—";
  $("roles").innerHTML = (L.roles || []).sort((a, b) => b.rank - a.rank).map(r => item(esc(r.name), fmt(r.members))).join("") || '<div class="vacio">—</div>';
  $("juegosGrupo").innerHTML = (L.juegosGrupo || []).sort((a, b) => b.visits - a.visits).map(g => item(`${g.placeId ? `<a href="https://www.roblox.com/games/${g.placeId}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none">${esc(g.name)}</a>` : esc(g.name)}`, fmt(g.visits) + " visitas", g.id === UNIVERSO ? "tuyo" : "")).join("") || '<div class="vacio">—</div>';
  const avatar = {MorphToR15: "R15", MorphToR6: "R6", PlayerChoice: "Elige el jugador"}[J.universeAvatarType] || J.universeAvatarType;
  const ficha = [
    ["Nombre en Roblox", J.name], ["Género", J.genre_l1], ["Jugadores por servidor", J.maxPlayers], ["Tipo de avatar", avatar],
    ["Servidores VIP", J.createVipServersAllowed == null ? null : J.createVipServersAllowed ? "Permitidos" : "No permitidos"],
    ["Se puede copiar", J.copyingAllowed == null ? null : J.copyingAllowed ? "Sí" : "No"],
    ["Precio de entrada", J.name ? (J.price ? J.price + " R$" : "Gratis") : null],
    ["Lugares (places)", (L.lugares || []).length ? (L.lugares || []).map(p => p.name).join(", ") : null],
    ["Creado", J.created ? new Date(J.created).toLocaleDateString("es-ES", {day: "numeric", month: "long", year: "numeric"}) : null],
    ["Visitas totales", fmt(s.visits, 0, false)], ["Favoritos totales", fmt(s.fav, 0, false)],
    ["Votos totales", s.up == null ? null : fmt(s.up + s.down)], ["ID del universo", UNIVERSO], ["ID del place", J.rootPlaceId],
  ];
  $("ficha").innerHTML = ficha.filter(f => f[1] != null && f[1] !== "").map(([k, v]) => item(k, esc(v))).join("");
  $("desc").textContent = J.description || "";
}

function pintarMas(s) {
  $("recTxt").textContent = s.recordT ? fecha(s.recordT) : "—";
  $("mhTxt").textContent = s.mejorHora.t ? "visitas · " + fecha(s.mejorHora.t) : "visitas en una hora";
  $("mdTxt").textContent = s.mejorDia.t ? "visitas · " + diaNombre(s.mejorDia.t) : "visitas en un día (día completo)";
  $("mfTxt").textContent = s.mejorFav.t ? diaNombre(s.mejorFav.t) : "en un día completo";
  $("rsTxt").textContent = s.recServT ? fecha(s.recServT) : "—";
  $("rgTxt").textContent = s.mejorGrp.t ? diaNombre(s.mejorGrp.t) : "en un día completo";
  $("hitos").innerHTML = [...s.hitosHechos].reverse().map(h => item(`🏆 ${fmt(h.h)} visitas`, h.t ? fecha(h.t) : "conseguido")).join("") || '<div class="vacio">—</div>';
  pintarNotas();
  buscarMomento();
}

function pintarTarjetas() {
  const elegidas = leer("tarjetas"), cont = $("tarjetas");
  if ([...cont.children].map(c => c.dataset.t).join() !== elegidas.join()) {
    cont.textContent = "";
    elegidas.forEach((k, i) => {
      if (!TARJETAS[k]) return;
      const d = document.createElement("div"); d.className = "card"; d.dataset.t = k;
      if (!lento) d.style.animation = `entra .4s ${i * 0.05}s both`;
      const extra = k === "like" ? ' data-suf="%"' : k === "sesion" ? ' data-dec="1" data-suf=" min"' : ["media", "porMin", "normal"].includes(k) ? ' data-dec="1"' : "";
      d.innerHTML = `<div class="etq">${TARJETAS[k][0]}</div><div class="num" data-k2="${k}"${extra}>0</div><div class="sub">${TARJETAS[k][1]}</div>`;
      cont.appendChild(d);
    });
  }
  if (!S) return;
  cont.querySelectorAll("[data-k2]").forEach(el => {
    contar(el, S[el.dataset.k2]);
    if (S.ayer && el.dataset.k2 === "playing") el.nextElementSibling.innerHTML = flecha(S.playing, S.ayer.playing);
    if (S.ayer && el.dataset.k2 === "hoy") el.nextElementSibling.innerHTML = flecha(S.hoy, S.ayer.hoy);
  });
}

//==================================================================
// GRAFICAS
//==================================================================
let horas = 6;
function preparar(cv) {
  const dpr = devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
  if (!W) return null;
  cv.width = W * dpr; cv.height = H * dpr;
  const c = cv.getContext("2d"); c.scale(dpr, dpr);
  c.font = "400 10px 'IBM Plex Mono', monospace";
  return {c, W, H};
}
function animarDibujo(cv, dibujar, animar) {
  if (!animar || lento || cv._yaAnimado || !cv.clientWidth) { dibujar(1); return; }
  cv._yaAnimado = true;
  const t0 = performance.now();
  const paso = t => { const u = Math.min(1, (t - t0) / 900); dibujar(1 - Math.pow(1 - u, 3)); if (u < 1) requestAnimationFrame(paso); };
  requestAnimationFrame(paso);
}
const suavizar = (pts, n = 5) => pts.map((p, i) => { const v = pts.slice(Math.max(0, i - n + 1), i + 1); return [p[0], v.reduce((s, q) => s + q[1], 0) / v.length]; });
function etiquetaTiempo(t, rangoH) {
  const d = new Date(t * 1000);
  return rangoH > 48 ? d.toLocaleDateString("es-ES", {weekday: "short", day: "numeric"}) : d.toLocaleTimeString("es-ES", {hour: "2-digit", minute: "2-digit"});
}

// grafica de linea generica (jugadores, servidores, me gusta)
function linea(cv, opt, animar) {
  const {pts, ini, fin, min = 0, maxMin = 5, fantasma, notas, sufijo = "", dec = 0} = opt;
  const L = 32, B = 20;
  const vals = pts.map(p => p[1]).concat(fantasma ? fantasma.map(p => p[1]) : []);
  const max = Math.max(maxMin, ...vals) * 1.15, lo = min === "auto" ? Math.max(0, Math.min(...vals) - 2) : min;
  const dibujar = prog => {
    const P = preparar(cv); if (!P) return; const {c, W, H} = P;
    const x = t => L + (t - ini) / (fin - ini) * (W - L - 6), y = v => (H - B) - (v - lo) / (max - lo || 1) * (H - B - 8);
    c.fillStyle = css("--tenue"); c.strokeStyle = css("--linea"); c.lineWidth = 1;
    for (let i = 0; i <= 3; i++) { const v = lo + (max - lo) / 3 * i, yy = y(v); c.beginPath(); c.moveTo(L, yy); c.lineTo(W, yy); c.stroke(); c.fillText(fmt(v, v < 10 && dec ? 1 : 0, false), 2, yy + 3); }
    for (let i = 0; i <= 3; i++) { const t = ini + (fin - ini) * i / 3; c.fillText(etiquetaTiempo(t, (fin - ini) / 3600), Math.min(Math.max(x(t) - 14, L), W - 52), H - 4); }
    if (pts.length < 2) { c.fillStyle = css("--sub"); c.fillText("Aún no hay datos en este rango", L + 8, H / 2); cv._mapa = null; return; }
    if (fantasma && fantasma.length > 1) {
      c.setLineDash([4, 4]); c.strokeStyle = css("--tenue"); c.lineWidth = 1.4; c.beginPath();
      fantasma.forEach((p, i) => i ? c.lineTo(x(p[0]), y(p[1])) : c.moveTo(x(p[0]), y(p[1]))); c.stroke(); c.setLineDash([]);
    }
    const n = Math.max(2, Math.ceil(pts.length * prog)), vis = pts.slice(0, n);
    const camino = () => { c.beginPath(); vis.forEach((p, i) => i ? c.lineTo(x(p[0]), y(p[1])) : c.moveTo(x(p[0]), y(p[1]))); };
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, css("--acento-m")); g.addColorStop(1, "transparent");
    camino(); c.lineTo(x(vis.at(-1)[0]), y(lo)); c.lineTo(x(vis[0][0]), y(lo)); c.closePath(); c.globalAlpha = 0.55; c.fillStyle = g; c.fill(); c.globalAlpha = 1;
    c.shadowColor = css("--acento"); c.shadowBlur = 8 * (+css("--brillo") || 0);
    camino(); c.strokeStyle = css("--acento"); c.lineWidth = 2; c.lineJoin = "round"; c.stroke();
    const lp = vis.at(-1); c.beginPath(); c.arc(x(lp[0]), y(lp[1]), 3.5, 0, 7); c.fillStyle = css("--acento"); c.fill(); c.shadowBlur = 0;
    (notas || []).forEach(nt => { if (nt.t < ini || nt.t > fin) return; const xx = x(nt.t); c.strokeStyle = css("--aviso"); c.setLineDash([2, 3]); c.beginPath(); c.moveTo(xx, 6); c.lineTo(xx, H - B); c.stroke(); c.setLineDash([]); c.fillStyle = css("--aviso"); c.beginPath(); c.arc(xx, 8, 3.5, 0, 7); c.fill(); });
    cv._mapa = {pts, x, y, sufijo, dec, notas: notas || []};
  };
  animarDibujo(cv, dibujar, animar);
}

function graficaJug(animar) {
  if (!S) return;
  const fin = S.t, ini = fin - horas * 3600;
  let pts = S.serie.filter(p => p[0] >= ini);
  if ($("suave").checked) pts = suavizar(pts);
  const fantasma = $("verAyer").checked && horas <= 24 ? S.serie.filter(p => p[0] >= ini - 86400 && p[0] <= fin - 86400).map(p => [p[0] + 86400, p[1]]) : null;
  $("leyAyer").style.opacity = fantasma && fantasma.length ? 1 : 0.35;
  linea($("cvJug"), {pts, ini, fin, fantasma, notas: leer("notas", []), sufijo: " jugadores"}, animar);
}
function graficaServ(animar) {
  if (!S) return;
  const fin = S.t, ini = Math.max(S.inicio, fin - 7 * 86400);
  linea($("cvServ"), {pts: S.serieServ, ini, fin: Math.max(fin, ini + 3600), maxMin: 3, sufijo: " servidores"}, animar);
}
function graficaLike(animar) {
  if (!S) return;
  const fin = S.t, ini = Math.max(S.inicio, fin - 30 * 86400);
  linea($("cvLike"), {pts: S.serieLike, ini, fin: Math.max(fin, ini + 3600), min: "auto", maxMin: 0, sufijo: "% me gusta", dec: 1}, animar);
}
function graficaHoras(animar) {
  if (!S) return;
  const cv = $("cvHoras"), hoy = S.horasHoy, ayer = S.horasAyer;
  const max = Math.max(5, ...hoy.map(v => v ?? 0), ...ayer.map(v => v ?? 0)) * 1.15, hAct = new Date().getHours();
  const dibujar = prog => {
    const P = preparar(cv); if (!P) return; const {c, W, H} = P;
    const L = 30, B = 20, ancho = (W - L) / 24, base = H - B, alto = v => v / max * (H - B - 6);
    c.fillStyle = css("--tenue"); c.strokeStyle = css("--linea");
    for (let i = 0; i <= 2; i++) { const v = Math.round(max / 2 * i), yy = base - alto(v); c.beginPath(); c.moveTo(L, yy); c.lineTo(W, yy); c.stroke(); c.fillText(v, 2, yy + 3); }
    for (let h = 0; h < 24; h++) {
      const x = L + h * ancho + 1, w = Math.max(2, ancho / 2 - 1.5);
      const barra = (v, xx, col) => { if (v == null) return; const hh = alto(v) * prog; c.fillStyle = col; c.beginPath(); if (c.roundRect) c.roundRect(xx, base - hh, w, hh, 2); else c.rect(xx, base - hh, w, hh); c.fill(); };
      barra(ayer[h], x, css("--linea"));
      barra(hoy[h], x + w + 1, h === hAct ? css("--acento") : css("--acento-m"));
      if (h % 6 === 0) { c.fillStyle = css("--tenue"); c.fillText(String(h).padStart(2, "0") + "h", x, H - 4); }
    }
    cv._barras = {L, ancho};
  };
  animarDibujo(cv, dibujar, animar);
}
function graficas(animar) {
  const v = document.querySelector(".vista.activa");
  if (!v || !S) return;
  if (v.id === "v-jugadores") { graficaJug(animar); graficaServ(animar); }
  if (v.id === "v-visitas") { graficaHoras(animar); graficaLike(animar); }
}

function tooltip(cv, tip, buscar) {
  const mover = e => {
    const r = cv.getBoundingClientRect(), p = e.touches ? e.touches[0] : e;
    const res = buscar(p.clientX - r.left); if (!res) { tip.style.opacity = 0; return; }
    tip.textContent = res.txt; tip.style.left = Math.min(Math.max(res.x, 70), r.width - 70) + "px"; tip.style.top = res.y + "px"; tip.style.opacity = 1;
  };
  cv.addEventListener("pointermove", mover); cv.addEventListener("pointerdown", mover);
  cv.addEventListener("pointerleave", () => tip.style.opacity = 0);
  cv.addEventListener("pointerup", e => { if (e.pointerType !== "mouse") setTimeout(() => tip.style.opacity = 0, 1800); });
}
const buscarLinea = cv => px => {
  const m = cv._mapa; if (!m) return null;
  const nota = m.notas.find(n => Math.abs(m.x(n.t) - px) < 8);
  if (nota) return {x: m.x(nota.t), y: 20, txt: `📝 ${nota.txt} · ${fecha(nota.t)}`};
  let mejor = null, d = 1e9; m.pts.forEach(p => { const dd = Math.abs(m.x(p[0]) - px); if (dd < d) { d = dd; mejor = p; } });
  return mejor && {x: m.x(mejor[0]), y: m.y(mejor[1]), txt: `${fmt(mejor[1], m.dec)}${m.sufijo} · ${new Date(mejor[0] * 1000).toLocaleString("es-ES", {weekday: "short", hour: "2-digit", minute: "2-digit"})}`};
};
tooltip($("cvJug"), $("tipJug"), buscarLinea($("cvJug")));
tooltip($("cvServ"), $("tipServ"), buscarLinea($("cvServ")));
tooltip($("cvLike"), $("tipLike"), buscarLinea($("cvLike")));
tooltip($("cvHoras"), $("tipHoras"), px => {
  const b = $("cvHoras")._barras; if (!b || !S) return null;
  const h = Math.floor((px - b.L) / b.ancho); if (h < 0 || h > 23) return null;
  const hoy = S.horasHoy[h], ayer = S.horasAyer[h];
  return {x: b.L + h * b.ancho + b.ancho / 2, y: 24, txt: `${h}:00 · hoy ${hoy ?? "—"} · ayer ${ayer ?? "—"}`};
});

$("rangos").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  horas = +b.dataset.h;
  $("rangos").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b));
  $("cvJug")._yaAnimado = false; graficaJug(true);
});
$("verAyer").onchange = $("suave").onchange = () => graficaJug(false);
$("ordenServ").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  ordenServ = b.dataset.o;
  $("ordenServ").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b));
  if (S) pintarServidores(S);
});
$("buscarProd").addEventListener("input", () => { if (S) pintarJuego(S); });

//==================================================================
// NOTAS Y BUSCAR EN EL HISTORIAL
//==================================================================
function pintarNotas() {
  const notas = leer("notas", []);
  $("notas").innerHTML = notas.length ? [...notas].reverse().map((n, i) => `<div class="item"><span>📝 ${esc(n.txt)}</span><b>${fecha(n.t)} <button class="x" data-i="${notas.length - 1 - i}" aria-label="Borrar nota">×</button></b></div>`).join("") : '<div class="vacio">Aún no hay notas.</div>';
}
$("notaAdd").onclick = () => {
  const txt = $("notaTxt").value.trim(); if (!txt) return;
  const notas = leer("notas", []); notas.push({t: Math.floor(Date.now() / 1000), txt}); guardar("notas", notas.slice(-50));
  $("notaTxt").value = ""; pintarNotas(); toast("Nota guardada: sale en la gráfica de jugadores");
};
$("notaTxt").addEventListener("keydown", e => { if (e.key === "Enter") $("notaAdd").click(); });
$("notas").addEventListener("click", e => {
  const b = e.target.closest(".x"); if (!b) return;
  const notas = leer("notas", []); notas.splice(+b.dataset.i, 1); guardar("notas", notas); pintarNotas();
});
function buscarMomento() {
  if (!S) return;
  const inp = $("buscarFecha");
  if (!inp.value) { const d = new Date(Math.max(S.inicio * 1000 + 600000, Date.now() - 3600000) - new Date().getTimezoneOffset() * 60000); inp.value = d.toISOString().slice(0, 16); }
  const t = Math.floor(new Date(inp.value) / 1000), f = S.filas;
  if (!t || t < S.inicio - 600 || t > S.t + 600) { $("resBuscar").innerHTML = `<div class="vacio">Solo hay datos desde ${fecha(S.inicio)}.</div>`; return; }
  let mejor = f[0]; f.forEach(x => { if (Math.abs(x.t - t) < Math.abs(mejor.t - t)) mejor = x; });
  const v = mejor.up != null ? mejor.up + mejor.down : 0;
  $("resBuscar").innerHTML = [
    item("Lectura más cercana", fecha(mejor.t)), item("Jugando", fmt(mejor.playing)), item("Visitas totales", fmt(mejor.visits)),
    item("Favoritos", fmt(mejor.fav)), v ? item("Me gusta", Math.round(mejor.up / v * 100) + "%") : "",
    mejor.srv != null ? item("Servidores", fmt(mejor.srv)) : "", mejor.grp != null ? item("Miembros del grupo", fmt(mejor.grp)) : "",
  ].join("");
}
$("buscarFecha").addEventListener("change", buscarMomento);

//==================================================================
// COMPARTIR / EXPORTAR
//==================================================================
function textoResumen() {
  const s = S;
  return [`**🛡️ Defiende tu tropa! — ${new Date().toLocaleDateString("es-ES", {weekday: "long", day: "numeric", month: "long"})}**`,
    `👥 Jugando ahora: **${fmt(s.playing)}** (pico de hoy ${fmt(s.pico)})`,
    `📈 Visitas hoy: **${fmt(s.hoy)}**${s.ayer && s.ayer.hoy ? ` (${pct(s.hoy, s.ayer.hoy) >= 0 ? "+" : ""}${pct(s.hoy, s.ayer.hoy)}% vs ayer)` : ""}`,
    `🌍 Visitas totales: **${fmt(s.visits, 0, false)}**`,
    `⭐ Favoritos: **${fmt(s.fav, 0, false)}** (+${fmt(s.favHoy)} hoy)`,
    s.like != null ? `👍 Me gusta: **${s.like}%**` : "",
    s.grupo != null ? `👨‍👩‍👧 Grupo: **${fmt(s.grupo, 0, false)}** miembros` : "",
    s.hito.sig ? `🎯 Próximo hito: ${fmt(s.hito.sig)} visitas (${s.hitoPct}%)` : ""].filter(Boolean).join("\n");
}
$("btnCopiar").onclick = async () => {
  if (!S) return;
  const t = textoResumen();
  try { await navigator.clipboard.writeText(t); toast("Resumen copiado: pégalo en Discord"); }
  catch { const ta = document.createElement("textarea"); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); toast("Resumen copiado"); } catch { toast("No se pudo copiar"); } ta.remove(); }
};
function tarjetaPNG() {
  const s = S, cv = document.createElement("canvas"), c = cv.getContext("2d"); cv.width = 1080; cv.height = 1080;
  const g = c.createLinearGradient(0, 0, 1080, 1080); g.addColorStop(0, "#0f1d2a"); g.addColorStop(1, "#07090d"); c.fillStyle = g; c.fillRect(0, 0, 1080, 1080);
  c.strokeStyle = "rgba(94,230,255,.08)"; for (let i = 0; i < 1080; i += 54) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 1080); c.moveTo(0, i); c.lineTo(1080, i); c.stroke(); }
  c.fillStyle = "#5ee6ff"; c.font = "600 34px 'Chakra Petch', sans-serif"; c.fillText("DEFIENDE TU TROPA! STATS", 80, 130);
  c.fillStyle = "#8591a3"; c.font = "400 28px 'IBM Plex Mono', monospace"; c.fillText(new Date().toLocaleDateString("es-ES", {weekday: "long", day: "numeric", month: "long"}), 80, 180);
  c.fillStyle = "#e8eef7"; c.font = "500 150px 'IBM Plex Mono', monospace"; c.fillText(fmt(s.visits, 0, false), 80, 380);
  c.fillStyle = "#8591a3"; c.font = "500 30px 'IBM Plex Mono', monospace"; c.fillText("VISITAS TOTALES", 84, 430);
  const datos = [["JUGANDO", fmt(s.playing)], ["VISITAS HOY", fmt(s.hoy)], ["PICO HOY", fmt(s.pico)], ["FAVORITOS", fmt(s.fav, 0, false)], ["ME GUSTA", s.like == null ? "—" : s.like + "%"], ["GRUPO", fmt(s.grupo, 0, false)]];
  datos.forEach(([k, v], i) => { const x = 80 + (i % 2) * 470, y = 560 + Math.floor(i / 2) * 160;
    c.fillStyle = "#0e131b"; c.strokeStyle = "#1c2431"; c.lineWidth = 2; c.beginPath(); if (c.roundRect) c.roundRect(x, y - 70, 440, 135, 22); else c.rect(x, y - 70, 440, 135); c.fill(); c.stroke();
    c.fillStyle = "#8591a3"; c.font = "500 24px 'IBM Plex Mono', monospace"; c.fillText(k, x + 28, y - 26);
    c.fillStyle = "#e8eef7"; c.font = "500 56px 'IBM Plex Mono', monospace"; c.fillText(v, x + 28, y + 38); });
  return new Promise(r => cv.toBlob(r, "image/png"));
}
function descargar(blob, nombre) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
$("btnTarjeta").onclick = async () => {
  if (!S) return;
  const blob = await tarjetaPNG(), file = new File([blob], "defiende-tu-tropa-hoy.png", {type: "image/png"});
  try { if (navigator.canShare && navigator.canShare({files: [file]})) { await navigator.share({files: [file], title: "Defiende tu tropa! hoy", text: textoResumen().replace(/\*\*/g, "")}); return; } } catch (e) { if (e.name === "AbortError") return; }
  descargar(blob, "defiende-tu-tropa-hoy.png"); toast("Imagen descargada");
};
$("btnCsv").onclick = () => {
  if (!S) return;
  const csv = "fecha;jugando;visitas;favoritos;me_gusta;no_me_gusta;servidores;miembros_grupo;seguidores\n" + S.filas.map(f =>
    [new Date(f.t * 1000).toLocaleString("es-ES"), f.playing, f.visits, f.fav, f.up ?? "", f.down ?? "", f.srv ?? "", f.grp ?? "", f.fol ?? ""].join(";")).join("\n");
  descargar(new Blob(["﻿" + csv], {type: "text/csv"}), "defiende-tu-tropa-historial.csv"); toast("Historial descargado");
};
$("btnJson").onclick = () => { if (robot) { descargar(new Blob([JSON.stringify(robot, null, 1)], {type: "application/json"}), "defiende-tu-tropa-datos.json"); toast("Datos descargados"); } };

//==================================================================
// MODO TV
//==================================================================
let bloqueo = null;
$("btnTV").onclick = async () => {
  document.body.classList.add("tv"); irA("inicio");
  try { await document.documentElement.requestFullscreen(); } catch {}
  try { bloqueo = await navigator.wakeLock.request("screen"); } catch {}
  toast("Modo TV: la pantalla no se apagará");
};
function salirTV() { document.body.classList.remove("tv"); try { if (document.fullscreenElement) document.exitFullscreen(); } catch {} try { bloqueo && bloqueo.release(); } catch {} bloqueo = null; }
$("salirTV").onclick = salirTV;
document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && document.body.classList.contains("tv")) salirTV(); });
document.addEventListener("visibilitychange", async () => { if (!document.hidden && document.body.classList.contains("tv") && !bloqueo) { try { bloqueo = await navigator.wakeLock.request("screen"); } catch {} } });

//==================================================================
// MENU, DESLIZAR Y TIRAR PARA ACTUALIZAR
//==================================================================
let vistaActual = "inicio";
function irA(v, dir = 0) {
  if (!VISTAS.includes(v)) v = "inicio";
  vistaActual = v;
  document.querySelectorAll(".vista").forEach(s => {
    const on = s.id === "v-" + v;
    s.classList.toggle("activa", on); s.classList.remove("desde-izq", "desde-der");
    if (on && dir) s.classList.add(dir > 0 ? "desde-der" : "desde-izq");
  });
  document.querySelectorAll("#menu button").forEach(b => b.dataset.v === v ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current"));
  guardar("vista", v);
  scrollTo({top: 0, behavior: lento ? "auto" : "smooth"});
  document.querySelectorAll("canvas").forEach(c => c._yaAnimado = false);
  requestAnimationFrame(() => graficas(true));
}
$("menu").addEventListener("click", e => { const b = e.target.closest("button"); if (b) { vibrar(8); irA(b.dataset.v, Math.sign(VISTAS.indexOf(b.dataset.v) - VISTAS.indexOf(vistaActual))); } });

let toque = null;
const zonaLibre = el => !el.closest("canvas, .galeria, .scroll, .tienda, input, select, textarea, .hoja, .tabs");
document.addEventListener("touchstart", e => {
  if (e.touches.length !== 1 || document.body.classList.contains("tv")) { toque = null; return; }
  const p = e.touches[0]; toque = {x: p.clientX, y: p.clientY, arriba: scrollY <= 0, libre: zonaLibre(e.target)};
}, {passive: true});
document.addEventListener("touchmove", e => {
  if (!toque) return;
  const p = e.touches[0], dy = p.clientY - toque.y, dx = p.clientX - toque.x;
  if (toque.arriba && dy > 0 && Math.abs(dy) > Math.abs(dx)) {
    const h = Math.min(70, dy * 0.45); $("tirar").style.height = h + "px";
    $("tirar").querySelector("svg").style.transform = h >= 60 ? "rotate(180deg)" : "";
  }
}, {passive: true});
document.addEventListener("touchend", e => {
  if (!toque) return;
  const p = e.changedTouches[0], dx = p.clientX - toque.x, dy = p.clientY - toque.y;
  const tirado = parseFloat($("tirar").style.height) >= 60;
  $("tirar").style.height = "0";
  if (tirado) { vibrar(15); robotLeido = 0; cargar().then(() => toast("Actualizado")); }
  else if (toque.libre && Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) {
    const i = VISTAS.indexOf(vistaActual) + (dx < 0 ? 1 : -1);
    if (i >= 0 && i < VISTAS.length) { vibrar(8); irA(VISTAS[i], dx < 0 ? 1 : -1); }
  }
  toque = null;
}, {passive: true});

//==================================================================
// AJUSTES
//==================================================================
function abrirAjustes(si) { $("hoja").classList.toggle("abierta", si); $("velo").classList.toggle("abierto", si); }
$("btnAjustes").onclick = () => abrirAjustes(true);
$("velo").onclick = $("btnCerrar").onclick = () => abrirAjustes(false);
function aplicarTema() { const t = leer("tema"); document.documentElement.dataset.theme = t; document.querySelector('meta[name="theme-color"]').content = t === "light" ? "#f3f6fa" : "#07090d"; }
function montarAjustes() {
  const el = $("opcTarjetas"), elegidas = leer("tarjetas"); el.textContent = "";
  Object.entries(TARJETAS).forEach(([k, [nombre]]) => {
    const d = document.createElement("div"); d.className = "opc";
    d.innerHTML = `<label for="t-${k}">${nombre}</label><input type="checkbox" class="interruptor" id="t-${k}" ${elegidas.includes(k) ? "checked" : ""}>`;
    d.querySelector("input").onchange = e => { let l = leer("tarjetas"); l = e.target.checked ? [...l.filter(x => x !== k), k] : l.filter(x => x !== k); guardar("tarjetas", l); pintarTarjetas(); };
    el.appendChild(d);
  });
  $("tema").value = leer("tema"); $("compacto").checked = leer("compacto"); $("intervalo").value = leer("intervalo");
  $("objVis").value = leer("objVis"); $("objJug").value = leer("objJug");
  ["avisoOn", "avisoViral", "avisoRec", "vibrar"].forEach(k => $(k).checked = leer(k));
  $("avisoN").value = leer("avisoN");
}
$("tema").onchange = e => { guardar("tema", e.target.value); aplicarTema(); document.querySelectorAll("canvas").forEach(c => c._yaAnimado = false); graficas(false); };
$("compacto").onchange = e => { guardar("compacto", e.target.checked); if (S) pintar(); };
$("intervalo").onchange = e => { guardar("intervalo", +e.target.value); proxima = Date.now() + 1000; };
$("objVis").onchange = e => { guardar("objVis", Math.max(1, +e.target.value || 100)); if (S) pintarInicio(S); };
$("objJug").onchange = e => { guardar("objJug", Math.max(1, +e.target.value || 10)); if (S) pintarInicio(S); };
$("avisoN").onchange = e => { const n = Math.max(1, +e.target.value || 10); e.target.value = n; guardar("avisoN", n); };
["avisoViral", "avisoRec", "vibrar"].forEach(k => $(k).onchange = e => guardar(k, e.target.checked));
$("avisoOn").onchange = async e => {
  guardar("avisoOn", e.target.checked);
  if (e.target.checked && "Notification" in window && Notification.permission === "default") { try { await Notification.requestPermission(); } catch {} }
  toast(e.target.checked ? `Te aviso cuando haya ${$("avisoN").value} jugadores o más` : "Avisos desactivados");
};
$("btnReset").onclick = () => {
  Object.keys(DEF).forEach(k => { try { localStorage.removeItem("dtt_" + k); } catch {} });
  montarAjustes(); aplicarTema(); pintarTarjetas(); if (S) pintar(); toast("Ajustes restablecidos (tus notas se mantienen)");
};
// instalar como app (Android/PC: boton propio; iPhone: instrucciones)
let promptInstalar = null;
addEventListener("beforeinstallprompt", e => { e.preventDefault(); promptInstalar = e; $("btnInstalar").hidden = false; $("instalarTxt").hidden = true; });
$("btnInstalar").onclick = async () => { if (!promptInstalar) return; promptInstalar.prompt(); await promptInstalar.userChoice; promptInstalar = null; $("btnInstalar").hidden = true; };
if (/iphone|ipad/i.test(navigator.userAgent)) $("instalarTxt").textContent = "En iPhone: botón Compartir → \"Añadir a pantalla de inicio\".";

//==================================================================
// AVISOS: jugadores, pico viral, records e hitos
//==================================================================
let yaAvisado = false, ultimoViral = 0;
function notificar(txt) {
  toast(txt); vibrar([120, 60, 120]);
  try { if ("Notification" in window && Notification.permission === "granted" && document.hidden) new Notification("Defiende tu tropa!", {body: txt, icon: "icono-192.png"}); } catch {}
}
function avisos() {
  const s = S; if (!s) return;
  if (leer("avisoOn")) {
    const n = leer("avisoN");
    if (s.playing >= n && !yaAvisado) { yaAvisado = true; notificar(`🔥 ${s.playing} jugando ahora en Defiende tu tropa!`); }
    else if (s.playing < n) yaAvisado = false;
  }
  if (leer("avisoViral") && Date.now() - ultimoViral > 3600000) {
    const media = s.dia / 1440;
    if (s.porMin >= 3 && media > 0 && s.porMin > media * 2.5) { ultimoViral = Date.now(); notificar(`🚀 ¡Pico de visitas! ${fmt(s.porMin, 1)}/min (lo normal hoy es ${fmt(media, 1)})`); }
  }
  if (leer("avisoRec")) {
    const recVisto = leer("recVisto", null), hitoVisto = leer("hitoVisto", null);
    if (recVisto != null && s.record > recVisto) { confeti(); notificar(`🏆 ¡Nuevo récord! ${s.record} jugadores a la vez`); }
    const hitoActual = s.hito.prev;
    if (hitoVisto != null && hitoActual > hitoVisto) { confeti(); notificar(`🎉 ¡Has llegado a ${fmt(hitoActual)} visitas!`); }
    guardar("recVisto", s.record); guardar("hitoVisto", hitoActual);
  }
}

//==================================================================
// CICLO DE ACTUALIZACION
//==================================================================
let proxima = 0, cargandoYa = false;
async function cargar() {
  if (cargandoYa) return; cargandoYa = true;
  try {
    let directo = null;
    if (Date.now() - robotLeido > 120000 || !robot) {
      try { robot = await json(HIST_URL + "?t=" + Date.now()); robotLeido = Date.now(); } catch {}
    }
    try {
      const g = (await json(`https://games.roproxy.com/v1/games?universeIds=${UNIVERSO}`)).data[0];
      directo = {t: Math.floor(Date.now() / 1000), playing: g.playing, visits: g.visits, fav: g.favoritedCount};
      if (!robot) robot = {};
      robot.juego = Object.assign({}, robot.juego, {name: g.name, rootPlaceId: g.rootPlaceId, maxPlayers: g.maxPlayers, updated: g.updated, created: g.created,
        description: g.description, genre_l1: g.genre_l1, universeAvatarType: g.universeAvatarType,
        createVipServersAllowed: g.createVipServersAllowed, copyingAllowed: g.copyingAllowed, price: g.price});
    } catch {}
    if (!icono) { try { icono = (await json(`https://thumbnails.roproxy.com/v1/games/icons?universeIds=${UNIVERSO}&size=256x256&format=Png`)).data[0].imageUrl; } catch {} }
    // sin internet: lo ultimo que se vio en este movil
    if (!robot && !directo) { try { robot = JSON.parse(localStorage.getItem("dtt_cache") || "null"); } catch {} }
    const filas = [...((robot && robot.filas) || [])];
    if (directo && (!filas.length || directo.t > filas.at(-1).t)) filas.push(directo);
    proxima = Date.now() + leer("intervalo") * 1000;
    if (!filas.length) { $("led").className = "led off"; $("act").textContent = "sin conexión · reintentando"; return; }
    S = calcular(filas, robot);
    if (directo) { try { localStorage.setItem("dtt_cache", JSON.stringify(Object.assign({}, robot, {filas: filas.slice(-2500)}))); } catch {} }
    $("main").classList.remove("cargando");
    $("led").className = directo ? "led on" : "led off";
    $("act").textContent = (directo ? "en directo · " : "sin conexión · último dato ") + new Date(S.t * 1000).toLocaleTimeString("es-ES");
    pintar();
  } finally { cargandoYa = false; }
}
setInterval(() => {
  const total = leer("intervalo") * 1000, queda = Math.max(0, proxima - Date.now()) / total;
  $("anillo").style.strokeDashoffset = 119.4 * (1 - queda);
  if (proxima && Date.now() >= proxima && !document.hidden) cargar();
}, 1000);
$("btnAct").onclick = () => { if (!lento) $("btnAct").animate([{transform: "rotate(0)"}, {transform: "rotate(360deg)"}], {duration: 600}); vibrar(10); robotLeido = 0; cargar().then(() => toast("Actualizado")); };
document.addEventListener("visibilitychange", () => { if (!document.hidden && Date.now() > proxima - 5000) cargar(); });
addEventListener("resize", () => graficas(false));
addEventListener("online", () => { toast("Conexión recuperada"); cargar(); });
addEventListener("offline", () => toast("Sin internet: mostrando los últimos datos"));
if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));

aplicarTema();
montarAjustes();
pintarTarjetas();
irA(leer("vista", "inicio"));
cargar();
