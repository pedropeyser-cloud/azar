// DESCONFÍO (manos de póker): adaptador para la sala de a varios (nucleo/sala-n.js) y frases de los tres bots.
import * as M from "./motor.js";
import { bot } from "./bot.js";

export const FRASES = {
  tranquilo: {
    empieza: ["Sacudan despacito, que se gastan los dados.", "A ver qué me tocó… ah, mirá vos.", "Yo no miento. Casi."],
    creo: ["Te creo, che. Pasá el cubilete.", "Bueno, te creo."],
    desconfio: ["¡Desconfío! Eso no lo sacás ni en sueños.", "Mmm… ¡desconfío!"],
    acierto: ["¿Viste? Despacio se ve mejor.", "Lo sabía, lo sabía."],
    erro: ["Uh, lo tenía nomás.", "Y bueno, una vida menos."],
    cazado: ["Me agarraste. No se puede mentir tranquilo.", "Ay. Era para ver si estabas atento."],
    gana_ronda: ["Una ronda para el viejo.", "Despacito y adentro."],
    gana: ["Gané sin apuro, viste.", "Despacio se llega lejos."],
    pierde: ["Me quedé sin vidas. Otro mate y la revancha.", "Bien jugado, pibe."],
  },
  rapido: {
    empieza: ["Hoy miento como nunca.", "Sacudan, cobardes.", "Dale, que no tengo toda la noche."],
    creo: ["Te creo… por ahora.", "Dale, pasá."],
    desconfio: ["¡Desconfío! Mentiroso.", "¡A ver, a ver! ¡Desconfío!", "Eso no lo tenés ni soñando."],
    acierto: ["¡Jajá! Cancha es cancha.", "¿Viste? Te tengo leído."],
    erro: ["Bueno, bueno, lo tenías.", "Esa era para ver si estabas despierto."],
    cazado: ["Ni lo mires, fue un ensayo.", "La próxima no me agarrás."],
    otro_pierde: ["¡Una vida menos para vos!", "Andá despidiéndote."],
    gana_ronda: ["¡Ronda para Rata!", "Anotá otra."],
    gana: ["Mintiendo se llega lejos.", "¿Viste? Volvé cuando entrenes."],
    pierde: ["Hoy tenés el día.", "La próxima te dejo sin vidas."],
  },
  implacable: {
    empieza: ["Sacudí.", "Cuento todo."],
    creo: ["Creo.", "Pasá."],
    desconfio: ["Desconfío.", "No da la cuenta."],
    acierto: ["Era la cuenta.", "Probable."],
    erro: ["Lo tenías.", "Error mío."],
    cazado: ["Anotado.", "Bien visto."],
    gana_ronda: ["Ronda.", "Una."],
    gana: ["Partida.", "Fin."],
    pierde: ["Bien jugado.", "Otra."],
  },
};

/** Quién comenta qué (solo hablan los bots; la sala elige quién es bot). */
export function charla(ev, n) {
  const out = [];
  for (const e of ev) {
    if (e.t === "creo") out.push({ j: e.jugador, momento: "creo", chance: 0.3 });
    else if (e.t === "desconfio") {
      out.push({ j: e.jugador, momento: "desconfio", chance: 0.7 });
      out.push({ j: e.jugador, momento: e.verdad ? "erro" : "acierto", chance: 0.3 });
      if (!e.verdad) out.push({ j: e.de, momento: "cazado", chance: 0.4 });
    } else if (e.t === "pierde_vida") { for (let k = 0; k < n; k++) if (k !== e.jugador) out.push({ j: k, momento: "otro_pierde", chance: 0.12 }); }
    else if (e.t === "gana_ronda") out.push({ j: e.jugador, momento: "gana_ronda", chance: 0.5 });
    else if (e.t === "fin") for (let k = 0; k < n; k++) out.push({ j: k, momento: k === e.ganador ? "gana" : e.orden?.[e.orden.length - 1] === k ? "pierde" : "", chance: 0.9 });
  }
  return out.filter((c) => c.momento);
}

// ---------- limpieza de lo que llega por la red ----------
const ent = (x, max = 1000, min = 0) => (Number.isInteger(x) && x >= min && x <= max ? x : 0);
const num = (x) => (Number.isFinite(x) ? x : 0);
const asiento = (x, n) => (Number.isInteger(x) && x >= 0 && x < n ? x : null);
const lista = (a, n, f) => Array.from({ length: n }, (_, k) => f(Array.isArray(a) ? a[k] : undefined));
const asientos = (a, n) => (Array.isArray(a) ? a.slice(0, 6).map((x) => asiento(x, n)).filter((x) => x !== null) : []);
const dados = (a) => (Array.isArray(a) ? a.slice(0, M.DADOS).filter((d) => M.CARAS.includes(d)) : []);
const mano = (a) => (M.manoValida(a) ? M.ordenMano(a) : null);
function cantoLimpio(c, n) {
  if (!c || typeof c !== "object" || !mano(c.mano)) return null;
  return { mano: mano(c.mano), jugador: asiento(c.jugador, n) ?? 0, tiro: ent(c.tiro, M.DADOS), de0: c.de0 === true };
}

export function accionLimpia(a) {
  if (!a || typeof a !== "object") return null;
  if (a.t === "creo" || a.t === "desconfio") return { t: a.t };
  if (a.t === "tirar") return { t: "tirar", guarda: Array.isArray(a.guarda) ? [...new Set(a.guarda.slice(0, M.DADOS).filter((i) => Number.isInteger(i) && i >= 0 && i < M.DADOS))] : [] };
  if (a.t === "cantar" && mano(a.mano)) return { t: "cantar", mano: mano(a.mano) };
  return null;
}
function revelarLimpio(r, n) {
  if (!r || typeof r !== "object" || !mano(r.mano)) return null;
  const ds = dados(r.dados);
  return {
    quien: asiento(r.quien, n) ?? 0, de: asiento(r.de, n) ?? 0, mano: mano(r.mano), dados: ds,
    nombreHay: ds.length === M.DADOS ? M.nombreMano(ds) : "", verdad: r.verdad === true, pierde: asiento(r.pierde, n) ?? 0, hasta: num(r.hasta),
  };
}
export function vistaLimpia(v, yo, n) {
  return {
    juego: "desconfio", n, yo, nombres: Array(n).fill(""),
    fase: ["mano", "responder", "revelar", "fin"].includes(v.fase) ? v.fase : "mano",
    turno: asiento(v.turno, n), turnoDesde: num(v.turnoDesde), ronda: ent(v.ronda, 9999),
    vidas: lista(v.vidas, n, (x) => ent(x, M.VIDAS)), puntos: lista(v.puntos, n, (x) => ent(x, 9999)), enRonda: lista(v.enRonda, n, (x) => x === true),
    mios: dados(v.mios), aSuperar: mano(v.aSuperar), tiro: v.tiro && typeof v.tiro === "object" ? { cuantos: ent(v.tiro.cuantos, M.DADOS) } : null,
    llego: ["cero", "creyo", "verdad"].includes(v.llego) ? v.llego : null,
    canto: cantoLimpio(v.canto, n), cadena: Array.isArray(v.cadena) ? v.cadena.slice(0, 200).map((x) => cantoLimpio(x, n)).filter(Boolean) : [],
    revelar: revelarLimpio(v.revelar, n), fuera: asientos(v.fuera, n),
    ganador: asiento(v.ganador, n), ganadores: asientos(v.ganadores, n), orden: asientos(v.orden, n),
    puedoTirar: v.puedoTirar === true, puedoCantar: v.puedoCantar === true, puedoResponder: v.puedoResponder === true, puedoCreer: v.puedoCreer === true,
    seq: ent(v.seq, 1e9),
  };
}
export function eventosLimpios(ev, n) {
  const out = [];
  for (const e of Array.isArray(ev) ? ev.slice(0, 20) : []) {
    if (!e || typeof e !== "object") continue;
    const j = asiento(e.jugador, n) ?? 0;
    switch (e.t) {
      case "ronda": out.push({ t: "ronda", abre: asiento(e.abre, n) ?? 0, ronda: ent(e.ronda, 9999) }); break;
      case "tiro": out.push({ t: "tiro", jugador: j, cuantos: ent(e.cuantos, M.DADOS) }); break;
      case "canto": if (mano(e.mano)) out.push({ t: "canto", jugador: j, mano: mano(e.mano), nombre: M.nombreMano(e.mano), tiro: ent(e.tiro, M.DADOS) }); break;
      case "creo": out.push({ t: "creo", jugador: j, de: asiento(e.de, n) ?? 0 }); break;
      case "desconfio": if (mano(e.mano)) out.push({ t: "desconfio", jugador: j, de: asiento(e.de, n) ?? 0, mano: mano(e.mano), dados: dados(e.dados), verdad: e.verdad === true, pierde: asiento(e.pierde, n) ?? 0 }); break;
      case "pierde_vida": out.push({ t: "pierde_vida", jugador: j, quedan: ent(e.quedan, M.VIDAS) }); break;
      case "sale": case "afuera_ronda": out.push({ t: e.t, jugador: j }); break;
      case "gana_ronda": out.push({ t: "gana_ronda", jugador: j, puntos: ent(e.puntos, 9999), ronda: ent(e.ronda, 9999) }); break;
      case "cubilete": out.push({ t: "cubilete", jugador: j, aSuperar: mano(e.aSuperar) }); break;
      case "fin": out.push({ t: "fin", ganador: asiento(e.ganador, n), orden: asientos(e.orden, n) }); break;
      case "revancha": out.push({ t: "revancha" }); break;
      case "quiere_revancha": out.push({ t: "quiere_revancha", jugador: j }); break;
      case "no_revancha": out.push({ t: "no_revancha", jugador: j }); break;
      default:
    }
  }
  return out;
}

export const desconfio = {
  id: "desconfio", nombre: "Desconfío", min: 2, max: 6,
  nuevaPartida: M.nuevaPartida, aplicar: M.aplicar, reloj: M.reloj, vista: M.vista, bot,
  frases: FRASES, charla, accionLimpia, vistaLimpia, eventosLimpios,
};
