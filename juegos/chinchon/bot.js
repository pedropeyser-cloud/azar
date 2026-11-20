// Bots del chinchón. Lo que saben: su mano, el pozo (todo lo que se tiró, porque todos lo vieron caer), lo que cada uno
// levantó del pozo y cuántas cartas tiene cada uno. Nunca miran el mazo ni las manos ajenas.
//   Don Tranqui (tranquilo): mira solo lo que tiene. Levanta del pozo si la carta le arma un juego, tira la más alta de
//     las sueltas (y se despista seguido), corta sin apuro y nunca espera el menos diez.
//   Rata (rapido): cuenta lo que le falta para armar y corta apenas puede, pero levanta del pozo cualquier carta que le
//     haga par o vecina y a veces tira de apuro la suelta más alta sin pensar.
//   El Relámpago (implacable): lo mismo que Rata pero contando las cartas muertas del pozo, sin darle al de al lado lo
//     que levantó, cortando con lo mínimo y esperando el menos diez cuando lo tiene a una carta.
import { acomodar, cortesPosibles, esComodin, numero, palo, valor, MAZO50, TOPE } from "./motor.js";

/** Los pesos salieron de simular bot contra bot (ver docs/chinchon/reglas.md, «Bots»). */
export const AJUSTE = { potRata: 0.35, potRelampago: 0.6, margenRata: 1, margenRelampago: 0.4, vecino: 2.5, esperaLimpio: 6, rataPozo: 0.15, rataApuro: 0.1, tranquiCorta: 0.4, tranquiDespiste: 0.35 };
const DEMORA = { tranquilo: [1500, 2600], rapido: [600, 1200], implacable: [900, 1600] };
const azarFijo = (e, j, k = 0) => (((e.seq + 1) * 9301 + j * 49297 + k * 233 + e.mano * 7919) % 233280) / 233280;
const entre = ([a, b], x) => a + (b - a) * x;

/** Cuántas veces puede salir cada carta que no veo (0 o 1: no hay repetidas). */
function vivas(e, j, dif) {
  const muertas = new Set([...e.manos[j], ...(dif === "implacable" ? e.pozo : e.pozo.slice(-1))]);
  return new Set(MAZO50.filter((c) => !muertas.has(c)));
}
/** Las cartas que le faltan a una suelta para armar juego con otra suelta. */
function salidas(sueltas, vivo) {
  const s = sueltas.filter((c) => !esComodin(c));
  const quiero = new Set();
  for (const a of s) for (const b of s) {
    if (a >= b) continue;
    if (numero(a) === numero(b)) for (const p of ["espada", "basto", "oro", "copa"]) quiero.add(`${numero(a)}-${p}`);
    if (palo(a) === palo(b)) {
      const [x, y] = [numero(a), numero(b)].sort((m, n) => m - n);
      if (y - x === 1) { if (x > 1) quiero.add(`${x - 1}-${palo(a)}`); if (y < 12) quiero.add(`${y + 1}-${palo(a)}`); }
      if (y - x === 2) quiero.add(`${x + 1}-${palo(a)}`);
    }
  }
  let n = 0; for (const c of quiero) if (vivo.has(c)) n++;
  return n;
}
/** Qué tan buena es una mano de 7 (más bajo, mejor): las sueltas menos lo que puede venir. */
function puntaje(mano, dif, vivo, e, j) {
  const a = acomodar(mano);
  if (dif === "tranquilo") return a.puntos;
  let p = a.puntos - (dif === "implacable" ? AJUSTE.potRelampago : AJUSTE.potRata) * salidas(a.sueltas, vivo);
  // el comodín suelto pesa mucho pero casi siempre entra: no hay que tirarlo
  if (a.sueltas.some(esComodin)) p -= 18;
  return p;
}
/** Lo que no conviene tirar: cartas que le sirven al que sigue (según lo que levantó del pozo). */
function leSirve(e, j, c) {
  if (esComodin(c)) return true;
  let k = j; for (let i = 0; i < e.n; i++) { k = (k + 1) % e.n; if (!e.fuera.includes(k)) break; }
  return (e.tomadas?.[k] || []).some((t) => !esComodin(t) && (numero(t) === numero(c) || (palo(t) === palo(c) && Math.abs(numero(t) - numero(c)) <= 2)));
}

/** La mejor carta para tirar de una mano de 8 y cómo queda. */
function mejorTiro(e, j, mano, dif, vivo, prohibida) {
  let mejor = null;
  for (const c of mano) {
    if (c === prohibida) continue;
    const resto = mano.filter((x) => x !== c);
    let p = puntaje(resto, dif, vivo, e, j);
    if (dif === "implacable" && leSirve(e, j, c)) p += AJUSTE.vecino;
    if (esComodin(c)) p += 30;
    if (!mejor || p < mejor.p || (p === mejor.p && valor(c) > valor(mejor.c))) mejor = { c, p };
  }
  return mejor;
}

function robar(e, j, dif) {
  const top = e.pozo[e.pozo.length - 1];
  if (!top) return { t: "robar", de: "mazo" };
  if (esComodin(top)) return { t: "robar", de: "pozo" };
  const mano = e.manos[j];
  if (dif === "tranquilo") {
    // solo si la carta del pozo queda adentro de un juego
    const a = acomodar([...mano, top]);
    return { t: "robar", de: a.juegos.some((g) => g.includes(top)) && azarFijo(e, j, 1) < 0.85 ? "pozo" : "mazo" };
  }
  // Rata: si la del pozo le hace par o vecina, la levanta sin pensar
  if (dif === "rapido" && azarFijo(e, j, 4) < AJUSTE.rataPozo && mano.some((c) => !esComodin(c) && (numero(c) === numero(top) || (palo(c) === palo(top) && Math.abs(numero(c) - numero(top)) === 1)))) return { t: "robar", de: "pozo" };
  const vivo = vivas(e, j, dif);
  const ahora = puntaje(mano, dif, vivo, e, j);
  const con = mejorTiro(e, j, [...mano, top], dif, vivo, top);
  const margen = dif === "implacable" ? AJUSTE.margenRelampago : AJUSTE.margenRata;
  return { t: "robar", de: con && con.p < ahora - margen ? "pozo" : "mazo" };
}

function tirarOCortar(e, j, dif) {
  const mano = e.manos[j];
  const cortes = cortesPosibles(e, j);
  if (cortes.length) {
    const ch = cortes.find((x) => x.corte.chinchon);
    if (ch) return { t: "cortar", carta: ch.carta };
    const mejor = cortes.reduce((m, x) => (x.corte.puntos < m.corte.puntos || (x.corte.puntos === m.corte.puntos && valor(x.carta) > valor(m.carta)) ? x : m));
    if (dif === "tranquilo") {
      // sin apuro: con 0 a 2 corta casi siempre; con más, a veces sigue
      if (mejor.corte.puntos <= 2 || azarFijo(e, j, 2) < AJUSTE.tranquiCorta) return { t: "cortar", carta: mejor.carta };
    } else if (dif === "implacable") {
      // espera el menos diez si le falta una sola carta, es temprano y nadie está por cortar
      const casi = mejor.corte.sueltas.length === 1 && mejor.corte.puntos <= 2 && e.turnos < AJUSTE.esperaLimpio * adentroN(e);
      const vivo = vivas(e, j, dif);
      const salen = casi ? salidaSuelta(mejor.corte, vivo) : 0;
      if (!(casi && salen >= 3 && e.puntos[j] + mejor.corte.puntos < TOPE - 20)) return { t: "cortar", carta: mejor.carta };
    } else return { t: "cortar", carta: mejor.carta };
  }
  if (dif === "tranquilo" || (dif === "rapido" && azarFijo(e, j, 5) < AJUSTE.rataApuro)) {
    // tira la suelta más alta (a veces una cualquiera de las sueltas)
    const a = acomodar(mano.filter((c) => c !== e.levanto));
    const sueltas = a.sueltas.filter((c) => !esComodin(c) && c !== e.levanto);
    const lista = sueltas.length ? sueltas : mano.filter((c) => c !== e.levanto && !esComodin(c));
    const orden = [...lista].sort((x, y) => valor(y) - valor(x));
    // Don Tranqui se despista seguido y tira una suelta cualquiera (Rata, cuando se apura, la más alta)
    const c = dif === "tranquilo" && azarFijo(e, j, 3) < AJUSTE.tranquiDespiste && orden.length > 1 ? orden[1 + Math.floor(azarFijo(e, j, 6) * (orden.length - 1))] : orden[0];
    return { t: "tirar", carta: c || mano.find((x) => x !== e.levanto) };
  }
  const vivo = vivas(e, j, dif);
  const m = mejorTiro(e, j, mano, dif, vivo, e.levanto);
  return { t: "tirar", carta: m.c };
}
const adentroN = (e) => e.n - e.fuera.length;
/** Cuántas cartas vivas acomodan la única suelta de un corte (para esperar el menos diez). */
function salidaSuelta(corte, vivo) {
  const s = corte.sueltas[0];
  let n = 0;
  for (const c of vivo) { const a = acomodar([...corte.juegos.flat(), s, c]); if (a.puntos === 0) n++; }
  return n;
}

export function bot(e, j, ahora, dif = "rapido") {
  if (e.fase === "fin") return null;
  if (e.fase === "recuento") {
    const r = e.recuento;
    if (!r.puedeReenganche.includes(j) || r.decidio[j] !== undefined || ahora < r.hasta - e.pausaRecuento + 1800) return null;
    const siguen = e.puntos.map((p, k) => k).filter((k) => !e.fuera.includes(k) && !r.pasados.includes(k));
    const conQue = Math.max(...siguen.map((k) => e.puntos[k]));
    return { t: "reenganche", si: dif !== "implacable" || conQue <= 85 };
  }
  if (e.turno !== j) return null;
  if (ahora - e.turnoDesde < entre(DEMORA[dif] || DEMORA.rapido, azarFijo(e, j, 8)) * (e.ritmo ?? 1)) return null;   // ritmo < 1 solo en las pruebas
  return e.fase === "robar" ? robar(e, j, dif) : tirarOCortar(e, j, dif);
}
