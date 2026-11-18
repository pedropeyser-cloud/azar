// Bots del culo sucio. Lo que saben: su mano, cuántas cartas dijo cada uno en la ronda y cuántas existen (4 por número).
//   Don Tranqui (tranquilo): casi no miente (solo si no le queda otra) y desconfía solo cuando es imposible que sea verdad,
//     y a veces ni eso.
//   Rata (rapido): miente seguido, mete una carta de más y desconfía a lo loco.
//   El Relámpago (implacable): cuenta: si lo dicho más lo que tiene pasa de 4, desconfía siempre; miente poco y con la
//     carta que menos le sirve; al que tira sus últimas cartas lo mira con lupa.
import { NUMEROS, numero, puedeDesconfiar } from "./motor.js";

/** Los umbrales de El Relámpago (salieron de simular contra los otros dos; ver docs/culo/reglas.md). */
export const AJUSTE = { turno: 0.5, fuera: 0.6, mentirAbrir: 0.6, historia: 0.95 };
const DEMORA = { tranquilo: [1700, 2800], rapido: [700, 1300], implacable: [1000, 1800] };
// para desconfiar fuera de turno: más lento, para que una persona llegue a gritar primero
const DEMORA_DUDA = { tranquilo: [2200, 3200], rapido: [1100, 2000], implacable: [1300, 2200] };
/** Un número fijo por jugada y jugador (no cambia en cada pulso). */
const azarFijo = (e, j, k = 0) => (((e.seq + 1) * 9301 + j * 49297 + k * 233) % 233280) / 233280;
const entre = ([a, b], x) => a + (b - a) * x;

function cuenta(mano) { const c = {}; for (const id of mano) c[numero(id)] = (c[numero(id)] || 0) + 1; return c; }

// combinatoria para la hipergeométrica
function comb(n, k) { if (k < 0 || k > n) return 0; let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; }
/** P(X ≥ m) con X = cuántas del número hay entre `d` cartas sacadas de `N`, de las cuales `K` son del número. */
function alMenos(N, K, d, m) { let p = 0; const tot = comb(N, d); if (!tot) return 0; for (let x = m; x <= Math.min(K, d); x++) p += comb(K, x) * comb(N - K, d - x) / tot; return p; }

/**
 * La cuenta de El Relámpago: sabe qué cartas tiró él a la pila (las suyas son conocidas) y calcula la probabilidad de
 * que el que tiró tuviera de verdad esas `m` cartas del número entre las que tenía en la mano.
 */
export function sospechaFina(e, j) {
  const r = e.ronda, u = r.jugadas[r.jugadas.length - 1];
  const mias = e.manos[j].filter((c) => numero(c) === r.numero).length;
  const tiradasMias = r.jugadas.filter((x) => x.jugador === j).flatMap((x) => x.cartas);
  const delNumeroMias = tiradasMias.filter((c) => numero(c) === r.numero).length;
  const K = 4 - mias - delNumeroMias;                              // las del número que no sé dónde están
  const m = u.cartas.length;
  if (K < m) return 1;                                             // no existen tantas: mentira segura
  const N = 40 - e.manos[j].length - tiradasMias.length;           // las cartas que no sé dónde están
  const d = e.manos[u.jugador].length + m;                         // las que tenía el que tiró
  let p = 1 - alMenos(N, K, Math.min(d, N), m);
  // lo que se vio en la mesa: al que ya pescaron mintiendo seguido se le cree menos
  const h = e.dudas?.[u.jugador];
  if (h) p = Math.max(p, ((h.mintio + 1) / (h.veces + 2)) * AJUSTE.historia);
  if (e.manos[u.jugador].length === 0) p = Math.min(1, p + 0.15);  // si no le desconfío, sale
  return p;
}

/** Qué tan probable es que la última jugada sea mentira, según lo que sabe `j` (la cuenta gruesa). 1 = seguro. */
export function sospecha(e, j) {
  const r = e.ronda, u = r.jugadas[r.jugadas.length - 1];
  const mias = e.manos[j].filter((c) => numero(c) === r.numero).length;
  const dichas = r.jugadas.reduce((s, x) => s + x.cartas.length, 0);
  if (mias + dichas > 4) return 1;
  const libres = 4 - mias;                                 // las que puede haber en las otras manos y la pila
  let p = (dichas - 1) / Math.max(1, libres) * 0.6 + (u.cartas.length - 1) * 0.12;
  if (e.manos[u.jugador].length === 0) p += 0.25;          // tiró sus últimas: si no le desconfío, sale
  if (e.manos[u.jugador].length <= 2) p += 0.1;
  return Math.max(0, Math.min(0.95, p));
}

function abrir(e, j, dif) {
  const c = cuenta(e.manos[j]);
  // el número del que más tiene; con empate, el más bajo
  const num = Number(Object.keys(c).sort((a, b) => c[b] - c[a] || a - b)[0]);
  const verdad = e.manos[j].filter((x) => numero(x) === num);
  let cartas = verdad.slice(0, 4);
  const resto = e.manos[j].filter((x) => numero(x) !== num);
  // Rata mete una de más; El Relámpago también, seguido: aunque de a 2 se pueda probar contando, si lo pescan la pila
  // todavía es chica, y Don Tranqui casi nunca cuenta (simulado el 2026-11-18)
  if (resto.length && cartas.length < 4 && ((dif === "rapido" && azarFijo(e, j) < 0.6) || (dif === "implacable" && azarFijo(e, j) < AJUSTE.mentirAbrir))) cartas = [...cartas, peorCarta(e.manos[j], num)];
  return { t: "tirar", cartas, numero: num };
}
/** La carta que menos le sirve: de un número del que tiene una sola. */
function peorCarta(mano, menos) {
  const c = cuenta(mano);
  return [...mano].filter((x) => numero(x) !== menos).sort((a, b) => c[numero(a)] - c[numero(b)])[0];
}

function seguir(e, j, dif) {
  const num = e.ronda.numero;
  const verdad = e.manos[j].filter((x) => numero(x) === num);
  const p = dif === "implacable" ? sospechaFina(e, j) : sospecha(e, j);
  // ¿desconfío en mi turno?
  if (p >= 1 && !(dif === "tranquilo" && azarFijo(e, j, 1) < 0.3)) return { t: "desconfio" };
  if (dif === "rapido" && p > 0.3 && azarFijo(e, j, 2) < 0.5) return { t: "desconfio" };
  if (dif === "implacable" && p > AJUSTE.turno) return { t: "desconfio" };
  if (verdad.length) {
    let cartas = verdad.slice(0, 4);
    if (dif === "rapido" && cartas.length < 4 && e.manos[j].length > cartas.length && azarFijo(e, j, 3) < 0.4) cartas = [...cartas, peorCarta(e.manos[j], num)];
    return { t: "tirar", cartas };
  }
  // no tengo: miento con una (Rata a veces con dos), o desconfío si ya sospechaba
  if (dif !== "rapido" && p > 0.35) return { t: "desconfio" };
  const una = peorCarta(e.manos[j], num) || e.manos[j][0];
  const cartas = dif === "rapido" && e.manos[j].length > 2 && azarFijo(e, j, 4) < 0.35 ? [una, peorCarta(e.manos[j].filter((x) => x !== una), num) || e.manos[j].find((x) => x !== una)] : [una];
  return { t: "tirar", cartas: cartas.filter(Boolean) };
}

export function bot(e, j, ahora, dif = "rapido") {
  if (e.fase === "fin" || e.fase === "revelar" || !e.manos[j].length) return null;
  // fuera de turno: solo desconfiar
  if (e.turno !== j) {
    if (!puedeDesconfiar(e, j) || ahora - e.jugadaDesde < entre(DEMORA_DUDA[dif] || DEMORA_DUDA.rapido, azarFijo(e, j, 5))) return null;
    const p = dif === "implacable" ? sospechaFina(e, j) : sospecha(e, j);
    if (p >= 1 && !(dif === "tranquilo" && azarFijo(e, j, 6) < 0.5)) return { t: "desconfio" };
    if (dif === "rapido" && p > 0.5 && azarFijo(e, j, 7) < 0.25) return { t: "desconfio" };
    if (dif === "implacable" && p > AJUSTE.fuera) return { t: "desconfio" };
    return null;
  }
  if (ahora - e.turnoDesde < entre(DEMORA[dif] || DEMORA.rapido, azarFijo(e, j, 8))) return null;
  if (e.fase === "abrir") return abrir(e, j, dif);
  // cerrar la partida: el que tiró se quedó sin cartas y yo soy el único con cartas
  if (e.pendiente !== null && e.manos.filter((m) => m.length).length === 1) return sospecha(e, j) > 0.15 || dif !== "tranquilo" ? { t: "desconfio" } : { t: "confio" };
  return seguir(e, j, dif);
}
export { NUMEROS };
