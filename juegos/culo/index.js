// CULO SUCIO: adaptador para la sala de a varios (nucleo/sala-n.js) y frases de los tres bots.
import * as M from "./motor.js";
import { bot } from "./bot.js";

export const FRASES = {
  tranquilo: {
    empieza: ["Repartan despacito, que yo no miento… mucho.", "A ver quién termina con el culo sucio.", "Uh, cuántas cartas."],
    desconfio: ["¡Desconfío! Eso no me lo creo ni dormido.", "Mmm… ¡desconfío!"],
    pescado: ["Uh, me agarraron.", "Y bueno, una mentirita."],
    me_equivoque: ["Ah, era verdad. Me la llevo.", "Uy, metí la pata."],
    sale: ["Me fui. Que se ensucien otros.", "Afuera, despacito."],
    gana: ["Ni me ensucié, viste.", "Despacio se sale primero."],
    pierde: ["Culo sucio yo. Otro mate y la revancha.", "Y bueno, alguien tenía que ser."],
  },
  rapido: {
    empieza: ["Hoy miento como nunca.", "Prepárense, que se vienen las mentiras.", "Dale, que alguien termina sucio y no soy yo."],
    desconfio: ["¡Desconfío! Mentiroso.", "¡A ver, a ver! ¡Desconfío!", "Eso es mentira y lo sabés."],
    pescado: ["Bueno, bueno, me agarraste.", "Esa era para ver si estabas despierto."],
    me_equivoque: ["Ah, era verdad. Qué raro vos diciendo la verdad.", "Me la llevo, ya la vuelvo a tirar."],
    otro_pescado: ["¡Jajá! Agarrado.", "Llevátela toda, campeón."],
    sale: ["Chau, me voy limpito.", "Afuera. Arréglense."],
    gana: ["Mintiendo se llega lejos.", "¿Viste? Primero yo."],
    pierde: ["Culo sucio… la próxima no me agarran.", "Hoy tenés el día."],
  },
  implacable: {
    empieza: ["Repartí.", "Cuento todo."],
    desconfio: ["Desconfío.", "No hay tantas."],
    pescado: ["Bien visto.", "Me tocó."],
    me_equivoque: ["Era verdad.", "Error mío."],
    sale: ["Afuera.", "Listo."],
    gana: ["Partida.", "Limpio."],
    pierde: ["Bien jugado.", "Otra."],
  },
};

export function charla(ev, n) {
  const out = [];
  for (const e of ev) {
    if (e.t === "desconfio") {
      out.push({ j: e.jugador, momento: "desconfio", chance: 0.75 });
      if (e.mintio) { out.push({ j: e.de, momento: "pescado", chance: 0.5 }); for (let k = 0; k < n; k++) if (k !== e.de && k !== e.jugador) out.push({ j: k, momento: "otro_pescado", chance: 0.2 }); }
      else out.push({ j: e.jugador, momento: "me_equivoque", chance: 0.4 });
    } else if (e.t === "sale") out.push({ j: e.jugador, momento: "sale", chance: 0.6 });
    else if (e.t === "fin") for (let k = 0; k < n; k++) out.push({ j: k, momento: k === e.culo ? "pierde" : e.fuera[0] === k ? "gana" : "", chance: 0.9 });
  }
  return out.filter((c) => c.momento);
}

// ---------- limpieza de lo que llega por la red ----------
const ent = (x, max = 1000) => (Number.isInteger(x) && x >= 0 && x <= max ? x : 0);
const num = (x) => (Number.isFinite(x) ? x : 0);
const asiento = (x, n) => (Number.isInteger(x) && x >= 0 && x < n ? x : null);
const lista = (a, n, f) => Array.from({ length: n }, (_, k) => f(Array.isArray(a) ? a[k] : undefined));
const cartas = (a, max = 40) => (Array.isArray(a) ? a.slice(0, max).filter(M.idValido) : []);
const numeroOk = (x) => (M.NUMEROS.includes(x) ? x : null);
const asientos = (a, n) => (Array.isArray(a) ? a.slice(0, 6).map((x) => asiento(x, n)).filter((x) => x !== null) : []);

export function accionLimpia(a) {
  if (!a || typeof a !== "object") return null;
  if (a.t === "desconfio" || a.t === "confio") return { t: a.t };
  if (a.t === "tirar" && Array.isArray(a.cartas) && a.cartas.length >= 1 && a.cartas.length <= 4 && a.cartas.every(M.idValido) && new Set(a.cartas).size === a.cartas.length)
    return { t: "tirar", cartas: [...a.cartas], ...(numeroOk(a.numero) ? { numero: a.numero } : {}) };
  return null;
}
function revelarLimpio(r, n) {
  if (!r || typeof r !== "object") return null;
  return { desconfia: asiento(r.desconfia, n) ?? 0, jugador: asiento(r.jugador, n) ?? 0, cartas: cartas(r.cartas, 4), numero: numeroOk(r.numero) ?? 1, mintio: r.mintio === true, toma: asiento(r.toma, n) ?? 0, pila: ent(r.pila, 40), hasta: num(r.hasta) };
}
export function vistaLimpia(v, yo, n) {
  return {
    juego: "culo", n, yo, nombres: Array(n).fill(""),
    fase: ["abrir", "seguir", "revelar", "fin"].includes(v.fase) ? v.fase : "abrir",
    turno: asiento(v.turno, n), turnoDesde: num(v.turnoDesde), jugadaDesde: num(v.jugadaDesde),
    mano: M.ordenar(cartas(v.mano)), enMano: lista(v.enMano, n, (x) => ent(x, 40)), pila: ent(v.pila, 40),
    ronda: v.ronda && typeof v.ronda === "object" && numeroOk(v.ronda.numero) ? { numero: v.ronda.numero, jugadas: Array.isArray(v.ronda.jugadas) ? v.ronda.jugadas.slice(0, 40).map((x) => ({ jugador: asiento(x?.jugador, n) ?? 0, n: ent(x?.n, 4) })) : [] } : null,
    ultima: v.ultima && typeof v.ultima === "object" ? { jugador: asiento(v.ultima.jugador, n) ?? 0, n: ent(v.ultima.n, 4) } : null,
    pendiente: asiento(v.pendiente, n), fuera: asientos(v.fuera, n), culo: asiento(v.culo, n), ganadores: asientos(v.ganadores, n),
    revelar: revelarLimpio(v.revelar, n), puedoDesconfiar: v.puedoDesconfiar === true, puedoConfiar: v.puedoConfiar === true,
    seq: ent(v.seq, 1e9),
  };
}
export function eventosLimpios(ev, n) {
  const out = [];
  for (const e of Array.isArray(ev) ? ev.slice(0, 20) : []) {
    if (!e || typeof e !== "object") continue;
    const j = asiento(e.jugador, n) ?? 0;
    switch (e.t) {
      case "reparto": out.push({ t: "reparto", abre: asiento(e.abre, n) ?? 0, cartas: lista(e.cartas, n, (x) => ent(x, 40)) }); break;
      case "tiro": out.push({ t: "tiro", jugador: j, n: ent(e.n, 4), numero: numeroOk(e.numero) ?? 1, abre: e.abre === true, pila: ent(e.pila, 40) }); break;
      case "ultimas": out.push({ t: "ultimas", jugador: j }); break;
      case "desconfio": out.push({ t: "desconfio", jugador: j, de: asiento(e.de, n) ?? 0, cartas: cartas(e.cartas, 4), numero: numeroOk(e.numero) ?? 1, mintio: e.mintio === true, toma: asiento(e.toma, n) ?? 0, pila: ent(e.pila, 40) }); break;
      case "levanta": out.push({ t: "levanta", jugador: j, n: ent(e.n, 40) }); break;
      case "sale": out.push({ t: "sale", jugador: j, puesto: ent(e.puesto, 6) }); break;
      case "ronda": out.push({ t: "ronda", abre: asiento(e.abre, n) ?? 0 }); break;
      case "fin": out.push({ t: "fin", culo: asiento(e.culo, n), fuera: asientos(e.fuera, n) }); break;
      case "revancha": out.push({ t: "revancha" }); break;
      case "quiere_revancha": out.push({ t: "quiere_revancha", jugador: j }); break;
      case "no_revancha": out.push({ t: "no_revancha", jugador: j }); break;
      default:
    }
  }
  return out;
}

export const culo = {
  id: "culo", nombre: "Culo sucio", min: 2, max: 6,
  nuevaPartida: M.nuevaPartida, aplicar: M.aplicar, reloj: M.reloj, vista: M.vista, bot,
  frases: FRASES, charla, accionLimpia, vistaLimpia, eventosLimpios,
};
