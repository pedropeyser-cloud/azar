// DESCONFÍO de AZAR con manos de póker (2026-11-19, Pedro: «pasa a manos de póker»). Motor puro: sin DOM, sin red, sin
// Date.now(). Reglas completas en docs/desconfio/reglas.md. En corto:
//   - Un solo cubilete con 5 dados que pasa de mano en mano. El que lo tiene tira (tapado), mira y canta una mano:
//     la que tiene o una mentira. Cada canto tiene que superar al anterior.
//   - El siguiente le cree (recibe el cubilete, ve los dados, puede guardar los que quiera y volver a tirar los demás
//     una vez, y tiene que superar el canto) o canta «¡Desconfío!» y se levanta el cubilete.
//   - Verdad = la mano que hay vale lo mismo o más que la cantada. Desconfió de una verdad: pierde una vida y tiene que
//     superar el canto con esos dados. Era mentira: pierde una vida el que mintió, queda afuera de la ronda y el que
//     desconfió tira de cero.
//   - La ronda termina cuando queda uno solo en ella: gana un punto y abre la siguiente. 3 vidas para toda la partida;
//     gana el último que tiene vidas. Sin escalera; el 1 es el más bajo y el 6 el más alto.

export const juego = { id: "desconfio", nombre: "Desconfío", jugadores: [2, 6] };
export const DADOS = 5;
export const VIDAS = 3;
export const CARAS = [1, 2, 3, 4, 5, 6];

// ---------- las manos ----------
export const CATEGORIAS = ["suelto", "par", "par doble", "pierna", "full", "póker", "generala"];

/** Los dados en el orden en que se dice la mano: primero lo repetido (más veces y más alto), después lo que sobra. */
export function ordenMano(ds) {
  const k = {}; for (const d of ds) k[d] = (k[d] || 0) + 1;
  return [...ds].sort((a, b) => k[b] - k[a] || b - a);
}
/** 0 suelto · 1 par · 2 par doble · 3 pierna · 4 full · 5 póker · 6 generala. */
export function categoria(ds) {
  const k = {}; for (const d of ds) k[d] = (k[d] || 0) + 1;
  const v = Object.values(k).sort((a, b) => b - a);
  if (v[0] === 5) return 6;
  if (v[0] === 4) return 5;
  if (v[0] === 3) return v[1] === 2 ? 4 : 3;
  if (v[0] === 2) return v[1] === 2 ? 2 : 1;
  return 0;
}
const clave = (ds) => [...ds].sort((a, b) => a - b).join("");

// las 252 manos posibles, de la más baja a la más alta
export const MANOS = (() => {
  const out = [];
  for (let a = 1; a <= 6; a++) for (let b = a; b <= 6; b++) for (let c = b; c <= 6; c++) for (let d = c; d <= 6; d++) for (let e = d; e <= 6; e++) out.push(ordenMano([a, b, c, d, e]));
  const peso = (m) => categoria(m) * 1e6 + m.reduce((s, x) => s * 7 + x, 0);
  return out.sort((x, y) => peso(x) - peso(y));
})();
const RANGO = new Map(MANOS.map((m, i) => [clave(m), i]));
/** Lugar de la mano entre las 252 (0 = suelto de 5 con 4321, 251 = generala de 6). */
export const rango = (ds) => RANGO.get(clave(ds)) ?? -1;
export const MAXIMA = MANOS[MANOS.length - 1];

/** «póker de 2 con 5», «full de 3 con 2», «pierna de 4 con 32», «par doble de 5 y 3 con 2», «par de 6 con 543». */
export function nombreMano(ds) {
  const m = ordenMano(ds), c = categoria(m), resto = (desde) => m.slice(desde).join("");
  switch (c) {
    case 6: return `generala de ${m[0]}`;
    case 5: return `póker de ${m[0]} con ${m[4]}`;
    case 4: return `full de ${m[0]} con ${m[3]}`;
    case 3: return `pierna de ${m[0]} con ${resto(3)}`;
    case 2: return `par doble de ${m[0]} y ${m[2]} con ${m[4]}`;
    case 1: return `par de ${m[0]} con ${resto(2)}`;
    default: return `suelto de ${m[0]} con ${resto(1)}`;
  }
}
export const manoValida = (m) => Array.isArray(m) && m.length === DADOS && m.every((d) => CARAS.includes(d));
/** ¿`mano` supera a `prev`? (prev null = cualquiera vale). */
export const supera = (mano, prev) => !prev || rango(mano) > rango(prev);
/** La mano más chica que supera a `prev` (o null si ya es la generala de 6). */
export function minimaQueSupera(prev) { const r = prev ? rango(prev) + 1 : 0; return MANOS[r] ? [...MANOS[r]] : null; }
/** ¿Lo que hay en el cubilete hace verdad el canto? (vale lo mismo o más) */
export const esVerdad = (dados, canto) => rango(dados) >= rango(canto);

// ---------- partida ----------
function rng(semilla) {
  let s = semilla >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const copia = (e) => JSON.parse(JSON.stringify(e));
const rechazo = (e, motivo, mensaje) => ({ estado: e, eventos: [], rechazo: { motivo, mensaje } });

const conVidas = (e) => e.vidas.map((v, j) => (v > 0 ? j : -1)).filter((j) => j >= 0);
const enLaRonda = (e) => e.enRonda.map((x, j) => (x && e.vidas[j] > 0 ? j : -1)).filter((j) => j >= 0);
/** El siguiente (a la derecha) que sigue en la ronda. */
function siguiente(e, j) { for (let k = 1; k <= e.n; k++) { const x = (j + k) % e.n; if (e.enRonda[x] && e.vidas[x] > 0) return x; } return null; }

/** Tira los dados que no se guardan (o usa los de `e.tiradas`, pruebas). */
function tirarDados(e, guarda) {
  const fijos = e.tiradas?.[e.nTiro];
  const r = rng((e.semilla + (e.nTiro + 1) * 7919) >>> 0);
  let f = 0;
  e.dados = e.dados.map((d, i) => (guarda.includes(i) ? d : fijos ? fijos[f++] ?? 1 : 1 + Math.floor(r() * 6)));
  e.nTiro++;
}

/** Quién tiene el cubilete y cómo le llegó: `aSuperar` null = de cero (tiene que tirar los 5). */
function darCubilete(e, j, aSuperar, ahora, origen) {
  e.fase = "mano"; e.turno = j; e.turnoDesde = ahora;
  e.aSuperar = aSuperar ? [...aSuperar] : null;
  e.tiro = null;                 // { cuantos } cuando ya tiró en este turno (una sola vez)
  e.origen = origen;             // { tipo: "cero" } | { tipo: "creyo"|"verdad", de, dados (los que recibió), publico }
  if (!aSuperar) e.dados = [0, 0, 0, 0, 0];
}

/** Opciones: { jugadores (2 a 6), nombres, semilla, ahora, abre, pausaRevelar = 4200, vidas = 3, tiradas (pruebas) } */
export function nuevaPartida({ jugadores = 2, nombres, semilla, ahora = 0, abre, pausaRevelar = 4200, vidas = VIDAS, tiradas } = {}) {
  const n = Math.max(2, Math.min(6, jugadores | 0));
  const sem = (semilla ?? Math.floor(Math.random() * 2 ** 31)) >>> 0;
  const v = Math.max(1, Math.min(VIDAS, vidas | 0));
  const e = {
    n, nombres: (nombres || []).slice(0, n).concat(Array(n).fill("Jugador")).slice(0, n),
    vidas: Array(n).fill(v), puntos: Array(n).fill(0), enRonda: Array(n).fill(true),
    semilla: sem, nTiro: 0, tiradas: tiradas || null, rondaN: 1,
    dados: [0, 0, 0, 0, 0], canto: null, cadena: [], revelar: null, pausaRevelar,
    fuera: [], ganador: null, seq: 0,
  };
  darCubilete(e, Number.isInteger(abre) ? abre % n : Math.floor(rng(sem ^ 0x9e3779b9)() * n), null, ahora, { tipo: "cero" });
  e.eventosIniciales = [{ t: "ronda", abre: e.turno, ronda: 1 }];
  return e;
}

/**
 * Acciones:
 *   el que tiene el cubilete: { t: "tirar", guarda: [índices] } (una vez por turno; de cero se tiran los 5)
 *                             { t: "cantar", mano: [5 dados] } (tiene que superar el canto anterior)
 *   el que sigue:             { t: "creo" } · { t: "desconfio" }
 */
export function aplicar(e0, j, a, ahora = 0) {
  if (!a || typeof a !== "object" || !Number.isInteger(j) || j < 0 || j >= e0.n) throw new Error("acción mal formada");
  if (e0.fase === "fin") return rechazo(e0, "fin", "La partida terminó.");
  if (e0.fase === "revelar") return rechazo(e0, "revelando", "Esperá, se está levantando el cubilete.");
  if (e0.turno !== j) return rechazo(e0, "no_es_tu_turno", "No es tu turno.");
  const e = copia(e0), ev = [];

  if (a.t === "tirar") {
    if (e.fase !== "mano") return rechazo(e0, "fase", "Ahora no se tira.");
    if (e.tiro) return rechazo(e0, "ya_tiro", "Ya tiraste en este turno: cantá.");
    const guarda = e.aSuperar ? [...new Set((Array.isArray(a.guarda) ? a.guarda : []).filter((i) => Number.isInteger(i) && i >= 0 && i < DADOS))] : [];
    if (guarda.length === DADOS) return rechazo(e0, "nada", "Elegí al menos un dado para volver a tirar.");
    tirarDados(e, guarda);
    e.tiro = { cuantos: DADOS - guarda.length };
    e.turnoDesde = ahora;          // los bots piensan el canto después de mirar
    ev.push({ t: "tiro", jugador: j, cuantos: e.tiro.cuantos });
    e.seq++;
    return { estado: e, eventos: ev };
  }

  if (a.t === "cantar") {
    if (e.fase !== "mano") return rechazo(e0, "fase", "Ahora no se canta.");
    if (!e.aSuperar && !e.tiro) return rechazo(e0, "sin_tirar", "Primero tirá los dados.");
    if (!manoValida(a.mano)) return rechazo(e0, "mano", "Mano mal armada.");
    const mano = ordenMano(a.mano);
    if (!supera(mano, e.aSuperar)) return rechazo(e0, "no_supera", `Tenés que superar «${nombreMano(e.aSuperar)}».`);
    const sig = siguiente(e, j);
    e.canto = { mano, jugador: j, tiro: e.tiro?.cuantos ?? 0, de0: !e.aSuperar };
    e.cadena.push({ ...e.canto });
    ev.push({ t: "canto", jugador: j, mano, nombre: nombreMano(mano), tiro: e.canto.tiro });
    e.fase = "responder"; e.turno = sig; e.turnoDesde = ahora;
    e.seq++;
    return { estado: e, eventos: ev };
  }

  if (a.t === "creo" || a.t === "desconfio") {
    if (e.fase !== "responder" || !e.canto) return rechazo(e0, "fase", "Todavía no cantó nadie.");
    const { mano, jugador: de } = e.canto;
    if (a.t === "creo") {
      if (!minimaQueSupera(mano)) return rechazo(e0, "maxima", "No hay mano más alta: tenés que desconfiar.");
      ev.push({ t: "creo", jugador: j, de });
      darCubilete(e, j, mano, ahora, { tipo: "creyo", de, dados: [...e.dados], publico: false });
      e.seq++;
      return { estado: e, eventos: ev };
    }
    const verdad = esVerdad(e.dados, mano);
    const pierde = verdad ? j : de;
    e.revelar = { quien: j, de, mano, dados: [...e.dados], nombreHay: nombreMano(e.dados), verdad, pierde, hasta: ahora + e.pausaRevelar };
    e.fase = "revelar"; e.turno = null;
    ev.push({ t: "desconfio", jugador: j, de, mano, dados: [...e.dados], verdad, pierde });
    e.seq++;
    return { estado: e, eventos: ev };
  }
  throw new Error("acción desconocida");
}

/** Cierra la vuelta del «¡Desconfío!»: saca la vida, ve si terminó la ronda o la partida y da el cubilete. */
export function reloj(e0, ahora) {
  if (e0.fase !== "revelar" || ahora < e0.revelar.hasta) return { estado: e0, eventos: [] };
  const e = copia(e0), ev = [];
  const { quien, de, verdad, pierde, mano, dados } = e.revelar;
  e.vidas[pierde]--;
  ev.push({ t: "pierde_vida", jugador: pierde, quedan: e.vidas[pierde] });
  if (e.vidas[pierde] === 0) { e.enRonda[pierde] = false; e.fuera.push(pierde); ev.push({ t: "sale", jugador: pierde }); }
  if (!verdad) { e.enRonda[de] = false; ev.push({ t: "afuera_ronda", jugador: de }); }
  e.revelar = null;

  const quedan = enLaRonda(e);
  if (quedan.length <= 1) {
    const g = quedan[0] ?? quien;
    e.puntos[g]++;
    ev.push({ t: "gana_ronda", jugador: g, puntos: e.puntos[g], ronda: e.rondaN });
    const vivos = conVidas(e);
    if (vivos.length <= 1) {
      e.fase = "fin"; e.ganador = vivos[0] ?? g; e.turno = null; e.canto = null;
      const orden = ordenFinal(e);
      ev.push({ t: "fin", ganador: e.ganador, orden });
      e.seq++;
      return { estado: e, eventos: ev };
    }
    e.rondaN++;
    e.enRonda = e.vidas.map((v) => v > 0);
    e.canto = null; e.cadena = [];
    darCubilete(e, g, null, ahora, { tipo: "cero" });
    ev.push({ t: "ronda", abre: g, ronda: e.rondaN });
    e.seq++;
    return { estado: e, eventos: ev };
  }

  if (!verdad) {
    // acertó: tira de cero y la ronda sigue
    e.canto = null;
    darCubilete(e, quien, null, ahora, { tipo: "cero" });
  } else {
    // era verdad: el que desconfió (o el siguiente, si se quedó sin vidas) tiene que superar el canto con esos dados
    // (a la generala de 6 no la supera nada: en ese caso tira de cero)
    const recibe = e.vidas[quien] > 0 ? quien : siguiente(e, quien);
    if (!minimaQueSupera(mano)) { e.canto = null; darCubilete(e, recibe, null, ahora, { tipo: "cero" }); }
    else { darCubilete(e, recibe, mano, ahora, { tipo: "verdad", de, dados: [...dados], publico: true }); e.dados = [...dados]; }
  }
  ev.push({ t: "cubilete", jugador: e.turno, aSuperar: e.aSuperar });
  e.seq++;
  return { estado: e, eventos: ev };
}

/** Tabla final: el ganador y después los que salieron, por puntos (y a igualdad, el que salió más tarde). */
function ordenFinal(e) {
  const salida = (j) => e.fuera.indexOf(j);
  return [e.ganador, ...e.fuera.filter((j) => j !== e.ganador).sort((a, b) => e.puntos[b] - e.puntos[a] || salida(b) - salida(a))];
}

/** Lo que ve `yo`: los dados solo si tiene el cubilete (o al levantarlo, todos). */
export function vista(e, yo) {
  const mio = e.fase === "mano" && e.turno === yo;
  const veo = mio && (e.tiro || e.aSuperar);
  return {
    juego: "desconfio", n: e.n, yo, nombres: [...e.nombres], fase: e.fase, turno: e.turno, turnoDesde: e.turnoDesde,
    ronda: e.rondaN, vidas: [...e.vidas], puntos: [...e.puntos], enRonda: [...e.enRonda],
    mios: veo ? [...e.dados] : [], aSuperar: e.aSuperar ? [...e.aSuperar] : null, tiro: e.tiro ? { ...e.tiro } : null,
    llego: e.fase === "mano" ? (e.origen?.tipo || "cero") : null,
    canto: e.canto ? { ...e.canto, mano: [...e.canto.mano] } : null, cadena: e.cadena.map((x) => ({ ...x, mano: [...x.mano] })),
    revelar: e.revelar ? copia(e.revelar) : null, fuera: [...e.fuera], ganador: e.ganador,
    ganadores: e.fase === "fin" ? [e.ganador] : [],
    orden: e.fase === "fin" ? ordenFinal(e) : [],
    puedoTirar: mio && !e.tiro, puedoCantar: mio && (!!e.tiro || !!e.aSuperar),
    puedoResponder: e.fase === "responder" && e.turno === yo, puedoCreer: e.fase === "responder" && e.turno === yo && !!e.canto && !!minimaQueSupera(e.canto.mano),
    seq: e.seq,
  };
}
