// Bots del Desconfío con manos de póker (2026-11-19). Saben lo que sabría una persona en la mesa: sus dados cuando
// tienen el cubilete, lo que se cantó, cuántos dados volvió a tirar cada uno, los dados que pasaron ellos mismos y los
// que se vieron al levantar el cubilete. Nunca miran adentro del cubilete ajeno.
//   Don Tranqui (tranquilo): guarda lo más repetido y tira el resto; cree si la mano «sale seguido» tirando de cero
//     (no lleva la cuenta de quién tiró qué). Miente siempre lo justo.
//   Rata (rapido): guarda pares y piernas; hace la cuenta fina con ruido y sin acordarse de los dados que pasó;
//     a veces miente de más y a veces desconfía de puro olfato.
//   El Relámpago (implacable): cuenta exacta. Elige qué guardar para tener más chance de superar; calcula la chance de
//     que el canto sea cierto (cuántos dados se volvieron a tirar, cuáles había si los conoce, y que el que miente
//     suele cantar lo justo) y, cuando miente, elige la mentira que al siguiente le parece más cierta.
import { DADOS, MANOS, rango, ordenMano, supera, minimaQueSupera } from "./motor.js";

/**
 * Los números de los bots (salieron de simular; ver docs/desconfio/reglas.md): `mentiraDeCero` cuánto miente alguien
 * que tiró de cero; `justo` y `decae` cuánto canta lo justo el que miente; `cantaMenos` cuánto canta menos de lo que
 * tiene; `umbral` debajo de esa chance de verdad, desconfía; `alcance` cuántas mentiras mira El Relámpago.
 */
export const AJUSTE = { mentiraDeCero: 0.02, justo: 0.5, decae: 0.75, cantaMenos: 0.05, ruidoRata: 0.5, umbral: 0.4, alcance: 12 };
const DEMORA = { tranquilo: [1800, 3000], rapido: [700, 1300], implacable: [1100, 2000] };
/** Un número fijo por jugada y jugador (no cambia en cada pulso). */
const azarFijo = (e, j, k = 0) => (((e.seq + 1) * 9301 + j * 49297 + k * 233 + e.rondaN * 7 + e.nTiro * 31) % 233280) / 233280;
const entre = ([a, b], x) => a + (b - a) * x;

// ---------- las cuentas ----------
// DIST[k]: los resultados de tirar k dados, como multiconjuntos con su probabilidad
const DIST = (() => {
  const out = [[{ ds: [], p: 1 }]];
  for (let k = 1; k <= DADOS; k++) {
    const m = new Map();
    for (const { ds, p } of out[k - 1]) for (let c = 1; c <= 6; c++) {
      const n = [...ds, c].sort((a, b) => a - b), key = n.join("");
      const x = m.get(key); if (x) x.p += p / 6; else m.set(key, { ds: n, p: p / 6 });
    }
    out.push([...m.values()]);
  }
  return out;
})();
/** COLA[r]: chance de que 5 dados tirados de cero valgan al menos la mano de lugar r. */
const COLA = (() => {
  const p = Array(MANOS.length).fill(0);
  for (const { ds, p: q } of DIST[5]) p[rango(ds)] += q;
  for (let r = MANOS.length - 2; r >= 0; r--) p[r] += p[r + 1];
  return p;
})();
export const deCero = (r) => (r <= 0 ? 1 : r >= MANOS.length ? 0 : COLA[r]);

/** Chance de llegar al menos a la mano de lugar `r` guardando `guardados` y tirando el resto. */
function chanceCon(guardados, r) {
  const k = DADOS - guardados.length;
  if (r <= 0) return 1;
  if (r >= MANOS.length) return 0;
  let s = 0;
  for (const { ds, p } of DIST[k]) if (rango([...guardados, ...ds]) >= r) s += p;
  return s;
}
const MEMO = new Map();
/**
 * Lo mejor que se puede guardar de `dados` para llegar a `r`: { p, guarda (índices) }. Con `tirar` = cuántos se
 * vuelven a tirar (fijo) o null (cualquier cantidad, sin contar quedarse con todos).
 */
export function mejorGuarda(dados, r, tirar = null) {
  const key = `${[...dados].join("")}|${r}|${tirar}`;
  if (MEMO.has(key)) return MEMO.get(key);
  let mejor = { p: -1, guarda: [] };
  const vistos = new Set();
  for (let m = 0; m < 1 << DADOS; m++) {
    const guarda = [0, 1, 2, 3, 4].filter((i) => m & (1 << i));
    if (tirar === null ? guarda.length === DADOS : DADOS - guarda.length !== tirar) continue;
    const g = guarda.map((i) => dados[i]);
    const kk = [...g].sort().join("");
    if (vistos.has(kk)) continue;
    vistos.add(kk);
    const p = chanceCon(g, r);
    if (p > mejor.p + 1e-12) mejor = { p, guarda };
  }
  if (MEMO.size > 60000) MEMO.clear();
  MEMO.set(key, mejor);
  return mejor;
}

/** Lo que sabe `j` de cómo le llegaron los dados al que cantó: los dados (si los vio) y cuántos volvió a tirar. */
function loQueSe(e, j, memoria = true) {
  const c = e.canto;
  if (c.de0) return { de0: true };
  const o = e.origen || {};
  const conocidos = o.dados && (o.publico || (memoria && o.de === j)) ? o.dados : null;
  const previo = e.cadena.length > 1 ? e.cadena[e.cadena.length - 2].mano : null;
  return { de0: false, tiro: c.tiro, conocidos, previo };
}

/** Chance (para `j`) de que el canto en pie sea cierto. `fino` = usa lo que vio (El Relámpago). */
export function chanceVerdad(e, j, fino = true, memoria = true) {
  const r = rango(e.canto.mano);
  const s = loQueSe(e, j, memoria);
  if (!fino) return deCero(r);
  // de cero nadie está obligado a mentir: una mano que sale seguido casi siempre es cierta
  if (s.de0) { const p = deCero(r); return p / (p + AJUSTE.mentiraDeCero); }
  const base = s.conocidos || s.previo;
  if (!base) return deCero(r);
  if (s.tiro === 0 && s.conocidos) return rango(s.conocidos) >= r ? 1 : 0;
  // Bayes: el que llega a superar canta lo que tiene; el que no llega miente, casi siempre lo justo.
  const rMin = s.previo ? rango(s.previo) + 1 : 0;
  const dist = distribucion(base, s.tiro, rMin);
  let pIgual = 0, pFalla = 0;
  for (const [x, p] of dist) { if (x >= r) pIgual += x === r ? p : p * AJUSTE.cantaMenos; if (x < rMin) pFalla += p; }
  const w = AJUSTE.justo * AJUSTE.decae ** Math.max(0, r - rMin);
  return pIgual + pFalla * w > 0 ? pIgual / (pIgual + pFalla * w) : 0.5;
}

/** Cómo quedan los dados del que recibió `base` y volvió a tirar `tiro` buscando llegar a `rMin`: Map lugar → chance. */
function distribucion(base, tiro, rMin) {
  const key = `d${base.join("")}|${tiro}|${rMin}`;
  if (MEMO.has(key)) return MEMO.get(key);
  const g = tiro === 0 ? [0, 1, 2, 3, 4] : mejorGuarda(base, rMin, tiro).guarda;
  const guardados = g.map((i) => base[i]);
  const m = new Map();
  for (const { ds, p } of DIST[DADOS - guardados.length]) { const x = rango([...guardados, ...ds]); m.set(x, (m.get(x) || 0) + p); }
  MEMO.set(key, m);
  return m;
}

// ---------- qué guardar ----------
function guardaRelampago(e) { return mejorGuarda(e.dados, rango(e.aSuperar) + 1).guarda; }
/** Guarda los grupos repetidos (Rata: pares para arriba; Don Tranqui: solo el más grande). */
function guardaRepetidos(e, soloElMayor) {
  const k = {}; for (const d of e.dados) k[d] = (k[d] || 0) + 1;
  const grupos = Object.entries(k).map(([c, n]) => ({ c: +c, n })).sort((a, b) => b.n - a.n || b.c - a.c);
  const quedan = soloElMayor ? grupos.slice(0, 1).filter((g) => g.n >= 2) : grupos.filter((g) => g.n >= 2);
  let guarda = e.dados.map((d, i) => (quedan.some((g) => g.c === d) ? i : -1)).filter((i) => i >= 0);
  if (guarda.length === DADOS) {
    // un full o una generala que no alcanza: se tira el grupo más bajo
    const bajo = grupos[grupos.length - 1].c;
    guarda = guarda.filter((i) => e.dados[i] !== bajo);
    if (guarda.length === DADOS) guarda = guarda.slice(0, DADOS - 1);
  }
  if (!guarda.length) {
    // nada repetido: Rata guarda el dado más alto
    if (!soloElMayor) guarda = [e.dados.indexOf(Math.max(...e.dados))];
  }
  return guarda;
}

// ---------- cantar ----------
function cantar(e, j, dif) {
  const real = ordenMano(e.dados);
  if (supera(real, e.aSuperar)) return { t: "cantar", mano: real };
  // hay que mentir: lo justo, o (Rata) un poco más
  let r = rango(minimaQueSupera(e.aSuperar));
  if (dif === "rapido" && azarFijo(e, j, 4) < 0.3) r += 1 + Math.floor(azarFijo(e, j, 5) * 5);
  if (dif === "implacable") {
    // entre las mentiras cercanas, la que al que sigue le parece más cierta (con lo que él sabe)
    let resp = null;
    for (let k = 1; k <= e.n && resp === null; k++) { const x = (j + k) % e.n; if (e.enRonda[x] && e.vidas[x] > 0) resp = x; }
    let mejor = r, pm = -1;
    for (let x = r; x < Math.min(MANOS.length, r + AJUSTE.alcance); x++) {
      const canto = { mano: [...MANOS[x]], jugador: j, tiro: e.tiro?.cuantos ?? 0, de0: !e.aSuperar };
      const p = chanceVerdad({ ...e, canto, cadena: [...e.cadena, canto] }, resp ?? j, true);
      if (p > pm) { pm = p; mejor = x; }
    }
    r = mejor;
  }
  return { t: "cantar", mano: [...MANOS[Math.min(r, MANOS.length - 1)]] };
}

// ---------- creer o desconfiar ----------
function responder(e, j, dif) {
  if (!minimaQueSupera(e.canto.mano)) return { t: "desconfio" };
  const r = rango(e.canto.mano);
  if (dif === "tranquilo") {
    // a ojo: si de cero sale una de cada tres veces, le cree
    return { t: deCero(r) >= 0.3 ? "creo" : "desconfio" };
  }
  if (dif === "rapido") {
    // la cuenta fina, pero con ruido y algún arranque de olfato
    const p = chanceVerdad(e, j, true, false) + (azarFijo(e, j, 6) - 0.5) * AJUSTE.ruidoRata;
    if (azarFijo(e, j, 7) < 0.05) return { t: "desconfio" };
    return { t: p >= 0.45 ? "creo" : "desconfio" };
  }
  // El Relámpago: la cuenta fina, sin ruido (sumarle el riesgo de tener que superar el canto no lo mejoró al simular)
  return { t: chanceVerdad(e, j, true) < AJUSTE.umbral ? "desconfio" : "creo" };
}

export function decidir(e, j, dif = "rapido") {
  if (e.fase === "responder") return responder(e, j, dif);
  if (e.fase !== "mano") return null;
  if (!e.tiro) {
    if (!e.aSuperar) return { t: "tirar", guarda: [] };
    if (!supera(ordenMano(e.dados), e.aSuperar)) {
      const guarda = dif === "implacable" ? guardaRelampago(e) : guardaRepetidos(e, dif === "tranquilo");
      return { t: "tirar", guarda };
    }
  }
  return cantar(e, j, dif);
}

export function bot(e, j, ahora, dif = "rapido") {
  if ((e.fase !== "mano" && e.fase !== "responder") || e.turno !== j || !e.vidas[j]) return null;
  if (ahora - e.turnoDesde < entre(DEMORA[dif] || DEMORA.rapido, azarFijo(e, j, 9))) return null;
  return decidir(e, j, dif);
}
