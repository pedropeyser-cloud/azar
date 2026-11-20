// CHINCHÓN: adaptador para la sala de a varios (nucleo/sala-n.js) y frases de los tres bots.
import * as M from "./motor.js";
import { bot } from "./bot.js";

export const FRASES = {
  tranquilo: {
    empieza: ["Repartan tranquilos, que hay tiempo.", "Un chinchón con mate, lo mejor que hay.", "A ver qué me toca."],
    levanta: ["Esa me la quedo.", "Gracias por el regalito."],
    corta: ["Corto, despacito.", "Y bueno, corto acá.", "Me parece que corto."],
    menos_diez: ["¡Menos diez! No lo puedo creer.", "Todas adentro. Menos diez."],
    me_cortaron: ["Uh, me agarraste con todo en la mano.", "Ya cortaste… ni me di cuenta."],
    afuera: ["Me pasé. Les dejo la mesa.", "Hasta acá llegué."],
    vuelve: ["Vuelvo, vuelvo, que no terminó.", "Me reengancho, total es un ratito."],
    gana: ["Despacio también se gana.", "Mirá vos, gané."],
    pierde: ["Bien jugado. Otro mate y la revancha.", "Me ganaron lindo."],
  },
  rapido: {
    empieza: ["Dale que corto en dos vueltas.", "Hoy me sale el chinchón, avisado.", "Repartí rápido que me aburro."],
    levanta: ["¡Esa era mía!", "Gracias, justo la que quería."],
    corta: ["¡Corto! Cuenten.", "Chau, corté.", "Bajo todo, cuenten rápido."],
    menos_diez: ["¡Menos diez, nene!", "¡Todas adentro! Menos diez."],
    me_cortaron: ["¡Me cortaste con un rey en la mano!", "Justo me faltaba una."],
    otro_corte: ["Uh, cortó. Cuenten.", "¿Ya? Qué apuro."],
    afuera: ["Me pasé, pero vuelvo.", "Afuera… por ahora."],
    vuelve: ["¡Me reengancho! No se libran de mí.", "Vuelvo con todo."],
    gana: ["¡Gané! Ni lo dudaron.", "Rapidito y a casa."],
    pierde: ["La próxima corto antes.", "Hoy tenés el día."],
  },
  implacable: {
    empieza: ["Repartí.", "Cuento todo."],
    levanta: ["Sirve.", "Me la quedo."],
    corta: ["Corto.", "Cuenten."],
    menos_diez: ["Menos diez.", "Limpio."],
    me_cortaron: ["Bien cortado.", "Anotado."],
    afuera: ["Afuera.", "Me pasé."],
    vuelve: ["Vuelvo.", "Reenganche."],
    gana: ["Partida.", "Cerrado."],
    pierde: ["Bien jugado.", "Otra."],
  },
};

export function charla(ev, n) {
  const out = [];
  for (const e of ev) {
    if (e.t === "robo" && e.de === "pozo") out.push({ j: e.jugador, momento: "levanta", chance: 0.25 });
    else if (e.t === "corte") {
      out.push({ j: e.jugador, momento: e.limpio ? "menos_diez" : "corta", chance: e.limpio ? 0.95 : 0.6 });
      for (const f of e.filas || []) if (f.jugador !== e.jugador && f.puntos >= 25) out.push({ j: f.jugador, momento: "me_cortaron", chance: 0.5 });
      for (let k = 0; k < n; k++) if (k !== e.jugador) out.push({ j: k, momento: "otro_corte", chance: 0.15 });
    } else if (e.t === "afuera") out.push({ j: e.jugador, momento: "afuera", chance: 0.7 });
    else if (e.t === "vuelve") out.push({ j: e.jugador, momento: "vuelve", chance: 0.8 });
    else if (e.t === "fin") for (let k = 0; k < n; k++) out.push({ j: k, momento: k === e.ganador ? "gana" : "pierde", chance: 0.9 });
  }
  return out;
}

// ---------- limpieza de lo que llega por la red ----------
const ent = (x, max = 1000, min = 0) => (Number.isInteger(x) && x >= min && x <= max ? x : min > 0 ? min : 0);
const pts = (x) => (Number.isInteger(x) && x >= -1000 && x <= 1000 ? x : 0);
const num = (x) => (Number.isFinite(x) ? x : 0);
const asiento = (x, n) => (Number.isInteger(x) && x >= 0 && x < n ? x : null);
const lista = (a, n, f) => Array.from({ length: n }, (_, k) => f(Array.isArray(a) ? a[k] : undefined));
const carta = (x) => (M.idValido(x) ? x : null);
const cartas = (a, max = 8) => (Array.isArray(a) ? [...new Set(a.slice(0, max).filter(M.idValido))] : []);
const asientos = (a, n) => (Array.isArray(a) ? [...new Set(a.slice(0, 6).map((x) => asiento(x, n)).filter((x) => x !== null))] : []);
const juegos = (a) => (Array.isArray(a) ? a.slice(0, 4).map((g) => cartas(g, 8)).filter((g) => g.length) : []);
function filaLimpia(f, n) {
  return {
    jugador: asiento(f?.jugador, n) ?? 0, juegos: juegos(f?.juegos), sueltas: cartas(f?.sueltas, 8),
    pegadas: Array.isArray(f?.pegadas) ? f.pegadas.slice(0, 8).filter((x) => M.idValido(x?.carta)).map((x) => ({ carta: x.carta, juego: ent(x.juego, 3) })) : [],
    puntos: pts(f?.puntos), corto: f?.corto === true,
  };
}
const filas = (a, n) => (Array.isArray(a) ? a.slice(0, 6).map((f) => filaLimpia(f, n)) : []);

export function accionLimpia(a) {
  if (!a || typeof a !== "object") return null;
  if (a.t === "robar" && (a.de === "mazo" || a.de === "pozo")) return { t: "robar", de: a.de };
  if ((a.t === "tirar" || a.t === "cortar") && M.idValido(a.carta)) return { t: a.t, carta: a.carta };
  if (a.t === "reenganche") return { t: "reenganche", si: a.si === true };
  return null;
}
function recuentoLimpio(r, n) {
  if (!r || typeof r !== "object") return null;
  const dec = {};
  if (r.decidio && typeof r.decidio === "object") for (const [k, x] of Object.entries(r.decidio)) { const j = asiento(Number(k), n); if (j !== null) dec[j] = x === true; }
  return {
    corto: asiento(r.corto, n) ?? 0, carta: carta(r.carta), filas: filas(r.filas, n), chinchon: r.chinchon === true,
    antes: lista(r.antes, n, pts), pasados: asientos(r.pasados, n), puedeReenganche: asientos(r.puedeReenganche, n), decidio: dec,
    hasta: num(r.hasta), tope: num(r.tope),
  };
}
function acomodoLimpio(a) {
  if (!a || typeof a !== "object") return null;
  return { juegos: juegos(a.juegos), sueltas: cartas(a.sueltas, 8), puntos: pts(a.puntos) };
}
export function vistaLimpia(v, yo, n) {
  return {
    juego: "chinchon", n, yo, nombres: Array(n).fill(""),
    fase: ["robar", "tirar", "recuento", "fin"].includes(v.fase) ? v.fase : "robar",
    turno: asiento(v.turno, n), turnoDesde: num(v.turnoDesde),
    mano: cartas(v.mano, 8), enMano: lista(v.enMano, n, (x) => ent(x, 8)),
    pozo: carta(v.pozo), enPozo: ent(v.enPozo, 50), enMazo: ent(v.enMazo, 50), levanto: carta(v.levanto),
    puntos: lista(v.puntos, n, pts), fuera: asientos(v.fuera, n), reenganches: lista(v.reenganches, n, (x) => ent(x, 1)),
    reparte: asiento(v.reparte, n) ?? 0, nroMano: ent(v.nroMano, 10000),
    recuento: recuentoLimpio(v.recuento, n),
    cortes: Array.isArray(v.cortes) ? v.cortes.slice(0, 8).filter((x) => M.idValido(x?.carta)).map((x) => ({ carta: x.carta, puntos: ent(x.puntos, 5), chinchon: x.chinchon === true })) : [],
    acomodo: acomodoLimpio(v.acomodo),
    ganador: asiento(v.ganador, n), chinchon: asiento(v.chinchon, n), ganadores: asientos(v.ganadores, n),
    seq: ent(v.seq, 1e9),
  };
}
export function eventosLimpios(ev, n) {
  const out = [];
  for (const e of Array.isArray(ev) ? ev.slice(0, 20) : []) {
    if (!e || typeof e !== "object") continue;
    const j = asiento(e.jugador, n) ?? 0;
    switch (e.t) {
      case "reparto": out.push({ t: "reparto", mano: ent(e.mano, 10000), reparte: asiento(e.reparte, n) ?? 0, empieza: asiento(e.empieza, n) ?? 0, pozo: carta(e.pozo), cartas: lista(e.cartas, n, (x) => ent(x, 8)) }); break;
      case "robo": out.push({ t: "robo", jugador: j, de: e.de === "pozo" ? "pozo" : "mazo", ...(e.de === "pozo" ? { carta: carta(e.carta) } : {}) }); break;
      case "tiro": out.push({ t: "tiro", jugador: j, carta: carta(e.carta) }); break;
      case "mazo_nuevo": out.push({ t: "mazo_nuevo", cartas: ent(e.cartas, 50) }); break;
      case "mano_nula": out.push({ t: "mano_nula" }); break;
      case "corte": out.push({ t: "corte", jugador: j, carta: carta(e.carta), chinchon: e.chinchon === true, limpio: e.limpio === true, filas: filas(e.filas, n) }); break;
      case "reengancha": case "no_reengancha": out.push({ t: e.t, jugador: j }); break;
      case "vuelve": out.push({ t: "vuelve", jugador: j, puntos: pts(e.puntos) }); break;
      case "afuera": out.push({ t: "afuera", jugador: j, puntos: pts(e.puntos) }); break;
      case "fin": out.push({ t: "fin", ganador: asiento(e.ganador, n) ?? 0, chinchon: e.chinchon === true, puntos: lista(e.puntos, n, pts), fuera: asientos(e.fuera, n) }); break;
      case "revancha": out.push({ t: "revancha" }); break;
      case "quiere_revancha": out.push({ t: "quiere_revancha", jugador: j }); break;
      case "no_revancha": out.push({ t: "no_revancha", jugador: j }); break;
      default:
    }
  }
  return out;
}

export const chinchon = {
  id: "chinchon", nombre: "Chinchón", min: 2, max: 6,
  nuevaPartida: M.nuevaPartida, aplicar: M.aplicar, reloj: M.reloj, vista: M.vista, bot,
  frases: FRASES, charla, accionLimpia, vistaLimpia, eventosLimpios,
};
