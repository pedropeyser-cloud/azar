// Bots de la generala. Ven todo (como cualquiera en la mesa: la generala no tiene nada tapado).
//   Don Tranqui (tranquilo): junta el número que más tiene, anota lo que más suma en el momento y tacha lo primero libre.
//   Rata (rapido): hace la cuenta a ojo (pocas tiradas imaginadas y con ruido) y a veces se apura a anotar.
//   El Relámpago (implacable): para cada forma de apartar dados imagina muchas tiradas, compara lo que espera sacar
//     con lo que anota ya, y valora cada casillero contra lo que «suele» dar (no tacha la generala temprano).
//   Simulado (2026-11-19, 120 partidas de a 2): El Relámpago a Don Tranqui ~66%, a Rata ~59%; Rata a Don Tranqui ~55%.
//   La generala tiene mucha suerte: una cuenta exacta de los dos tiros que quedan ganaba solo 2 puntos por partida y
//   tardaba 20 veces más, así que se dejó la de tiradas imaginadas.
import { puntaje, libres, DADOS, TIROS, conteo, esEscalera, esFull } from "./motor.js";

/** Lo que suele dar cada casillero jugando bien: anotar por debajo cuesta, por encima es ganancia. */
export const PAR = { 1: 2, 2: 5, 3: 8, 4: 11, 5: 14, 6: 17, E: 12, F: 18, P: 14, G: 12, DG: 4 };
const DEMORA = { tranquilo: [1300, 2200], rapido: [600, 1100], implacable: [900, 1500] };
const QUE = { tranquilo: { muestras: 0 }, rapido: { muestras: 24, ruido: 5, apuro: 0.2 }, implacable: { muestras: 140, ruido: 0, apuro: 0 } };

function rng(semilla) {
  let s = semilla >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** Un número fijo por jugada y jugador (no cambia en cada pulso). */
const fijo = (e, j, k = 0) => (((e.seq + 1) * 9301 + j * 49297 + k * 233 + e.tiros * 7) % 233280) / 233280;
const entre = ([a, b], x) => a + (b - a) * x;

/** El mejor casillero para anotar ya: { cat, valor, puntos }. */
export function mejorAnotar(ds, planilla, cats, servida, ruido = () => 0) {
  let mejor = null;
  for (const cat of libres(planilla, cats)) {
    const puntos = puntaje(ds, cat, servida, planilla);
    const valor = puntos - PAR[cat] + ruido(cat);
    if (!mejor || valor > mejor.valor) mejor = { cat, valor, puntos };
  }
  return mejor;
}

/** Lo que espera sacar `j` si aparta `guardar` y tira el resto (una tirada más, con `muestras` imaginadas). */
function esperado(e, j, guardar, muestras, r) {
  const pl = e.planillas[j];
  let s = 0;
  for (let m = 0; m < muestras; m++) {
    const ds = e.dados.map((d, i) => (guardar.includes(i) ? d : 1 + Math.floor(r() * 6)));
    s += mejorAnotar(ds, pl, e.cats, false).valor;
  }
  // si después de esta tirada todavía queda otra, vale un poco más que lo que sale en una sola
  return s / muestras + (e.tiro + 1 < TIROS ? 1.5 : 0);
}

function calculador(e, j, dif) {
  const q = QUE[dif];
  const r = rng(((e.seq + 1) * 2654435761 + j * 97 + e.tiros) >>> 0);
  const ruido = q.ruido ? (k) => (fijo(e, j, String(k).charCodeAt(0)) - 0.5) * 2 * q.ruido : () => 0;
  const ya = mejorAnotar(e.dados, e.planillas[j], e.cats, e.tiro === 1, ruido);
  if (e.tiro >= TIROS) return { t: "anotar", cat: ya.cat };
  if (q.apuro && ya.puntos > 0 && fijo(e, j, 11) < q.apuro) return { t: "anotar", cat: ya.cat };
  let mejor = null, ev = -Infinity;
  for (let mask = 0; mask < (1 << DADOS) - 1; mask++) {
    const guardar = [];
    for (let i = 0; i < DADOS; i++) if (mask & (1 << i)) guardar.push(i);
    // apartar dados repetidos de distinta posición pero mismo valor da lo mismo: se mira una sola vez
    const clave = guardar.map((i) => e.dados[i]).sort().join("");
    if (mejor && mejor.vistas.has(clave)) continue;
    const x = esperado(e, j, guardar, q.muestras, r) + ruido(mask);
    if (!mejor) mejor = { vistas: new Set() };
    mejor.vistas.add(clave);
    if (x > ev) { ev = x; mejor.guardar = guardar; }
  }
  if (ya.valor >= ev) return { t: "anotar", cat: ya.cat };
  return { t: "tirar", guardar: mejor.guardar };
}

function tranqui(e, j) {
  const pl = e.planillas[j], abiertos = libres(pl, e.cats);
  const anotar = () => {
    let mejor = null;
    for (const cat of abiertos) { const p = puntaje(e.dados, cat, e.tiro === 1, pl); if (!mejor || p > mejor.p) mejor = { cat, p }; }
    return { t: "anotar", cat: mejor.p > 0 ? mejor.cat : abiertos[0] };
  };
  if (e.tiro >= TIROS) return anotar();
  if ((esEscalera(e.dados) && abiertos.includes("E")) || (esFull(e.dados) && abiertos.includes("F"))) return anotar();
  // el número que más tiene (entre los que le sirven), y se queda con esos
  const c = conteo(e.dados);
  let cara = 0;
  for (let k = 6; k >= 1; k--) if (c[k] > (c[cara] ?? -1)) cara = k;
  if (c[cara] === DADOS) return anotar();
  const guardar = e.dados.map((d, i) => (d === cara ? i : -1)).filter((i) => i >= 0);
  return { t: "tirar", guardar };
}

export function decidir(e, j, dif = "rapido") {
  if (e.tiro === 0) return { t: "tirar", guardar: [] };
  if (dif === "tranquilo") return tranqui(e, j);
  return calculador(e, j, dif === "implacable" ? "implacable" : "rapido");
}

export function bot(e, j, ahora, dif = "rapido") {
  if (e.fase !== "jugar" || e.turno !== j) return null;
  if (ahora - e.desde < entre(DEMORA[dif] || DEMORA.rapido, fijo(e, j, 9))) return null;
  return decidir(e, j, dif);
}
