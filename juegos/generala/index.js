// GENERALA: adaptador para la sala de a varios (nucleo/sala-n.js) y frases de los tres bots.
import * as M from "./motor.js";
import { bot } from "./bot.js";

export const FRASES = {
  tranquilo: {
    empieza: ["Despacito, que los dados no se escapan.", "A ver si hoy sale la generala.", "Un mate y tiro."],
    generala: ["¡Generala! Despacio se llega.", "Mirá vos, ¡generala!"],
    servida: ["¡Servida! Ni la busqué.", "¡Generala servida! Qué cosa."],
    otro_generala: ["Uh, ¡generala! Bien ahí.", "Qué suerte, eh."],
    juego: ["Lindo, lindo.", "Algo es algo."],
    tacha: ["Y bueno, tacho.", "Esta va con cruz."],
    gana: ["Gané sin apuro, viste.", "Despacio se llega lejos."],
    pierde: ["Otro mate y la revancha.", "Bien jugado, pibe."],
  },
  rapido: {
    empieza: ["Tiren, que no tengo toda la noche.", "Hoy me sale todo.", "Dale, dale."],
    generala: ["¡Generala, papá!", "¡Cinco iguales! ¿Vieron?"],
    servida: ["¡SERVIDA! ¡Se terminó!", "¡De una! ¡Servida!"],
    otro_generala: ["¿Generala? Qué culo.", "Bah, suerte de principiante."],
    juego: ["¡Tomá!", "Eso es cancha."],
    tacha: ["La tacho, total…", "Esa no la quería igual."],
    gana: ["¿Viste? Volvé cuando entrenes.", "Dados son dados, y yo los tengo."],
    pierde: ["Hoy tenés el día.", "La próxima te paso por arriba."],
  },
  implacable: {
    empieza: ["Tiro.", "Cuento todo."],
    generala: ["Generala.", "Cinco."],
    servida: ["Servida.", "Fin."],
    otro_generala: ["Improbable.", "Bien."],
    juego: ["Esperado.", "Anotado."],
    tacha: ["Tacho. Calculado.", "Cero, a propósito."],
    gana: ["Partida.", "Fin."],
    pierde: ["Bien jugado.", "Otra."],
  },
};

/** Quién comenta qué (solo hablan los bots; la sala elige quién es bot). */
export function charla(ev, n) {
  const out = [];
  for (const e of ev) {
    if (e.t === "servida") out.push({ j: e.jugador, momento: "servida", chance: 0.95 });
    else if (e.t === "anota") {
      if ((e.cat === "G" || e.cat === "DG") && e.puntos > 0) {
        out.push({ j: e.jugador, momento: "generala", chance: 0.9 });
        for (let k = 0; k < n; k++) if (k !== e.jugador) out.push({ j: k, momento: "otro_generala", chance: 0.25 });
      } else if (e.puntos === 0) out.push({ j: e.jugador, momento: "tacha", chance: 0.4 });
      else if (M.servible(e.cat)) out.push({ j: e.jugador, momento: "juego", chance: 0.35 });
    } else if (e.t === "fin") for (let k = 0; k < n; k++) out.push({ j: k, momento: e.ganadores.includes(k) ? "gana" : e.orden?.[e.orden.length - 1] === k ? "pierde" : "", chance: 0.9 });
  }
  return out.filter((c) => c.momento);
}

// ---------- limpieza de lo que llega por la red ----------
const ent = (x, max = 1000, min = 0) => (Number.isInteger(x) && x >= min && x <= max ? x : 0);
const num = (x) => (Number.isFinite(x) ? x : 0);
const asiento = (x, n) => (Number.isInteger(x) && x >= 0 && x < n ? x : null);
const asientos = (a, n) => (Array.isArray(a) ? a.slice(0, 6).map((x) => asiento(x, n)).filter((x) => x !== null) : []);
const dado = (d) => Number.isInteger(d) && d >= 1 && d <= 6;
const dados = (a) => (Array.isArray(a) ? a.slice(0, M.DADOS).filter(dado) : []);
const indices = (a) => (Array.isArray(a) ? [...new Set(a.slice(0, M.DADOS).filter((i) => Number.isInteger(i) && i >= 0 && i < M.DADOS))] : []);
const catOk = (c) => (M.COMPLETA.includes(c) ? c : null);
function planillaLimpia(p, cats) {
  const out = {};
  for (const c of cats) { const x = p?.[c]; out[c] = Number.isInteger(x) && x >= 0 && x <= 100 ? x : null; }
  return out;
}

export function accionLimpia(a) {
  if (!a || typeof a !== "object") return null;
  if (a.t === "tirar") return { t: "tirar", guardar: indices(a.guardar) };
  if (a.t === "anotar" && catOk(a.cat)) return { t: "anotar", cat: a.cat };
  return null;
}
export function vistaLimpia(v, yo, n) {
  const tipo = v.tipo === "corta" ? "corta" : "completa";
  const cats = tipo === "corta" ? M.CORTA : M.COMPLETA;
  const planillas = Array.from({ length: n }, (_, k) => planillaLimpia(Array.isArray(v.planillas) ? v.planillas[k] : null, cats));
  const u = v.ultima && typeof v.ultima === "object" && catOk(v.ultima.cat)
    ? { jugador: asiento(v.ultima.jugador, n) ?? 0, cat: v.ultima.cat, puntos: ent(v.ultima.puntos, 100), servida: v.ultima.servida === true, dados: dados(v.ultima.dados) } : null;
  return {
    juego: "generala", n, yo, nombres: Array(n).fill(""),
    fase: v.fase === "fin" ? "fin" : "jugar", turno: asiento(v.turno, n), turnoDesde: num(v.turnoDesde),
    tipo, cats: [...cats], planillas, totales: planillas.map(M.sumar),
    tiro: ent(v.tiro, M.TIROS), dados: dados(v.dados), guardados: indices(v.guardados), ultima: u,
    servida: asiento(v.servida, n), ganador: asiento(v.ganador, n), ganadores: asientos(v.ganadores, n), orden: asientos(v.orden, n),
    puedoTirar: v.puedoTirar === true, puedoAnotar: v.puedoAnotar === true, seq: ent(v.seq, 1e9),
  };
}
export function eventosLimpios(ev, n) {
  const out = [];
  for (const e of Array.isArray(ev) ? ev.slice(0, 20) : []) {
    if (!e || typeof e !== "object") continue;
    const j = asiento(e.jugador, n) ?? 0;
    switch (e.t) {
      case "turno": out.push({ t: "turno", jugador: j }); break;
      case "tiro": out.push({ t: "tiro", jugador: j, dados: dados(e.dados), guardados: indices(e.guardados), tiro: ent(e.tiro, M.TIROS) }); break;
      case "anota": if (catOk(e.cat)) out.push({ t: "anota", jugador: j, cat: e.cat, puntos: ent(e.puntos, 100), servida: e.servida === true, dados: dados(e.dados) }); break;
      case "servida": out.push({ t: "servida", jugador: j, cara: dado(e.cara) ? e.cara : 1 }); break;
      case "fin": out.push({ t: "fin", ganador: asiento(e.ganador, n), ganadores: asientos(e.ganadores, n), orden: asientos(e.orden, n), servida: asiento(e.servida, n) }); break;
      case "revancha": out.push({ t: "revancha" }); break;
      case "quiere_revancha": out.push({ t: "quiere_revancha", jugador: j }); break;
      case "no_revancha": out.push({ t: "no_revancha", jugador: j }); break;
      default:
    }
  }
  return out;
}

export const generala = {
  id: "generala", nombre: "Generala", min: 2, max: 6,
  nuevaPartida: M.nuevaPartida, aplicar: M.aplicar, vista: M.vista, bot,
  frases: FRASES, charla, accionLimpia, vistaLimpia, eventosLimpios,
};
