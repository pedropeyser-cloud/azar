// DESCONFÍO: adaptador para la sala de a varios (nucleo/sala-n.js) y frases de los tres bots.
import * as M from "./motor.js";
import { bot } from "./bot.js";

export const FRASES = {
  tranquilo: {
    empieza: ["Sacudan despacito, que se gastan los dados.", "A ver qué me tocó… ah, mirá vos.", "Yo no miento. Casi."],
    desconfio: ["¡Desconfío! Tantos no hay ni en el bar.", "Mmm… ¡desconfío!"],
    confio: ["¡Confío! Justito, como el mate.", "Me tiro: ¡confío!"],
    acierto: ["¿Viste? Despacio se ve mejor.", "Lo sabía, lo sabía."],
    erro: ["Uh, había nomás.", "Y bueno, un dado menos."],
    pierde_dado: ["Uno menos. No pasa nada.", "Se me escapó uno."],
    obligada: ["Obligada. Ahora nadie cambia el número.", "Me queda uno solo, sean buenos."],
    gana: ["Gané sin apuro, viste.", "Despacio se llega lejos."],
    pierde: ["Me quedé sin dados. Otro mate y la revancha.", "Bien jugado, pibe."],
  },
  rapido: {
    empieza: ["Hoy miento como nunca.", "Sacudan, cobardes.", "Dale, que no tengo toda la noche."],
    desconfio: ["¡Desconfío! Mentiroso.", "¡A ver, a ver! ¡Desconfío!", "Eso no lo tenés ni soñando."],
    confio: ["¡Confío! A todo o nada.", "Justo eso hay. ¡Confío!"],
    acierto: ["¡Jajá! Cancha es cancha.", "¿Viste? Te tengo leído."],
    erro: ["Bueno, bueno, había.", "Esa era para ver si estabas despierto."],
    pierde_dado: ["Un dado menos, ni lo mires.", "Ya lo recupero."],
    otro_pierde: ["¡Un dadito menos para vos!", "Andá despidiéndote."],
    obligada: ["Obligada. Tiemblen.", "Uno solo, pero filoso."],
    gana: ["Mintiendo se llega lejos.", "¿Viste? Volvé cuando entrenes."],
    pierde: ["Hoy tenés el día.", "La próxima te dejo sin dados."],
  },
  implacable: {
    empieza: ["Sacudí.", "Cuento todo."],
    desconfio: ["Desconfío.", "No hay tantos."],
    confio: ["Confío.", "Justo."],
    acierto: ["Era la cuenta.", "Probable."],
    erro: ["Había.", "Error mío."],
    pierde_dado: ["Uno menos.", "Anotado."],
    obligada: ["Obligada.", "Un dado alcanza."],
    gana: ["Partida.", "Fin."],
    pierde: ["Bien jugado.", "Otra."],
  },
};

/** Quién comenta qué (solo hablan los bots; la sala elige quién es bot). */
export function charla(ev, n) {
  const out = [];
  for (const e of ev) {
    if (e.t === "desconfio" || e.t === "confio") out.push({ j: e.jugador, momento: e.t, chance: 0.7 });
    else if (e.t === "pierde_dado") { out.push({ j: e.jugador, momento: "pierde_dado", chance: 0.35 }); for (let k = 0; k < n; k++) if (k !== e.jugador) out.push({ j: k, momento: "otro_pierde", chance: 0.15 }); }
    else if (e.t === "ronda" && e.obligada) out.push({ j: e.abre, momento: "obligada", chance: 0.8 });
    else if (e.t === "fin") for (let k = 0; k < n; k++) out.push({ j: k, momento: k === e.ganador ? "gana" : e.orden?.[e.orden.length - 1] === k ? "pierde" : "", chance: 0.9 });
  }
  // el que cantó comenta si acertó (después de la vuelta)
  for (const e of ev) if (e.t === "desconfio" || e.t === "confio") out.push({ j: e.jugador, momento: e.acierta ? "acierto" : "erro", chance: 0.3 });
  return out.filter((c) => c.momento);
}

// ---------- limpieza de lo que llega por la red ----------
const ent = (x, max = 1000, min = 0) => (Number.isInteger(x) && x >= min && x <= max ? x : 0);
const num = (x) => (Number.isFinite(x) ? x : 0);
const asiento = (x, n) => (Number.isInteger(x) && x >= 0 && x < n ? x : null);
const lista = (a, n, f) => Array.from({ length: n }, (_, k) => f(Array.isArray(a) ? a[k] : undefined));
const asientos = (a, n) => (Array.isArray(a) ? a.slice(0, 6).map((x) => asiento(x, n)).filter((x) => x !== null) : []);
const caraOk = (x) => (M.CARAS.includes(x) ? x : null);
const dados = (a) => (Array.isArray(a) ? a.slice(0, M.DADOS).filter((d) => M.CARAS.includes(d)) : []);
const TOPE = 6 * M.DADOS;
function apuestaLimpia(a, n) {
  if (!a || typeof a !== "object" || !caraOk(a.cara) || !Number.isInteger(a.c) || a.c < 1 || a.c > TOPE) return null;
  return { c: a.c, cara: a.cara, jugador: asiento(a.jugador, n) ?? 0 };
}

export function accionLimpia(a) {
  if (!a || typeof a !== "object") return null;
  if (a.t === "desconfio" || a.t === "confio") return { t: a.t };
  if (a.t === "apostar" && Number.isInteger(a.c) && a.c >= 1 && a.c <= TOPE && caraOk(a.cara)) return { t: "apostar", c: a.c, cara: a.cara };
  return null;
}
function revelarLimpio(r, n) {
  if (!r || typeof r !== "object") return null;
  return {
    tipo: r.tipo === "confio" ? "confio" : "desconfio", quien: asiento(r.quien, n) ?? 0, de: asiento(r.de, n) ?? 0,
    c: ent(r.c, TOPE), cara: caraOk(r.cara) ?? 2, hay: ent(r.hay, TOPE), obligada: r.obligada === true,
    dados: lista(r.dados, n, dados), pierde: asiento(r.pierde, n), gana: asiento(r.gana, n), acierta: r.acierta === true, hasta: num(r.hasta),
  };
}
export function vistaLimpia(v, yo, n) {
  return {
    juego: "desconfio", n, yo, nombres: Array(n).fill(""),
    fase: ["apostar", "revelar", "fin"].includes(v.fase) ? v.fase : "apostar",
    turno: asiento(v.turno, n), turnoDesde: num(v.turnoDesde), ronda: ent(v.ronda, 9999),
    mios: dados(v.mios), cuantos: lista(v.cuantos, n, (x) => ent(x, M.DADOS)), total: ent(v.total, TOPE),
    apuesta: apuestaLimpia(v.apuesta, n), cadena: Array.isArray(v.cadena) ? v.cadena.slice(0, 200).map((x) => apuestaLimpia(x, n)).filter(Boolean) : [],
    obligada: v.obligada === true, revelar: revelarLimpio(v.revelar, n), fuera: asientos(v.fuera, n),
    ganador: asiento(v.ganador, n), ganadores: asientos(v.ganadores, n), orden: asientos(v.orden, n),
    puedoApostar: v.puedoApostar === true, puedoCantar: v.puedoCantar === true, seq: ent(v.seq, 1e9),
  };
}
export function eventosLimpios(ev, n) {
  const out = [];
  for (const e of Array.isArray(ev) ? ev.slice(0, 20) : []) {
    if (!e || typeof e !== "object") continue;
    const j = asiento(e.jugador, n) ?? 0;
    switch (e.t) {
      case "ronda": out.push({ t: "ronda", abre: asiento(e.abre, n) ?? 0, ronda: ent(e.ronda, 9999), obligada: e.obligada === true }); break;
      case "apuesta": if (caraOk(e.cara)) out.push({ t: "apuesta", jugador: j, c: ent(e.c, TOPE), cara: e.cara }); break;
      case "desconfio": case "confio":
        out.push({ t: e.t, jugador: j, de: asiento(e.de, n) ?? 0, c: ent(e.c, TOPE), cara: caraOk(e.cara) ?? 2, hay: ent(e.hay, TOPE), pierde: asiento(e.pierde, n), gana: asiento(e.gana, n), acierta: e.acierta === true, dados: lista(e.dados, n, dados) }); break;
      case "pierde_dado": case "gana_dado": out.push({ t: e.t, jugador: j, quedan: ent(e.quedan, M.DADOS) }); break;
      case "sale": out.push({ t: "sale", jugador: j, puesto: ent(e.puesto, 6) }); break;
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
