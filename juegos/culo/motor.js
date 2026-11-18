// CULO SUCIO, el del «¡Desconfío!» (AZAR, etapa 5, 2026-11-18). Motor puro: sin DOM, sin red, sin Date.now().
// Reglas (docs/culo/reglas.md):
//   - Baraja española de 40 (sin 8 ni 9), toda repartida. De 2 a 6.
//   - El que abre la ronda elige un número y tira de 1 a 4 cartas boca abajo diciendo «dos sietes», por ejemplo. Puede
//     mentir: lo único verdadero es cuántas tira.
//   - El que sigue confía y tira de 1 a 4 diciendo el mismo número (mintiendo o no), o desconfía.
//   - Cualquiera que no haya tirado esas cartas puede gritar «¡Desconfío!» hasta que el siguiente tire.
//   - Se dan vuelta las últimas cartas: si alguna no es del número, el que mintió se lleva toda la pila; si eran todas,
//     se la lleva el que desconfió. Abre la ronda nueva el que tenía razón.
//   - El que se queda sin cartas sale cuando el siguiente tira (o si desconfiaron y era verdad). Si mintió, se lleva la
//     pila y sigue jugando.
//   - El último que queda con cartas es el culo sucio.

export const juego = { id: "culo", nombre: "Culo sucio", jugadores: [2, 6] };
export const NUMEROS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
export const PALOS = ["espada", "basto", "oro", "copa"];
export const MAZO40 = PALOS.flatMap((p) => NUMEROS.map((n) => `${n}-${p}`));
export const idValido = (id) => typeof id === "string" && /^([1-7]|1[0-2])-(espada|basto|oro|copa)$/.test(id);
export const numero = (id) => Number(id.split("-")[0]);
const NOMBRE = { 1: ["as", "ases"], 2: ["dos", "doses"], 3: ["tres", "treses"], 4: ["cuatro", "cuatros"], 5: ["cinco", "cincos"], 6: ["seis", "seises"], 7: ["siete", "sietes"], 10: ["sota", "sotas"], 11: ["caballo", "caballos"], 12: ["rey", "reyes"] };
const CUANTOS = ["", "un", "dos", "tres", "cuatro"];
/** «dos sietes», «un rey», «tres sotas». */
export function dicho(n, num) { const [s, p] = NOMBRE[num] || ["?", "?"]; return `${n === 1 ? (num === 10 ? "una" : "un") : CUANTOS[n]} ${n === 1 ? s : p}`; }
export const nombreNumero = (num, plural = true) => (NOMBRE[num] || ["?", "?"])[plural ? 1 : 0];

function rng(semilla) {
  let s = (semilla ?? Math.floor(Math.random() * 2 ** 31)) >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function mezclar(ids, r) { const a = [...ids]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const copia = (e) => JSON.parse(JSON.stringify(e));
const rechazo = (e, motivo, mensaje) => ({ estado: e, eventos: [], rechazo: { motivo, mensaje } });
export const ordenar = (ids) => [...ids].sort((a, b) => numero(a) - numero(b) || a.localeCompare(b));

/** Opciones: { jugadores (2 a 6), nombres, semilla, ahora, abre (asiento), pausaRevelar = 2800, mazo } */
export function nuevaPartida({ jugadores = 2, nombres, semilla, ahora = 0, abre, pausaRevelar = 2800, mazo } = {}) {
  const n = Math.max(2, Math.min(6, jugadores | 0));
  const r = rng(semilla);
  const m = mazo ? [...mazo] : mezclar(MAZO40, r);
  const manos = Array.from({ length: n }, () => []);
  m.forEach((c, k) => manos[k % n].push(c));
  const e = {
    n, nombres: (nombres || []).slice(0, n).concat(Array(n).fill("Jugador")).slice(0, n),
    manos: manos.map(ordenar), pila: [], ronda: null, fase: "abrir",
    turno: Number.isInteger(abre) ? abre % n : Math.floor(r() * n), turnoDesde: ahora, jugadaDesde: ahora,
    pendiente: null,          // el que tiró sus últimas cartas: sale cuando el siguiente tira
    fuera: [],                // los que ya salieron, en orden
    revelar: null, pausaRevelar, culo: null, seq: 0,
    dudas: Array.from({ length: n }, () => ({ veces: 0, mintio: 0 })),   // a quién le desconfiaron y cuántas mentía (público)
  };
  e.eventosIniciales = [{ t: "reparto", abre: e.turno, cartas: e.manos.map((x) => x.length) }];
  return e;
}

const conCartas = (e) => e.manos.map((m, j) => (m.length ? j : -1)).filter((j) => j >= 0);
/** El siguiente que tiene cartas después de j. */
function siguiente(e, j) { for (let k = 1; k <= e.n; k++) { const x = (j + k) % e.n; if (e.manos[x].length) return x; } return null; }
const ultimaJugada = (e) => e.ronda?.jugadas[e.ronda.jugadas.length - 1] || null;

/** Puede desconfiar `j` ahora: hay una jugada abierta que no es suya y todavía juega. */
export function puedeDesconfiar(e, j) {
  const u = ultimaJugada(e);
  return e.fase === "seguir" && !!u && u.jugador !== j && (e.manos[j].length > 0) && !e.fuera.includes(j);
}

function salir(e, j, ev) {
  if (e.fuera.includes(j)) return;
  e.fuera.push(j);
  if (e.pendiente === j) e.pendiente = null;
  ev.push({ t: "sale", jugador: j, puesto: e.fuera.length });
}
function quizasFin(e, ev) {
  const quedan = conCartas(e).filter((j) => j !== e.pendiente);
  // sin nadie que le pueda desconfiar, el que tiró sus últimas cartas es el último que quedó jugando: culo sucio
  const culo = quedan.length === 0 ? e.pendiente : quedan.length === 1 && e.pendiente === null ? quedan[0] : undefined;
  if (culo !== undefined) {
    e.pendiente = null;
    e.fase = "fin"; e.culo = culo; e.turno = null; e.revelar = null;
    ev.push({ t: "fin", culo: e.culo, fuera: [...e.fuera] });
    return true;
  }
  return false;
}

/** Acciones: { t: "tirar", cartas: [ids], numero } (numero solo al abrir) · { t: "desconfio" } · { t: "confio" } (aceptar sin tirar: solo si el que tiró se quedó sin cartas y nadie más tiene) */
export function aplicar(e0, j, a, ahora = 0) {
  if (!a || typeof a !== "object" || !Number.isInteger(j) || j < 0 || j >= e0.n) throw new Error("acción mal formada");
  if (e0.fase === "fin") return rechazo(e0, "fin", "La partida terminó.");
  if (e0.fase === "revelar") return rechazo(e0, "revelando", "Esperá, se están dando vuelta las cartas.");
  const e = copia(e0), ev = [];

  if (a.t === "tirar") {
    if (!Array.isArray(a.cartas) || !a.cartas.length || a.cartas.length > 4 || !a.cartas.every(idValido) || new Set(a.cartas).size !== a.cartas.length) throw new Error("cartas mal formadas");
    if (e.turno !== j) return rechazo(e0, "no_es_tu_turno", "No es tu turno.");
    if (!a.cartas.every((c) => e.manos[j].includes(c))) return rechazo(e0, "no_esta", "Esa carta no la tenés.");
    let num;
    if (e.fase === "abrir") {
      if (!NUMEROS.includes(a.numero)) return rechazo(e0, "numero", "Elegí qué número decís.");
      num = a.numero;
      e.ronda = { numero: num, jugadas: [] };
    } else num = e.ronda.numero;
    // tirar cierra la ventana: el que se había quedado sin cartas, sale
    if (e.pendiente !== null && e.pendiente !== j) salir(e, e.pendiente, ev);
    e.manos[j] = e.manos[j].filter((c) => !a.cartas.includes(c));
    e.pila.push(...a.cartas);
    e.ronda.jugadas.push({ jugador: j, cartas: [...a.cartas] });
    ev.push({ t: "tiro", jugador: j, n: a.cartas.length, numero: num, abre: e.fase === "abrir", pila: e.pila.length });
    e.fase = "seguir"; e.jugadaDesde = ahora;
    if (!e.manos[j].length) { e.pendiente = j; ev.push({ t: "ultimas", jugador: j }); }
    const prox = siguiente(e, j);
    if (prox === null || prox === j) { if (quizasFin(e, ev)) { e.seq++; return { estado: e, eventos: ev }; } }
    e.turno = prox ?? j; e.turnoDesde = ahora;
    e.seq++;
    return { estado: e, eventos: ev };
  }

  if (a.t === "desconfio") {
    if (!puedeDesconfiar(e, j)) return rechazo(e0, "no_podes", e.fase !== "seguir" ? "No hay nada para desconfiar." : "Esas cartas son tuyas.");
    const u = ultimaJugada(e);
    const num = e.ronda.numero;
    const mintio = u.cartas.some((c) => numero(c) !== num);
    const toma = mintio ? u.jugador : j;
    e.revelar = { desconfia: j, jugador: u.jugador, cartas: [...u.cartas], numero: num, mintio, toma, pila: e.pila.length, hasta: ahora + e.pausaRevelar };
    e.fase = "revelar"; e.turno = null;
    e.dudas[u.jugador].veces++; if (mintio) e.dudas[u.jugador].mintio++;
    ev.push({ t: "desconfio", jugador: j, de: u.jugador, cartas: [...u.cartas], numero: num, mintio, toma, pila: e.pila.length });
    e.seq++;
    return { estado: e, eventos: ev };
  }

  if (a.t === "confio") {
    // solo para cerrar la partida: el que tiró se quedó sin cartas y vos sos el único que queda
    const quedan = conCartas(e);
    if (e.fase !== "seguir" || e.turno !== j || e.pendiente === null || quedan.length !== 1 || quedan[0] !== j) return rechazo(e0, "no_podes", "Tirá cartas o desconfiá.");
    salir(e, e.pendiente, ev);
    quizasFin(e, ev);
    e.seq++;
    return { estado: e, eventos: ev };
  }
  throw new Error("acción desconocida");
}

/** Cierra la vuelta de cartas: la pila va al que perdió la duda y abre la ronda nueva el que tenía razón. */
export function reloj(e0, ahora) {
  if (e0.fase !== "revelar" || ahora < e0.revelar.hasta) return { estado: e0, eventos: [] };
  const e = copia(e0), ev = [];
  const r = e.revelar;
  e.manos[r.toma] = ordenar([...e.manos[r.toma], ...e.pila]);
  ev.push({ t: "levanta", jugador: r.toma, n: e.pila.length });
  e.pila = []; e.ronda = null; e.revelar = null;
  if (e.pendiente !== null) {
    if (e.manos[e.pendiente].length) e.pendiente = null;          // mintió con las últimas: vuelve a jugar
    else salir(e, e.pendiente, ev);                               // era verdad: sale
  }
  if (quizasFin(e, ev)) { e.seq++; return { estado: e, eventos: ev }; }
  // abre el que tenía razón (si ya salió, el siguiente con cartas)
  const razon = r.mintio ? r.desconfia : r.jugador;
  e.turno = e.manos[razon].length ? razon : siguiente(e, razon);
  e.fase = "abrir"; e.turnoDesde = ahora; e.jugadaDesde = ahora;
  ev.push({ t: "ronda", abre: e.turno });
  e.seq++;
  return { estado: e, eventos: ev };
}

/** Lo que ve el jugador `yo`: su mano; de los demás, cuántas tienen; de la pila, cuántas hay y qué se dijo. */
export function vista(e, yo) {
  const u = ultimaJugada(e);
  return {
    juego: "culo", n: e.n, yo, nombres: [...e.nombres], fase: e.fase, turno: e.turno, turnoDesde: e.turnoDesde, jugadaDesde: e.jugadaDesde,
    mano: [...e.manos[yo]], enMano: e.manos.map((m) => m.length), pila: e.pila.length,
    ronda: e.ronda ? { numero: e.ronda.numero, jugadas: e.ronda.jugadas.map((x) => ({ jugador: x.jugador, n: x.cartas.length })) } : null,
    ultima: u ? { jugador: u.jugador, n: u.cartas.length } : null,
    pendiente: e.pendiente, fuera: [...e.fuera], culo: e.culo,
    // al final «ganaron» todos menos el culo sucio (para el sonido y la pantalla final)
    ganadores: e.fase === "fin" ? Array.from({ length: e.n }, (_, j) => j).filter((j) => j !== e.culo) : [],
    revelar: e.revelar ? copia(e.revelar) : null,
    puedoDesconfiar: puedeDesconfiar(e, yo),
    puedoConfiar: e.fase === "seguir" && e.turno === yo && e.pendiente !== null && conCartas(e).length === 1,
    seq: e.seq,
  };
}
