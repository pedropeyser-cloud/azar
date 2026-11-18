// SIETE Y MEDIO: adaptador para la sala de a varios (nucleo/sala-n.js) y frases de los tres bots.
import * as M from "./motor.js";
import { bot } from "./bot.js";

export const FRASES = {
  tranquilo: {
    empieza: ["Repartan, que yo cebo.", "Despacito, que la banca no se escapa.", "A ver, ¿cuántos porotos traen?"],
    me_pase: ["Uh, me pasé. Por goloso.", "Y bueno, una de más.", "Me tenté y me fui al pasto."],
    siete: ["¡Siete y medio! Mirá vos.", "Justito, como el mate."],
    banca_gana: ["La banca cobra, despacito.", "Vengan esos porotos."],
    banca_paga: ["La banca paga. Se acabó la siesta.", "Tomen, tomen, que hay para todos."],
    gana: ["Gané y sin apuro, viste.", "Despacio se llega lejos."],
    pierde: ["Me quedé sin porotos. Otro mate y la revancha.", "Bien jugado, pibe."],
  },
  rapido: {
    empieza: ["Apuesten fuerte, cobardes.", "Hoy la banca soy yo, aunque no me toque.", "Dale, que no tengo toda la noche."],
    me_pase: ["Me pasé. Ni lo mires.", "Esa carta estaba marcada.", "Bueno, bueno, la próxima."],
    siete: ["¡Siete y medio! Pagá, pagá.", "¿Viste? Cancha es cancha."],
    banca_gana: ["La banca no perdona.", "Vengan, mis porotitos."],
    banca_paga: ["Bueno, hoy la banca es generosa.", "Llévense eso, ya lo recupero."],
    otro_paso: ["¡Te pasaste! Contá antes de pedir.", "Te tentaste, ¿eh?"],
    gana: ["¿Viste? Volvé cuando entrenes.", "Todos los porotos para mí."],
    pierde: ["Hoy tenés el día.", "La próxima te dejo seco."],
  },
  implacable: {
    empieza: ["Repartí.", "Banca o no banca, da igual."],
    me_pase: ["Error mío.", "Una de más."],
    siete: ["Siete y medio.", "Justo."],
    banca_gana: ["Cobro.", "La banca gana."],
    banca_paga: ["Pago.", "Bien jugado."],
    gana: ["Partida.", "Fin."],
    pierde: ["Bien jugado.", "Otra."],
  },
};

/** Quién comenta qué (solo los bots hablan; la sala elige quién es bot). */
export function charla(ev, n) {
  const out = [];
  for (const e of ev) {
    if (e.t === "se_paso") { out.push({ j: e.jugador, momento: "me_pase", chance: 0.6 }); for (let k = 0; k < n; k++) if (k !== e.jugador) out.push({ j: k, momento: "otro_paso", chance: 0.25 }); }
    else if (e.t === "siete_y_medio") out.push({ j: e.jugador, momento: "siete", chance: 0.8 });
    else if (e.t === "resultado") out.push({ j: e.resultado.banca, momento: e.resultado.netoBanca >= 0 ? "banca_gana" : "banca_paga", chance: 0.45 });
    else if (e.t === "fin") for (let k = 0; k < n; k++) out.push({ j: k, momento: (e.ganadores || [e.ganador]).includes(k) ? "gana" : e.perdedores.includes(k) ? "pierde" : "", chance: 0.9 });
  }
  return out.filter((c) => c.momento);
}

// ---------- limpieza de lo que llega por la red ----------
const ent = (x, max = 1000, min = 0) => (Number.isInteger(x) && x >= min && x <= max ? x : 0);
const num = (x) => (Number.isFinite(x) ? x : 0);
const medio = (x) => (Number.isFinite(x) && x >= 0 && x <= 30 && (x * 2) % 1 === 0 ? x : 0);
const asiento = (x, n) => (Number.isInteger(x) && x >= 0 && x < n ? x : null);
const lista = (a, n, f) => Array.from({ length: n }, (_, k) => f(Array.isArray(a) ? a[k] : undefined));
const carta = (c) => (M.idValido(c) ? c : null);

export function accionLimpia(a) {
  if (!a || typeof a !== "object") return null;
  if (a.t === "carta" || a.t === "plantarse") return { t: a.t };
  if (a.t === "apostar" && Number.isInteger(a.n) && a.n >= 1 && a.n <= M.TOPE_APUESTA) return { t: "apostar", n: a.n };
  return null;
}
function resultadoLimpio(r, n) {
  if (!r || typeof r !== "object") return null;
  return {
    banca: asiento(r.banca, n) ?? 0, totalBanca: medio(r.totalBanca), bancaPaso: r.bancaPaso === true, mano: ent(r.mano, 9999), netoBanca: Number.isInteger(r.netoBanca) ? Math.max(-200, Math.min(200, r.netoBanca)) : 0,
    filas: Array.isArray(r.filas) ? r.filas.slice(0, 6).map((f) => ({ jugador: asiento(f?.jugador, n) ?? 0, total: medio(f?.total), resultado: ["paso", "gana", "doble", "pierde"].includes(f?.resultado) ? f.resultado : "pierde", porotos: Number.isInteger(f?.porotos) ? Math.max(-20, Math.min(20, f.porotos)) : 0 })) : [],
  };
}
export function vistaLimpia(v, yo, n) {
  return {
    juego: "siete", n, yo, nombres: Array(n).fill(""),
    fase: ["apuesta", "turnos", "banca", "resultado", "fin"].includes(v.fase) ? v.fase : "apuesta",
    manoN: ent(v.manoN, 9999), banca: asiento(v.banca, n) ?? 0,
    porotos: lista(v.porotos, n, (x) => ent(x, 200)), apuesta: lista(v.apuesta, n, (x) => (x === null ? null : ent(x, M.TOPE_APUESTA))),
    turno: asiento(v.turno, n), turnoDesde: num(v.turnoDesde), faseDesde: num(v.faseDesde),
    cartas: lista(v.cartas, n, (cs) => (Array.isArray(cs) ? cs.slice(0, 16).map(carta) : [])),
    plantado: lista(v.plantado, n, (x) => x === true), paso: lista(v.paso, n, (x) => x === true),
    resultado: resultadoLimpio(v.resultado, n), resultadoHasta: v.resultadoHasta === null ? null : num(v.resultadoHasta),
    ganador: asiento(v.ganador, n), ganadores: Array.isArray(v.ganadores) ? v.ganadores.slice(0, 6).map((x) => asiento(x, n)).filter((x) => x !== null) : [], perdedores: Array.isArray(v.perdedores) ? v.perdedores.slice(0, 6).map((x) => asiento(x, n)).filter((x) => x !== null) : [],
    mazo: ent(v.mazo, 40), seq: ent(v.seq, 1e9),
  };
}
export function eventosLimpios(ev, n) {
  const out = [];
  for (const e of Array.isArray(ev) ? ev.slice(0, 20) : []) {
    if (!e || typeof e !== "object") continue;
    const j = asiento(e.jugador, n) ?? 0;
    switch (e.t) {
      case "reparto": out.push({ t: "reparto", mano: ent(e.mano, 9999), banca: asiento(e.banca, n) ?? 0 }); break;
      case "apuesta": out.push({ t: "apuesta", jugador: j, n: ent(e.n, M.TOPE_APUESTA) }); break;
      case "carta": if (M.idValido(e.carta)) out.push({ t: "carta", jugador: j, carta: e.carta }); break;
      case "planta": out.push({ t: "planta", jugador: j, n: ent(e.n, 16) }); break;
      case "se_paso": out.push({ t: "se_paso", jugador: j, tapada: carta(e.tapada), total: medio(e.total), porotos: ent(e.porotos, 20) }); break;
      case "siete_y_medio": out.push({ t: "siete_y_medio", jugador: j, deMano: e.deMano === true }); break;
      case "banca": out.push({ t: "banca", jugador: j }); break;
      case "resultado": out.push({ t: "resultado", resultado: resultadoLimpio(e.resultado, n) }); break;
      case "fin": out.push({ t: "fin", ganador: asiento(e.ganador, n), ganadores: Array.isArray(e.ganadores) ? e.ganadores.slice(0, 6).map((x) => asiento(x, n)).filter((x) => x !== null) : [], perdedores: Array.isArray(e.perdedores) ? e.perdedores.slice(0, 6).map((x) => asiento(x, n)).filter((x) => x !== null) : [] }); break;
      case "revancha": out.push({ t: "revancha" }); break;
      case "quiere_revancha": out.push({ t: "quiere_revancha", jugador: j }); break;
      case "no_revancha": out.push({ t: "no_revancha", jugador: j }); break;
      default:
    }
  }
  return out;
}

export const siete = {
  id: "siete", nombre: "Siete y medio", min: 2, max: 6,
  nuevaPartida: M.nuevaPartida, aplicar: M.aplicar, reloj: M.reloj, vista: M.vista, bot,
  frases: FRASES, charla, accionLimpia, vistaLimpia, eventosLimpios,
};
