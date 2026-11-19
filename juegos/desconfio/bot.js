// Bots del Desconfío. Saben sus dados, cuántos tiene cada uno y lo que se viene apostando en la ronda.
//   Don Tranqui (tranquilo): cuenta a ojo y se olvida de que los ases son comodines; sube de a uno y desconfía cuando la
//     apuesta pasa la mitad de la mesa. Casi nunca confía.
//   Rata (rapido): hace la cuenta a medias (sin leer lo que apostaron los demás) y con ruido; mete faroles, a veces
//     salta uno de más y confía cuando el «justo» tiene algo de chance.
//   El Relámpago (implacable): binomial. Le suma al que apostó un dado del número que dijo, elige la subida con más
//     chance de ser cierta, desconfía cuando la apuesta vale menos que su mejor subida y confía si el «justo» es lo mejor.
import { contar, subidas, minimaCon, esValida, DADOS } from "./motor.js";

/** Los umbrales de El Relámpago (salieron de simular contra los otros dos; ver docs/desconfio/reglas.md). */
export const AJUSTE = { lectura: 1, margenConfio: 0.06, farol: 0.12 };
const DEMORA = { tranquilo: [1800, 3000], rapido: [700, 1300], implacable: [1100, 2000] };
/** Un número fijo por jugada y jugador (no cambia en cada pulso). */
const azarFijo = (e, j, k = 0) => (((e.seq + 1) * 9301 + j * 49297 + k * 233 + e.rondaN * 7) % 233280) / 233280;
const entre = ([a, b], x) => a + (b - a) * x;

// ---------- la binomial ----------
function comb(n, k) { if (k < 0 || k > n) return 0; let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; }
const exacta = (n, p, k) => (k < 0 || k > n ? 0 : comb(n, k) * p ** k * (1 - p) ** (n - k));
/** P(X ≥ k), X ~ Bin(n, p). */
export function alMenos(n, p, k) { if (k <= 0) return 1; if (k > n) return 0; let s = 0; for (let x = k; x <= n; x++) s += exacta(n, p, x); return s; }
const chance = (cara, obligada) => (cara === 1 || obligada ? 1 / 6 : 1 / 3);

/**
 * Lo que sabe `j` sobre una apuesta: cuántos tiene él, cuántos dados ajenos hay y cuántos «supone» por lo que apostaron
 * los demás (un dado por cada uno que apostó ese número, si `lectura`).
 */
function lo(e, j, cara, lectura) {
  const mios = contar([e.dados[j]], cara, e.obligada);
  let ajenos = e.cuantos.reduce((s, c) => s + c, 0) - e.cuantos[j];
  let supuestos = 0;
  if (lectura) {
    const ya = new Set();
    for (const x of e.cadena) if (x.jugador !== j && !ya.has(x.jugador) && (x.cara === cara || (!e.obligada && x.cara === 1 && cara !== 1))) { ya.add(x.jugador); if (e.cuantos[x.jugador] > 0) supuestos++; }
    supuestos = Math.min(supuestos * AJUSTE.lectura, ajenos);
  }
  return { mios, ajenos: ajenos - supuestos, supuestos };
}
/** Chance de que la apuesta (c, cara) sea cierta para `j`. */
export function chanceCierta(e, j, c, cara, lectura = true) {
  const { mios, ajenos, supuestos } = lo(e, j, cara, lectura);
  return alMenos(ajenos, chance(cara, e.obligada), c - mios - supuestos);
}
export function chanceJusta(e, j, c, cara, lectura = true) {
  const { mios, ajenos, supuestos } = lo(e, j, cara, lectura);
  return exacta(ajenos, chance(cara, e.obligada), c - mios - supuestos);
}

const masRepetida = (e, j, conAses) => {
  let mejor = 2, k = -1;
  for (let cara = 2; cara <= 6; cara++) { const x = e.dados[j].filter((d) => d === cara || (conAses && d === 1)).length; if (x > k || (x === k && cara > mejor)) { k = x; mejor = cara; } }
  return mejor;
};

function relampago(e, j) {
  const tot = e.cuantos.reduce((s, c) => s + c, 0);
  const opciones = subidas(e.apuesta, tot, e.obligada);
  let mejor = null, pm = -1;
  for (const o of opciones) {
    const p = chanceCierta(e, j, o.c, o.cara);
    // con la misma chance, la más chica (le deja menos margen al que sigue... y a mí si vuelve)
    if (p > pm + 1e-9) { pm = p; mejor = o; }
  }
  if (!e.apuesta) {
    // abrir: la más alta de mi mejor número que siga siendo bastante probable
    const cara = e.obligada ? e.dados[j][0] : masRepetida(e, j, true);
    let c = minimaCon(null, cara, tot, e.obligada) || 1;
    while (c + 1 <= tot && chanceCierta(e, j, c + 1, cara) >= 0.6) c++;
    return { t: "apostar", c, cara };
  }
  const { c, cara } = e.apuesta;
  const pCierta = chanceCierta(e, j, c, cara);
  const pJusta = chanceJusta(e, j, c, cara);
  const salvo = { desconfio: 1 - pCierta, subir: mejor ? pm : -1, confio: e.cuantos[j] < DADOS ? pJusta + AJUSTE.margenConfio : pJusta - 0.2 };
  if (salvo.confio > salvo.desconfio && salvo.confio > salvo.subir && pJusta > 0.3) return { t: "confio" };
  if (salvo.desconfio >= salvo.subir) return { t: "desconfio" };
  // a veces un farol chico: subir en mi número aunque no sea lo más probable, para no ser leído
  if (azarFijo(e, j, 3) < AJUSTE.farol) {
    const mia = masRepetida(e, j, !e.obligada), cm = minimaCon(e.apuesta, e.obligada ? cara : mia, tot, e.obligada);
    if (cm && chanceCierta(e, j, cm, e.obligada ? cara : mia) > pm - 0.1) return { t: "apostar", c: cm, cara: e.obligada ? cara : mia };
  }
  return { t: "apostar", c: mejor.c, cara: mejor.cara };
}

function tranqui(e, j) {
  const tot = e.cuantos.reduce((s, c) => s + c, 0);
  // a ojo: lo mío (sin ases) más un tercio de lo ajeno
  const estimo = (cara) => e.dados[j].filter((d) => d === cara).length + (tot - e.cuantos[j]) / 3;
  if (!e.apuesta) {
    const cara = e.obligada ? e.dados[j][0] : masRepetida(e, j, false);
    const c = Math.max(minimaCon(null, cara, tot, e.obligada) || 1, Math.floor(estimo(cara) * 0.8));
    return { t: "apostar", c: Math.min(c, tot), cara };
  }
  const { c, cara } = e.apuesta;
  if (c > Math.max(estimo(cara) + 0.5, tot / 2)) {
    if (azarFijo(e, j, 1) < 0.04 && e.cuantos[j] < DADOS) return { t: "confio" };
    return { t: "desconfio" };
  }
  // sube de a uno: el mismo número si puede, si no el suyo
  const mio = e.obligada ? cara : masRepetida(e, j, false);
  for (const cc of [cara, mio]) { const k = minimaCon(e.apuesta, cc, tot, e.obligada); if (k && k <= estimo(cc) + 1) return { t: "apostar", c: k, cara: cc }; }
  return { t: "desconfio" };
}

function rata(e, j) {
  const tot = e.cuantos.reduce((s, c) => s + c, 0);
  // cuenta a medias: la binomial sin leer a los demás, con ruido y faroles
  const ruido = (k) => (azarFijo(e, j, k) - 0.5) * 0.3;
  if (!e.apuesta) {
    const cara = e.obligada ? e.dados[j][0] : azarFijo(e, j, 2) < 0.2 ? 2 + Math.floor(azarFijo(e, j, 4) * 5) : masRepetida(e, j, true);
    let c = minimaCon(null, cara, tot, e.obligada) || 1;
    while (c + 1 <= tot && chanceCierta(e, j, c + 1, cara, false) >= 0.5) c++;
    return { t: "apostar", c, cara };
  }
  const { c, cara } = e.apuesta;
  const p = chanceCierta(e, j, c, cara, false);
  if (e.cuantos[j] < DADOS && chanceJusta(e, j, c, cara, false) > 0.25 && azarFijo(e, j, 5) < 0.35) return { t: "confio" };
  let mejor = null, pm = -1;
  for (const o of subidas(e.apuesta, tot, e.obligada)) { const q = chanceCierta(e, j, o.c, o.cara, false) + ruido(o.c * 7 + o.cara); if (q > pm) { pm = q; mejor = o; } }
  if (!mejor || 1 - p + ruido(6) > pm) return { t: "desconfio" };
  // salto de farol: una más de lo que conviene
  if (azarFijo(e, j, 8) < 0.2 && esValida(e.apuesta, { c: mejor.c + 1, cara: mejor.cara }, tot, e.obligada)) return { t: "apostar", c: mejor.c + 1, cara: mejor.cara };
  return { t: "apostar", c: mejor.c, cara: mejor.cara };
}

export function decidir(e, j, dif = "rapido") {
  if (dif === "implacable") return relampago(e, j);
  if (dif === "tranquilo") return tranqui(e, j);
  return rata(e, j);
}

export function bot(e, j, ahora, dif = "rapido") {
  if (e.fase !== "apostar" || e.turno !== j || !e.cuantos[j]) return null;
  if (ahora - e.turnoDesde < entre(DEMORA[dif] || DEMORA.rapido, azarFijo(e, j, 9))) return null;
  return decidir(e, j, dif);
}
