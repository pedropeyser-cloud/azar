// GENERALA de AZAR (etapa 5, 2026-11-19). Motor puro: sin DOM, sin red, sin Date.now().
// Reglas completas en docs/generala/reglas.md. En corto:
//   - 5 dados, hasta 3 tiros por turno; entre tiro y tiro apartás los que quieras y volvés a tirar el resto.
//   - Cada turno se anota en un casillero libre de tu planilla (si no da nada, se tacha con 0).
//   - Escalera 20, full 30, póker 40 (servidos, en el primer tiro: 25, 35, 45); generala 50; doble generala 100
//     (solo con la generala ya anotada). La generala servida gana la partida en el acto.
//   - Planilla completa (1 a 6 y los juegos, 11 casilleros) o corta (4, 5, 6 y los juegos sin la doble, 7): con
//     «auto», corta de a 4 o más (Pedro, 2026-11-19: «una versión más corta para 6 que no se haga eterna»).
//   - Gana el que más suma cuando todos llenaron la planilla; si empatan, ganan los dos.

export const juego = { id: "generala", nombre: "Generala", jugadores: [2, 6] };
export const DADOS = 5;
export const TIROS = 3;
export const COMPLETA = ["1", "2", "3", "4", "5", "6", "E", "F", "P", "G", "DG"];
export const CORTA = ["4", "5", "6", "E", "F", "P", "G"];
export const NOMBRES = { 1: "Al 1", 2: "Al 2", 3: "Al 3", 4: "Al 4", 5: "Al 5", 6: "Al 6", E: "Escalera", F: "Full", P: "Póker", G: "Generala", DG: "Doble generala" };
export const CORTOS = { 1: "1", 2: "2", 3: "3", 4: "4", 5: "5", 6: "6", E: "Escalera", F: "Full", P: "Póker", G: "Generala", DG: "Doble" };
export const JUEGOS = { E: [20, 25], F: [30, 35], P: [40, 45] };
export const servible = (cat) => cat in JUEGOS;

function rng(semilla) {
  let s = semilla >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const copia = (e) => JSON.parse(JSON.stringify(e));
const rechazo = (e, motivo, mensaje) => ({ estado: e, eventos: [], rechazo: { motivo, mensaje } });

/** Cuántos hay de cada cara: [_, unos, doses, …, seises]. */
export function conteo(ds) { const c = [0, 0, 0, 0, 0, 0, 0]; for (const d of ds) c[d]++; return c; }
export function esEscalera(ds) {
  if (ds.length !== DADOS) return false;
  const s = [...new Set(ds)].sort((a, b) => a - b).join("");
  return s === "12345" || s === "23456" || s === "13456";   // la del as al final (3-4-5-6-1) también vale
}
export const esFull = (ds) => { const c = conteo(ds).slice(1).filter(Boolean).sort(); return c.length === 2 && c[0] === 2 && c[1] === 3; };
export const esPoker = (ds) => conteo(ds).some((k) => k >= 4);
export const esGenerala = (ds) => ds.length === DADOS && conteo(ds).some((k) => k === DADOS);

/** Lo que vale `cat` con esos dados. `servida` = salieron en el primer tiro; `planilla` decide la doble. */
export function puntaje(ds, cat, servida = false, planilla = {}) {
  if (/^[1-6]$/.test(cat)) { const n = Number(cat); return ds.filter((d) => d === n).length * n; }
  if (cat === "E") return esEscalera(ds) ? JUEGOS.E[servida ? 1 : 0] : 0;
  if (cat === "F") return esFull(ds) ? JUEGOS.F[servida ? 1 : 0] : 0;
  if (cat === "P") return esPoker(ds) ? JUEGOS.P[servida ? 1 : 0] : 0;
  if (cat === "G") return esGenerala(ds) ? 50 : 0;
  if (cat === "DG") return esGenerala(ds) && planilla.G === 50 ? 100 : 0;
  return 0;
}
export const libres = (planilla, cats) => cats.filter((c) => planilla[c] === null || planilla[c] === undefined);
export const sumar = (planilla) => Object.values(planilla).reduce((s, x) => s + (x || 0), 0);

/** Qué planilla se usa: "completa", "corta" o "auto" (corta de a 4 o más). */
export const planillaDe = (modo, n) => (modo === "corta" || (modo !== "completa" && n >= 4) ? "corta" : "completa");

/** Opciones: { jugadores (2 a 6), nombres, semilla, ahora, abre, planilla = "auto", tiradas (pruebas: [[d,d,d,d,d], …] en orden) } */
export function nuevaPartida({ jugadores = 2, nombres, semilla, ahora = 0, abre, planilla = "auto", tiradas } = {}) {
  const n = Math.max(2, Math.min(6, jugadores | 0));
  const sem = (semilla ?? Math.floor(Math.random() * 2 ** 31)) >>> 0;
  const tipo = planillaDe(planilla, n);
  const cats = tipo === "corta" ? CORTA : COMPLETA;
  const turno = Number.isInteger(abre) ? abre % n : Math.floor(rng(sem ^ 0x9e3779b9)() * n);
  return {
    n, nombres: (nombres || []).slice(0, n).concat(Array(n).fill("Jugador")).slice(0, n),
    tipo, cats: [...cats], planillas: Array.from({ length: n }, () => Object.fromEntries(cats.map((c) => [c, null]))),
    semilla: sem, tiros: 0, tiradas: tiradas || null,
    fase: "jugar", turno, abre: turno, desde: ahora, tiro: 0, dados: [], guardados: [],
    ultima: null, servida: null, ganador: null, ganadores: [], seq: 0,
    eventosIniciales: [{ t: "turno", jugador: turno }],
  };
}

function tirarDados(e, guardar) {
  e.tiros++;
  const fija = e.tiradas?.[e.tiros - 1];
  const r = rng((e.semilla + e.tiros * 7919) >>> 0);
  const nuevos = Array.from({ length: DADOS }, (_, i) => (guardar.includes(i) ? e.dados[i] : fija ? fija[i] : 1 + Math.floor(r() * 6)));
  e.dados = nuevos;
}

const totales = (e) => e.planillas.map(sumar);
function cerrar(e, ev) {
  const t = totales(e);
  const max = Math.max(...t);
  e.fase = "fin"; e.turno = null;
  e.ganadores = e.servida !== null ? [e.servida] : t.map((x, j) => (x === max ? j : -1)).filter((j) => j >= 0);
  e.ganador = e.ganadores[0];
  const orden = Array.from({ length: e.n }, (_, j) => j).sort((a, b) => (e.ganadores.includes(b) - e.ganadores.includes(a)) || t[b] - t[a] || a - b);
  ev.push({ t: "fin", ganador: e.ganador, ganadores: [...e.ganadores], orden, totales: t, servida: e.servida });
}

/** Acciones: { t: "tirar", guardar: [índices que no se tiran] } · { t: "anotar", cat }. Todas en tu turno. */
export function aplicar(e0, j, a, ahora = 0) {
  if (!a || typeof a !== "object" || !Number.isInteger(j) || j < 0 || j >= e0.n) throw new Error("acción mal formada");
  if (e0.fase === "fin") return rechazo(e0, "fin", "La partida terminó.");
  if (e0.turno !== j) return rechazo(e0, "no_es_tu_turno", "No es tu turno.");
  const e = copia(e0), ev = [];

  if (a.t === "tirar") {
    if (e.tiro >= TIROS) return rechazo(e0, "sin_tiros", "Ya tiraste tres veces: anotá.");
    const guardar = e.tiro === 0 ? [] : [...new Set((Array.isArray(a.guardar) ? a.guardar : []).filter((i) => Number.isInteger(i) && i >= 0 && i < DADOS))].sort();
    if (guardar.length === DADOS) return rechazo(e0, "todos", "Apartaste los cinco: anotá.");
    tirarDados(e, guardar);
    e.tiro++; e.guardados = guardar; e.desde = ahora;
    ev.push({ t: "tiro", jugador: j, dados: [...e.dados], guardados: [...guardar], tiro: e.tiro });
    e.seq++;
    if (e.tiro === 1 && esGenerala(e.dados)) {
      e.servida = j;
      ev.push({ t: "servida", jugador: j, cara: e.dados[0] });
      cerrar(e, ev);
    }
    return { estado: e, eventos: ev };
  }

  if (a.t === "anotar") {
    if (e.tiro === 0) return rechazo(e0, "sin_tirar", "Primero tirá: tocá el cubilete.");
    const pl = e.planillas[j];
    if (!e.cats.includes(a.cat)) return rechazo(e0, "casillero", "Ese casillero no está en esta planilla.");
    if (pl[a.cat] !== null) return rechazo(e0, "ocupado", "Ese casillero ya está anotado.");
    const servida = e.tiro === 1;
    const puntos = puntaje(e.dados, a.cat, servida, pl);
    pl[a.cat] = puntos;
    e.ultima = { jugador: j, cat: a.cat, puntos, servida: servida && servible(a.cat) && puntos > 0, dados: [...e.dados] };
    ev.push({ t: "anota", jugador: j, cat: a.cat, puntos, servida: e.ultima.servida, dados: [...e.dados] });
    e.seq++;
    if (e.planillas.every((p) => libres(p, e.cats).length === 0)) { cerrar(e, ev); return { estado: e, eventos: ev }; }
    e.turno = (j + 1) % e.n; e.tiro = 0; e.dados = []; e.guardados = []; e.desde = ahora;
    ev.push({ t: "turno", jugador: e.turno });
    return { estado: e, eventos: ev };
  }
  throw new Error("acción desconocida");
}

/** Todo es público en la generala: los dados del que tira y las planillas de todos. */
export function vista(e, yo) {
  const mio = e.fase === "jugar" && e.turno === yo;
  const t = totales(e);
  return {
    juego: "generala", n: e.n, yo, nombres: [...e.nombres], fase: e.fase, turno: e.turno, turnoDesde: e.desde,
    tipo: e.tipo, cats: [...e.cats], planillas: e.planillas.map((p) => ({ ...p })), totales: t,
    tiro: e.tiro, dados: [...e.dados], guardados: [...e.guardados], ultima: e.ultima ? copia(e.ultima) : null,
    servida: e.servida, ganador: e.ganador, ganadores: [...e.ganadores],
    orden: e.fase === "fin" ? Array.from({ length: e.n }, (_, j) => j).sort((a, b) => (e.ganadores.includes(b) - e.ganadores.includes(a)) || t[b] - t[a] || a - b) : [],
    puedoTirar: mio && e.tiro < TIROS, puedoAnotar: mio && e.tiro > 0,
    seq: e.seq,
  };
}
