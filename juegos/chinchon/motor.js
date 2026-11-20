// CHINCHÓN (AZAR, etapa 5, 2026-11-19). Motor puro: sin DOM, sin red, sin Date.now(). Reglas en docs/chinchon/reglas.md.
//   - Baraja española de 50: las 48 (con 8 y 9) más 2 comodines. De 2 a 6.
//   - 7 cartas a cada uno, una boca arriba empieza el pozo. En tu turno robás (del mazo o la de arriba del pozo) y tirás
//     una al pozo (no la misma que levantaste del pozo).
//   - Juegos: 3 o 4 del mismo número, o escalera de 3 o más del mismo palo (del 1 al 12, sin dar la vuelta). El comodín
//     reemplaza a cualquier carta, uno por juego.
//   - Cortás en tu turno, después de robar, si tus sueltas (las que no entran en un juego) suman 5 o menos: una carta va
//     boca abajo y bajás las otras 7. Cortar sin sueltas descuenta 10. Chinchón (escalera de 7 del mismo palo, sin
//     comodín) gana la partida en el acto.
//   - Al cortar, cada uno suma sus sueltas (después de acomodar las que pueda en los juegos del que cortó). Las cartas
//     valen su número (sota 10, caballo 11, rey 12) y el comodín suelto 25.
//   - El que pasa los 100 queda afuera. Reenganche: una vez por partida, si quedan dos o más adentro, el que se pasó puede
//     volver con los puntos del que más tiene entre los que siguen. Gana el último que queda.
// El acomodo de las cartas al contar lo hace el motor (la mejor forma posible para cada uno): nadie pierde puntos por
// acomodar mal.

export const juego = { id: "chinchon", nombre: "Chinchón", jugadores: [2, 6] };
export const PALOS = ["espada", "basto", "oro", "copa"];
export const NUMEROS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
export const COMODINES = ["comodin-1", "comodin-2"];
export const MAZO50 = [...PALOS.flatMap((p) => NUMEROS.map((n) => `${n}-${p}`)), ...COMODINES];
export const TOPE = 100, VALOR_COMODIN = 25, MAX_SUELTAS = 5, PREMIO_LIMPIO = -10;
export const idValido = (id) => typeof id === "string" && (/^([1-9]|1[0-2])-(espada|basto|oro|copa)$/.test(id) || COMODINES.includes(id));
export const esComodin = (id) => COMODINES.includes(id);
export const numero = (id) => (esComodin(id) ? 0 : Number(id.split("-")[0]));
export const palo = (id) => (esComodin(id) ? null : id.split("-")[1]);
export const valor = (id) => (esComodin(id) ? VALOR_COMODIN : numero(id));
/** Orden de la mano: por palo y número, los comodines al final. */
export const ordenar = (ids) => [...ids].sort((a, b) => (esComodin(a) - esComodin(b)) || PALOS.indexOf(palo(a)) - PALOS.indexOf(palo(b)) || numero(a) - numero(b) || a.localeCompare(b));

function paso(s) { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return [s, ((t ^ (t >>> 14)) >>> 0) / 4294967296]; }
/** Mezcla con la semilla que vive en el estado (así el motor sigue puro y la partida se puede repetir). */
function mezclar(e, ids) { const a = [...ids]; for (let i = a.length - 1; i > 0; i--) { let r; [e.azar, r] = paso(e.azar); const j = Math.floor(r * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const copia = (e) => JSON.parse(JSON.stringify(e));
const rechazo = (e, motivo, mensaje) => ({ estado: e, eventos: [], rechazo: { motivo, mensaje } });

// ---------- juegos y acomodo ----------
/** ¿Estas cartas forman un juego? Devuelve { tipo: "numero"|"escalera", cartas (en orden) } o null. Un comodín como mucho. */
export function esJuego(cartas) {
  if (!Array.isArray(cartas) || cartas.length < 3) return null;
  const com = cartas.filter(esComodin), nor = cartas.filter((c) => !esComodin(c));
  if (com.length > 1 || nor.length < 2) return null;
  // del mismo número: 3 o 4 (con comodín, hasta 4 en total)
  if (cartas.length <= 4 && nor.every((c) => numero(c) === numero(nor[0])) && new Set(nor.map(palo)).size === nor.length) return { tipo: "numero", cartas: [...nor, ...com] };
  // escalera: mismo palo, números seguidos; el comodín tapa un hueco o va en una punta
  if (!nor.every((c) => palo(c) === palo(nor[0]))) return null;
  const ns = nor.map(numero).sort((a, b) => a - b);
  if (new Set(ns).size !== ns.length) return null;
  const huecos = ns[ns.length - 1] - ns[0] + 1 - ns.length;
  if (huecos > com.length) return null;
  const orden = [...nor].sort((a, b) => numero(a) - numero(b));
  if (!com.length) return { tipo: "escalera", cartas: orden };
  const out = [];
  for (let k = 0; k < orden.length; k++) { if (k && numero(orden[k]) - numero(orden[k - 1]) === 2) out.push(com[0]); out.push(orden[k]); }
  if (out.length < cartas.length) { if (numero(orden[orden.length - 1]) < 12) out.push(com[0]); else if (numero(orden[0]) > 1) out.unshift(com[0]); else return null; }
  return { tipo: "escalera", cartas: out };
}

/** Todos los juegos posibles con las cartas de una mano (como listas de cartas). */
function juegosPosibles(mano) {
  const com = mano.filter(esComodin).slice(0, 2), nor = mano.filter((c) => !esComodin(c));
  const out = [];
  const conCom = (base) => { out.push(base); };
  // del mismo número
  const porNum = {};
  for (const c of nor) (porNum[numero(c)] ||= []).push(c);
  for (const g of Object.values(porNum)) {
    const subs = [];
    const n = g.length;
    for (let m = 1; m < 1 << n; m++) { const s = g.filter((_, i) => m & (1 << i)); subs.push(s); }
    for (const s of subs) {
      if (s.length >= 3) conCom(s);
      if (s.length >= 2 && s.length <= 3) for (const c of com) out.push([...s, c]);
    }
  }
  // escaleras
  const porPalo = {};
  for (const c of nor) (porPalo[palo(c)] ||= new Map()).set(numero(c), c);
  for (const m of Object.values(porPalo)) {
    for (let a = 1; a <= 12; a++) for (let b = a + 2; b <= 12; b++) {
      const faltan = [];
      for (let x = a; x <= b; x++) if (!m.has(x)) faltan.push(x);
      const tiene = [];
      for (let x = a; x <= b; x++) if (m.has(x)) tiene.push(m.get(x));
      if (!faltan.length) out.push(tiene);
      else if (faltan.length === 1 && tiene.length >= 2) for (const c of com) out.push([...tiene, c]);
    }
  }
  // comodín en la punta de una escalera de dos ya está cubierto (a..b con un hueco en la punta)
  return out;
}

/**
 * La mejor forma de acomodar una mano: los juegos que dejan las sueltas más bajas.
 * Devuelve { juegos: [[ids]], sueltas: [ids], puntos } (puntos = suma de las sueltas).
 */
const memo = new Map();   // el acomodo de cada mano (los bots preguntan mucho por las mismas); copia al devolver
export function acomodar(mano) {
  const k = [...mano].sort().join(",");
  let m = memo.get(k);
  if (!m) { if (memo.size > 60000) memo.clear(); m = acomodarSinMemo(mano); memo.set(k, m); }
  return { juegos: m.juegos.map((g) => [...g]), sueltas: [...m.sueltas], puntos: m.puntos };
}
function acomodarSinMemo(mano) {
  const jp = juegosPosibles(mano).map((cs) => ({ cs, m: new Set(cs) }));
  let mejor = { juegos: [], sueltas: [...mano], puntos: mano.reduce((s, c) => s + valor(c), 0) };
  const total = mejor.puntos;
  function buscar(desde, usadas, elegidos, cubierto) {
    const pts = total - cubierto;
    if (pts < mejor.puntos || (pts === mejor.puntos && elegidos.length < mejor.juegos.length)) {
      mejor = { juegos: elegidos.map((x) => esJuego(x.cs).cartas), sueltas: mano.filter((c) => !usadas.has(c)), puntos: pts };
    }
    for (let k = desde; k < jp.length; k++) {
      const j = jp[k];
      if (j.cs.some((c) => usadas.has(c))) continue;
      const u2 = new Set(usadas); j.cs.forEach((c) => u2.add(c));
      buscar(k + 1, u2, [...elegidos, j], cubierto + j.cs.reduce((s, c) => s + valor(c), 0));
    }
  }
  buscar(0, new Set(), [], 0);
  mejor.sueltas = ordenar(mejor.sueltas);
  return mejor;
}

/** Chinchón: las 7 en escalera del mismo palo, sin comodín. */
export function esChinchon(siete) {
  if (siete.length !== 7 || siete.some(esComodin)) return false;
  const j = esJuego(siete);
  return !!j && j.tipo === "escalera";
}

/** ¿Esta carta se puede acomodar en el juego `g` (del que cortó)? Devuelve el juego agrandado o null. */
export function acomodaEn(g, c) {
  if (g.length >= 4 && esJuego(g)?.tipo === "numero") return null;
  const j = esJuego([...g, c]);
  return j ? j.cartas : null;
}

/**
 * Lo que suma alguien que no cortó: su mejor acomodo y después las sueltas que entren en los juegos del que cortó.
 * Prueba también dejar de lado sus propios juegos más chicos si así acomoda más (con 7 cartas alcanza con probar todo).
 */
export function cuentaAjena(mano, juegosCorte) {
  const base = acomodar(mano);
  const pegar = (sueltas, juegos) => {
    const js = juegos.map((g) => [...g]);
    let quedan = [...sueltas], pegadas = [], cambio = true;
    while (cambio) {
      cambio = false;
      // primero las que más valen
      quedan.sort((a, b) => valor(b) - valor(a));
      for (const c of quedan) {
        for (let k = 0; k < js.length; k++) { const nj = acomodaEn(js[k], c); if (nj) { js[k] = nj; pegadas.push({ carta: c, juego: k }); quedan = quedan.filter((x) => x !== c); cambio = true; break; } }
        if (cambio) break;
      }
    }
    return { quedan, pegadas };
  };
  const p = pegar(base.sueltas, juegosCorte);
  return { juegos: base.juegos, sueltas: ordenar(p.quedan), pegadas: p.pegadas, puntos: p.quedan.reduce((s, c) => s + valor(c), 0) };
}

// ---------- la partida ----------
/** Opciones: { jugadores (2 a 6), nombres, semilla, ahora, reparte (asiento), pausaRecuento = 7000, pausaReenganche = 14000, mazo } */
export function nuevaPartida({ jugadores = 2, nombres, semilla, ahora = 0, reparte, pausaRecuento = 7000, pausaReenganche = 14000, mazo, ritmo = 1 } = {}) {
  const n = Math.max(2, Math.min(6, jugadores | 0));
  let azar = (semilla ?? Math.floor(Math.random() * 2 ** 31)) >>> 0;
  let r; [azar, r] = paso(azar);
  const e = {
    n, nombres: (nombres || []).slice(0, n).concat(Array(n).fill("Jugador")).slice(0, n),
    azar, puntos: Array(n).fill(0), fuera: [], reenganches: Array(n).fill(0),
    reparte: Number.isInteger(reparte) ? reparte % n : Math.floor(r * n), mano: 0,
    manos: [], mazo: [], pozo: [], turno: null, fase: "robar", levanto: null, turnoDesde: ahora,
    recuento: null, pausaRecuento, pausaReenganche, ritmo: Math.min(1, Math.max(0.05, Number(ritmo) || 1)), ganador: null, chinchon: null, seq: 0, mazoFijo: mazo || null,
  };
  const ev = [];
  repartir(e, ahora, ev);
  e.eventosIniciales = ev;
  return e;
}

const adentro = (e) => Array.from({ length: e.n }, (_, j) => j).filter((j) => !e.fuera.includes(j));
function siguienteAdentro(e, j) { for (let k = 1; k <= e.n; k++) { const x = (j + k) % e.n; if (!e.fuera.includes(x)) return x; } return j; }

function repartir(e, ahora, ev) {
  e.mano++;
  if (e.mano > 1) e.reparte = siguienteAdentro(e, e.reparte);
  else if (e.fuera.includes(e.reparte)) e.reparte = siguienteAdentro(e, e.reparte);
  const m = e.mazoFijo && e.mano === 1 ? [...e.mazoFijo] : mezclar(e, MAZO50);
  e.manos = Array.from({ length: e.n }, () => []);
  const orden = []; for (let k = 1; k <= e.n; k++) { const j = (e.reparte + k) % e.n; if (!e.fuera.includes(j)) orden.push(j); }
  for (let r = 0; r < 7; r++) for (const j of orden) e.manos[j].push(m.shift());
  e.manos = e.manos.map(ordenar);
  e.pozo = [m.shift()];
  e.mazo = m;
  e.turno = orden[0]; e.fase = "robar"; e.levanto = null; e.turnoDesde = ahora; e.recuento = null;
  e.tomadas = Array.from({ length: e.n }, () => []);   // lo que levantó cada uno del pozo en esta mano (todos lo vieron)
  e.turnos = 0;
  ev.push({ t: "reparto", mano: e.mano, reparte: e.reparte, empieza: e.turno, pozo: e.pozo[0], cartas: e.manos.map((x) => x.length) });
}

/** Si el mazo se acabó, el pozo (menos la de arriba) se mezcla y pasa a ser el mazo. */
function rearmar(e, ev) {
  if (e.mazo.length) return true;
  if (e.pozo.length < 2) return false;
  const arriba = e.pozo.pop();
  e.mazo = mezclar(e, e.pozo);
  e.pozo = [arriba];
  ev.push({ t: "mazo_nuevo", cartas: e.mazo.length });
  return true;
}

/** Puede cortar `j` tirando `carta`: devuelve el acomodo de las otras 7 o null. */
export function corteCon(e, j, carta) {
  const resto = e.manos[j].filter((c) => c !== carta);
  if (resto.length !== 7) return null;
  if (esChinchon(resto)) return { juegos: [ordenar(resto).sort((a, b) => numero(a) - numero(b))], sueltas: [], puntos: 0, chinchon: true };
  const a = acomodar(resto);
  return a.puntos <= MAX_SUELTAS ? { ...a, chinchon: false } : null;
}
/** Con qué cartas puede cortar `j` ahora (para la pantalla y los bots). */
export function cortesPosibles(e, j) {
  if (e.fase !== "tirar" || e.turno !== j) return [];
  return [...new Set(e.manos[j])].filter((c) => c !== e.levanto || e.manos[j].filter((x) => x === c).length > 1).map((c) => ({ carta: c, corte: corteCon(e, j, c) })).filter((x) => x.corte);
}

/** Acciones: { t: "robar", de: "mazo"|"pozo" } · { t: "tirar", carta } · { t: "cortar", carta } · { t: "reenganche", si } */
export function aplicar(e0, j, a, ahora = 0) {
  if (!a || typeof a !== "object" || !Number.isInteger(j) || j < 0 || j >= e0.n) throw new Error("acción mal formada");
  if (e0.fase === "fin") return rechazo(e0, "fin", "La partida terminó.");
  const e = copia(e0), ev = [];

  if (a.t === "reenganche") {
    const r = e.recuento;
    if (e.fase !== "recuento" || !r || !r.puedeReenganche.includes(j) || r.decidio[j] !== undefined) return rechazo(e0, "no_podes", "Ahora no hay reenganche.");
    r.decidio[j] = a.si === true;
    ev.push({ t: a.si === true ? "reengancha" : "no_reengancha", jugador: j });
    e.seq++;
    return { estado: e, eventos: ev };
  }
  if (e.fase === "recuento") return rechazo(e0, "recuento", "Esperá, se están contando los puntos.");
  if (e.turno !== j) return rechazo(e0, "no_es_tu_turno", "No es tu turno.");

  if (a.t === "robar") {
    if (e.fase !== "robar") return rechazo(e0, "ya_robaste", "Ya robaste: ahora tirá una carta o cortá.");
    if (a.de === "pozo") {
      if (!e.pozo.length) return rechazo(e0, "pozo_vacio", "El pozo está vacío.");
      const c = e.pozo.pop();
      e.manos[j].push(c); e.levanto = c; e.tomadas[j].push(c);
      ev.push({ t: "robo", jugador: j, de: "pozo", carta: c });
    } else if (a.de === "mazo") {
      if (!rearmar(e, ev)) { // no queda nada para robar: la mano se anula y se reparte de nuevo
        ev.push({ t: "mano_nula" });
        repartir(e, ahora, ev);
        e.seq++;
        return { estado: e, eventos: ev };
      }
      const c = e.mazo.shift();
      e.manos[j].push(c); e.levanto = null;
      ev.push({ t: "robo", jugador: j, de: "mazo", mazo: e.mazo.length });
    } else throw new Error("¿de dónde robás?");
    e.fase = "tirar"; e.turnoDesde = ahora;
    e.seq++;
    return { estado: e, eventos: ev };
  }

  if (a.t === "tirar" || a.t === "cortar") {
    if (!idValido(a.carta)) throw new Error("carta mal formada");
    if (e.fase !== "tirar") return rechazo(e0, "roba_primero", "Primero robá: del mazo o del pozo.");
    if (!e.manos[j].includes(a.carta)) return rechazo(e0, "no_esta", "Esa carta no la tenés.");
    if (a.carta === e.levanto) return rechazo(e0, "la_del_pozo", "No podés tirar la misma que levantaste del pozo.");
    if (a.t === "tirar") {
      e.manos[j] = e.manos[j].filter((c) => c !== a.carta);
      e.pozo.push(a.carta);
      ev.push({ t: "tiro", jugador: j, carta: a.carta });
      e.turno = siguienteAdentro(e, j); e.fase = "robar"; e.levanto = null; e.turnoDesde = ahora; e.turnos++;
      e.seq++;
      return { estado: e, eventos: ev };
    }
    const corte = corteCon(e, j, a.carta);
    if (!corte) return rechazo(e0, "no_cortas", `Para cortar, tus sueltas tienen que sumar ${MAX_SUELTAS} o menos.`);
    cortar(e, j, a.carta, corte, ahora, ev);
    e.seq++;
    return { estado: e, eventos: ev };
  }
  throw new Error("acción desconocida");
}

function cortar(e, j, carta, corte, ahora, ev) {
  e.manos[j] = e.manos[j].filter((c) => c !== carta);
  const filas = [];
  for (const k of adentro(e)) {
    if (k === j) {
      const pts = corte.chinchon ? 0 : corte.sueltas.length ? corte.puntos : PREMIO_LIMPIO;
      filas.push({ jugador: k, juegos: corte.juegos, sueltas: corte.sueltas, pegadas: [], puntos: pts, corto: true });
    } else {
      const c = cuentaAjena(e.manos[k], corte.juegos);
      filas.push({ jugador: k, juegos: c.juegos, sueltas: c.sueltas, pegadas: c.pegadas, puntos: c.puntos, corto: false });
    }
  }
  ev.push({ t: "corte", jugador: j, carta, chinchon: corte.chinchon, limpio: !corte.chinchon && !corte.sueltas.length, filas: copia(filas) });
  if (corte.chinchon) {
    e.chinchon = j;
    terminar(e, j, ev);
    e.recuento = { cortó: j, carta, filas, chinchon: true, antes: [...e.puntos], pasados: [], puedeReenganche: [], decidio: {}, hasta: ahora, final: true };
    return;
  }
  const antes = [...e.puntos];
  for (const f of filas) e.puntos[f.jugador] += f.puntos;
  const pasados = filas.map((f) => f.jugador).filter((k) => e.puntos[k] > TOPE);
  const siguen = adentro(e).filter((k) => !pasados.includes(k));
  // reenganche: una vez por partida y solo si quedan dos o más adentro
  const puedeReenganche = siguen.length >= 2 ? pasados.filter((k) => e.reenganches[k] < 1) : [];
  e.fase = "recuento"; e.turno = null; e.levanto = null;
  e.recuento = { cortó: j, carta, filas, chinchon: false, antes, pasados, puedeReenganche, decidio: {}, hasta: ahora + e.pausaRecuento, tope: ahora + Math.max(e.pausaRecuento, puedeReenganche.length ? e.pausaReenganche : 0) };
}

function terminar(e, ganador, ev) {
  e.fase = "fin"; e.turno = null; e.ganador = ganador;
  ev.push({ t: "fin", ganador, chinchon: e.chinchon === ganador, puntos: [...e.puntos], fuera: [...e.fuera] });
}

/** Cierra el recuento: los que se pasaron quedan afuera (o se reenganchan) y se reparte de nuevo, o termina la partida. */
export function reloj(e0, ahora) {
  if (e0.fase !== "recuento") return { estado: e0, eventos: [] };
  const r = e0.recuento;
  const faltan = r.puedeReenganche.filter((k) => r.decidio[k] === undefined);
  if (ahora < r.hasta || (faltan.length && ahora < r.tope)) return { estado: e0, eventos: [] };
  const e = copia(e0), ev = [];
  const rr = e.recuento;
  const siguen = adentro(e).filter((k) => !rr.pasados.includes(k));
  const vuelven = rr.pasados.filter((k) => rr.decidio[k] === true && rr.puedeReenganche.includes(k));
  const conQue = siguen.length ? Math.max(...siguen.map((k) => e.puntos[k])) : 0;
  for (const k of rr.pasados) {
    if (vuelven.includes(k)) { e.puntos[k] = conQue; e.reenganches[k]++; ev.push({ t: "vuelve", jugador: k, puntos: conQue }); }
    else { e.fuera.push(k); ev.push({ t: "afuera", jugador: k, puntos: e.puntos[k] }); }
  }
  const quedan = adentro(e);
  if (quedan.length <= 1) {
    // si se pasaron todos a la vez, gana el que menos tiene
    const ganador = quedan.length ? quedan[0] : rr.pasados.reduce((m, k) => (e.puntos[k] < e.puntos[m] ? k : m), rr.pasados[0]);
    if (!quedan.length) e.fuera = e.fuera.filter((k) => k !== ganador);
    terminar(e, ganador, ev);
    e.seq++;
    return { estado: e, eventos: ev };
  }
  repartir(e, ahora, ev);
  e.seq++;
  return { estado: e, eventos: ev };
}

/** Lo que ve el jugador `yo`: su mano; de los demás, cuántas tienen; el pozo (la de arriba y cuántas), el mazo (cuántas). */
export function vista(e, yo) {
  const r = e.recuento;
  return {
    juego: "chinchon", n: e.n, yo, nombres: [...e.nombres], fase: e.fase, turno: e.turno, turnoDesde: e.turnoDesde,
    mano: [...(e.manos[yo] || [])], enMano: e.manos.map((m) => m.length),
    pozo: e.pozo.length ? e.pozo[e.pozo.length - 1] : null, enPozo: e.pozo.length, enMazo: e.mazo.length,
    levanto: e.turno === yo ? e.levanto : null,
    puntos: [...e.puntos], fuera: [...e.fuera], reenganches: [...e.reenganches], reparte: e.reparte, nroMano: e.mano,
    recuento: r ? { corto: r.cortó, carta: r.carta, filas: copia(r.filas), chinchon: r.chinchon, antes: [...r.antes], pasados: [...r.pasados], puedeReenganche: [...r.puedeReenganche], decidio: { ...r.decidio }, hasta: r.hasta, tope: r.tope ?? r.hasta } : null,
    // con qué cartas podés cortar ahora (la pantalla ilumina el botón)
    cortes: cortesPosibles(e, yo).map((x) => ({ carta: x.carta, puntos: x.corte.chinchon ? 0 : x.corte.puntos, chinchon: x.corte.chinchon })),
    acomodo: e.manos[yo] && e.manos[yo].length ? acomodar(e.manos[yo]) : null,
    ganador: e.ganador, chinchon: e.chinchon,
    ganadores: e.fase === "fin" && e.ganador !== null ? [e.ganador] : [],
    seq: e.seq,
  };
}
