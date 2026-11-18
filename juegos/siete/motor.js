// SIETE Y MEDIO con porotos (AZAR, etapa 5, 2026-11-18). Motor puro: sin DOM, sin red, sin Date.now().
// Reglas (docs/siete/reglas.md):
//   - Baraja española de 40 (sin 8 ni 9). Del 1 al 7 valen lo que dicen; sota, caballo y rey, medio punto.
//   - De 2 a 6. Cada uno arranca con 20 porotos. La banca rota cada mano hacia la derecha.
//   - Reparto: una carta tapada para cada uno (solo la ve su dueño). Mirándola, cada jugador apuesta de 1 a 5 porotos.
//   - Por turno, desde el de la derecha de la banca: «Carta» (boca arriba) o «Me planto». El que pasa de siete y medio
//     se pasa: muestra su tapada y le paga a la banca en el acto. Con siete y medio justo se planta solo.
//   - Al final juega la banca, igual. Si se pasa, les paga a todos los que siguen en pie.
//   - Si no, cada uno contra la banca: el que tiene más le cobra; empate o menos, paga. Gana la banca los empates.
//   - Siete y medio de mano (un siete y una figura, las dos primeras cartas) cobra doble.
//   - La banca paga con lo que tiene: si no le alcanza, paga en orden hasta donde llega.
//   - La partida termina al cerrar una mano con alguien sin porotos: gana el que más porotos tiene (si empatan arriba,
//     ganan todos esos); perdió el que quedó en 0.

export const juego = { id: "siete", nombre: "Siete y medio", jugadores: [2, 6] };
export const NUMEROS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
export const PALOS = ["espada", "basto", "oro", "copa"];
export const MAZO40 = PALOS.flatMap((p) => NUMEROS.map((n) => `${n}-${p}`));
export const POROTOS = 20, TOPE_APUESTA = 5, SIETE_Y_MEDIO = 7.5;
export const idValido = (id) => typeof id === "string" && /^([1-7]|1[0-2])-(espada|basto|oro|copa)$/.test(id);
export const numero = (id) => Number(id.split("-")[0]);
export const valor = (id) => { const n = numero(id); return n >= 10 ? 0.5 : n; };
export const total = (cartas) => cartas.reduce((s, c) => s + valor(c), 0);
export const deMano = (cartas) => cartas.length === 2 && total(cartas) === SIETE_Y_MEDIO;
/** 7.5 → "7½", 0.5 → "½", 3 → "3". */
export const mostrar = (x) => { const e = Math.floor(x); return x % 1 ? (e ? `${e}½` : "½") : String(x); };

function rng(semilla) {
  let s = (semilla ?? Math.floor(Math.random() * 2 ** 31)) >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function mezclar(ids, r) { const a = [...ids]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const copia = (e) => JSON.parse(JSON.stringify(e));
const rechazo = (e, motivo, mensaje) => ({ estado: e, eventos: [], rechazo: { motivo, mensaje } });

/** Opciones: { jugadores (2 a 6), nombres, semilla, ahora, porotos = 20, banca (asiento), pausaResultado = 5500, mazos } */
export function nuevaPartida({ jugadores = 2, nombres, semilla, ahora = 0, porotos = POROTOS, banca, pausaResultado = 5500, mazos } = {}) {
  const n = Math.max(2, Math.min(6, jugadores | 0));
  const r = rng(semilla);
  const e = {
    n, nombres: (nombres || []).slice(0, n).concat(Array(n).fill("Jugador")).slice(0, n),
    porotos: Array(n).fill(porotos), banca: Number.isInteger(banca) ? banca % n : Math.floor(r() * n),
    manoN: 0, fase: "apuesta", faseDesde: ahora, turno: null, turnoDesde: ahora,
    mazo: [], cartas: [], apuesta: [], plantado: [], paso: [], pagado: [], resultado: null, resultadoHasta: null,
    pausaResultado, ganador: null, ganadores: [], perdedores: [], historial: [], ultimo: null, seq: 0,
    semillaMazo: Math.floor(r() * 2 ** 31), mazos: mazos || null,
  };
  const ev = repartir(e, ahora);
  e.eventosIniciales = ev;
  return e;
}

const activos = (e) => e.porotos.map((p, j) => (p > 0 ? j : -1)).filter((j) => j >= 0);
/** El siguiente con porotos después de j (en la ronda). */
function siguiente(e, j) { for (let k = 1; k <= e.n; k++) { const x = (j + k) % e.n; if (e.porotos[x] > 0) return x; } return j; }

function repartir(e, ahora) {
  e.manoN += 1;
  const r = rng(e.semillaMazo + e.manoN * 7919);
  e.mazo = e.mazos?.[e.manoN - 1] ? [...e.mazos[e.manoN - 1]] : mezclar(MAZO40, r);
  e.cartas = Array.from({ length: e.n }, () => []);
  e.apuesta = Array(e.n).fill(null);
  e.plantado = Array(e.n).fill(false);
  e.paso = Array(e.n).fill(false);
  e.pagado = Array(e.n).fill(0);   // lo que pagó a la banca el que se pasó
  e.resultado = null; e.resultadoHasta = null;
  for (const j of ordenDesde(e, e.banca)) e.cartas[j].push(e.mazo.shift());
  e.fase = "apuesta"; e.faseDesde = ahora; e.turno = null; e.turnoDesde = ahora;
  e.seq++;
  return [{ t: "reparto", mano: e.manoN, banca: e.banca }];
}
/** Los que juegan esta mano, empezando por el de la derecha de `desde`. */
function ordenDesde(e, desde) { const out = []; for (let k = 1; k <= e.n; k++) { const x = (desde + k) % e.n; if (e.porotos[x] > 0) out.push(x); } return out; }
const jugadoresMano = (e) => ordenDesde(e, e.banca).filter((j) => j !== e.banca);

function proximoTurno(e, desde, ahora, ev) {
  const orden = jugadoresMano(e);
  const i = desde === null ? -1 : orden.indexOf(desde);
  const prox = orden.slice(i + 1).find((j) => !e.plantado[j] && !e.paso[j]);
  if (prox !== undefined) { e.turno = prox; e.turnoDesde = ahora; e.fase = "turnos"; return; }
  // terminaron los jugadores: si todos se pasaron, la banca no juega
  if (orden.every((j) => e.paso[j])) { cerrarMano(e, ahora, ev); return; }
  e.fase = "banca"; e.turno = e.banca; e.turnoDesde = ahora;
  ev.push({ t: "banca", jugador: e.banca });
}

function pagar(e, de, a, cuanto) { const x = Math.min(cuanto, e.porotos[de]); e.porotos[de] -= x; e.porotos[a] += x; return x; }

function cerrarMano(e, ahora, ev) {
  const b = e.banca, tb = total(e.cartas[b]), bancaPaso = tb > SIETE_Y_MEDIO;
  const filas = [];
  for (const j of jugadoresMano(e)) {
    const tj = total(e.cartas[j]), ap = e.apuesta[j] || 0, doble = deMano(e.cartas[j]);
    if (e.paso[j]) { filas.push({ jugador: j, total: tj, resultado: "paso", porotos: -e.pagado[j] }); continue; }
    const gana = bancaPaso || tj > tb;
    if (gana) { const x = pagar(e, b, j, doble ? ap * 2 : ap); filas.push({ jugador: j, total: tj, resultado: doble ? "doble" : "gana", porotos: x }); }
    else { const x = pagar(e, j, b, ap); filas.push({ jugador: j, total: tj, resultado: "pierde", porotos: -x }); }
  }
  const neto = filas.reduce((s, f) => s - f.porotos, 0);
  e.resultado = { banca: b, totalBanca: tb, bancaPaso, filas, netoBanca: neto, mano: e.manoN };
  e.historial.push({ mano: e.manoN, banca: b, netoBanca: neto });
  e.fase = "resultado"; e.turno = null; e.resultadoHasta = ahora + e.pausaResultado; e.faseDesde = ahora;
  e.seq++;
  ev.push({ t: "resultado", resultado: e.resultado });
}

/** Acciones: { t: "apostar", n: 1..5 } · { t: "carta" } · { t: "plantarse" } */
export function aplicar(e0, j, a, ahora = 0) {
  if (!a || typeof a !== "object" || !Number.isInteger(j) || j < 0 || j >= e0.n) throw new Error("acción mal formada");
  if (e0.fase === "fin") return rechazo(e0, "fin", "La partida terminó.");
  const e = copia(e0), ev = [];
  if (a.t === "apostar") {
    if (!Number.isInteger(a.n)) throw new Error("apuesta mal formada");
    if (e.fase !== "apuesta") return rechazo(e0, "no_apuesta", "Ya no es momento de apostar.");
    if (j === e.banca) return rechazo(e0, "sos_banca", "La banca no apuesta.");
    if (e.porotos[j] <= 0) return rechazo(e0, "sin_porotos", "Te quedaste sin porotos.");
    if (e.apuesta[j] !== null) return rechazo(e0, "ya_apostaste", "Ya apostaste.");
    const max = Math.min(TOPE_APUESTA, e.porotos[j]);
    if (a.n < 1 || a.n > max) return rechazo(e0, "apuesta", `Apostá de 1 a ${max}.`);
    e.apuesta[j] = a.n;
    ev.push({ t: "apuesta", jugador: j, n: a.n });
    if (jugadoresMano(e).every((x) => e.apuesta[x] !== null)) proximoTurno(e, null, ahora, ev);
    e.seq++;
    return { estado: e, eventos: ev };
  }
  if (a.t === "carta" || a.t === "plantarse") {
    if (e.fase !== "turnos" && e.fase !== "banca") return rechazo(e0, "no_jugando", "Esperá a que arranque la mano.");
    if (e.turno !== j) return rechazo(e0, "no_es_tu_turno", "No es tu turno.");
    if (a.t === "plantarse") {
      e.plantado[j] = true;
      ev.push({ t: "planta", jugador: j, n: e.cartas[j].length });
    } else {
      const c = e.mazo.shift();
      e.cartas[j].push(c);
      const t = total(e.cartas[j]);
      ev.push({ t: "carta", jugador: j, carta: c });
      if (t > SIETE_Y_MEDIO) {
        e.paso[j] = true;
        if (j !== e.banca) e.pagado[j] = pagar(e, j, e.banca, e.apuesta[j] || 0);
        ev.push({ t: "se_paso", jugador: j, tapada: e.cartas[j][0], total: t, porotos: j !== e.banca ? e.pagado[j] : 0 });
      } else if (t === SIETE_Y_MEDIO) {
        e.plantado[j] = true;
        ev.push({ t: "siete_y_medio", jugador: j, deMano: deMano(e.cartas[j]) });
      }
    }
    e.ultimo = { jugador: j, t: a.t };
    if (j === e.banca) { if (e.plantado[j] || e.paso[j]) cerrarMano(e, ahora, ev); else e.turnoDesde = ahora; }
    else if (e.plantado[j] || e.paso[j]) proximoTurno(e, j, ahora, ev);
    else e.turnoDesde = ahora;
    e.seq++;
    return { estado: e, eventos: ev };
  }
  throw new Error("acción desconocida");
}

/** Cierra la pausa del resultado: mano nueva o fin. */
export function reloj(e0, ahora) {
  if (e0.fase !== "resultado" || ahora < e0.resultadoHasta) return { estado: e0, eventos: [] };
  const e = copia(e0), ev = [];
  const sinPorotos = e.porotos.map((p, j) => (p <= 0 ? j : -1)).filter((j) => j >= 0);
  if (sinPorotos.length || activos(e).length < 2) {
    const max = Math.max(...e.porotos);
    e.ganadores = e.porotos.map((p, j) => (p === max ? j : -1)).filter((j) => j >= 0);
    e.fase = "fin"; e.ganador = e.ganadores.length === 1 ? e.ganadores[0] : null; e.perdedores = sinPorotos; e.turno = null; e.seq++;
    ev.push({ t: "fin", ganador: e.ganador, ganadores: [...e.ganadores], perdedores: sinPorotos, porotos: [...e.porotos] });
    return { estado: e, eventos: ev };
  }
  e.banca = siguiente(e, e.banca);
  ev.push(...repartir(e, ahora));
  return { estado: e, eventos: ev };
}

/** Lo que ve el jugador `yo`: la tapada de los demás no se ve hasta que se pasan o termina la mano. */
export function vista(e, yo) {
  const destapar = e.fase === "resultado" || e.fase === "fin";
  return {
    juego: "siete", n: e.n, yo, nombres: [...e.nombres], fase: e.fase, manoN: e.manoN, banca: e.banca,
    porotos: [...e.porotos], apuesta: [...e.apuesta], turno: e.turno, turnoDesde: e.turnoDesde, faseDesde: e.faseDesde,
    cartas: e.cartas.map((cs, j) => cs.map((c, k) => (k === 0 && j !== yo && !destapar && !e.paso[j] ? null : c))),
    plantado: [...e.plantado], paso: [...e.paso],
    resultado: e.resultado ? copia(e.resultado) : null, resultadoHasta: e.resultadoHasta,
    ganador: e.ganador, ganadores: [...(e.ganadores || [])], perdedores: [...e.perdedores], mazo: e.mazo.length, seq: e.seq,
  };
}

/** Lo que puede hacer `j` ahora (para la mesa y los bots). */
export function acciones(e, j) {
  if (e.fase === "apuesta" && j !== e.banca && e.porotos[j] > 0 && e.apuesta[j] === null) {
    const max = Math.min(TOPE_APUESTA, e.porotos[j]);
    return Array.from({ length: max }, (_, k) => ({ t: "apostar", n: k + 1 }));
  }
  if ((e.fase === "turnos" || e.fase === "banca") && e.turno === j) return [{ t: "carta" }, { t: "plantarse" }];
  return [];
}
