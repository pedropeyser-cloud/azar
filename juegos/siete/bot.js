// Bots del siete y medio. Cuentan las cartas que ven (las suyas y las boca arriba de los demás) para saber qué queda.
//   Don Tranqui (tranquilo): apuesta 1 o 2 sin mirar la tapada y pide de más (hasta 5½).
//   Rata (rapido): mira la tapada a medias y se planta con 5.
//   El Relámpago (implacable): apuesta fuerte solo con un 7 tapado, se planta con 4 y de banca calcula qué le conviene
//   contra lo que ve en la mesa (una carta adelante).
import { MAZO40, valor, total, SIETE_Y_MEDIO, acciones } from "./motor.js";

const DEMORA = { tranquilo: [1500, 2600], rapido: [600, 1200], implacable: [900, 1700] };
/** Una demora fija por turno (no cambia en cada pulso): sale del número de jugada. */
function demora(e, dif) { const [a, b] = DEMORA[dif] || DEMORA.rapido; const x = ((e.seq * 9301 + 49297) % 233280) / 233280; return a + (b - a) * x; }

/** Las cartas que este jugador no vio todavía (quedan en el mazo o son tapadas ajenas). */
function noVistas(e, j) {
  const vistas = new Set();
  e.cartas.forEach((cs, k) => cs.forEach((c, i) => { if (k === j || i > 0 || e.paso[k]) vistas.add(c); }));
  return MAZO40.filter((c) => !vistas.has(c));
}
/** Probabilidad de pasarse si pide una carta más con `t`. */
function riesgo(t, quedan) { if (!quedan.length) return 1; return quedan.filter((c) => t + valor(c) > SIETE_Y_MEDIO).length / quedan.length; }

// Lo que dio la simulación (2026-11-18): el jugador corre con desventaja salvo con un 7 tapado (+0,65 por poroto), una
// figura (+0,14) o un 6 (+0,09). Apostar fuerte con cualquier carta es regalarle porotos a la banca.
function apuesta(e, j, dif) {
  const max = Math.min(5, e.porotos[j]);
  const v = valor(e.cartas[j][0]);
  let n;
  if (dif === "tranquilo") n = 1 + ((e.seq + j) % 2);                                  // 1 o 2, sin mirar la tapada
  else if (dif === "rapido") n = v === 7 ? 3 : v === 0.5 ? 2 : 1 + ((e.seq + j) % 2);   // mira la tapada a medias
  else n = v === 7 ? 5 : v === 0.5 ? 3 : v === 6 ? 2 : 1;                              // juega lo que conviene
  return Math.max(1, Math.min(max, n));
}

/** Cuánto gana o pierde la banca plantándose con `tb` contra los que siguen en pie (estimando sus tapadas). */
function valorPlantarse(e, b, tb, quedan) {
  let s = 0;
  e.cartas.forEach((cs, k) => {
    if (k === b || e.paso[k] || e.apuesta[k] === null || e.porotos[k] + (e.apuesta[k] || 0) <= 0) return;
    if (!cs.length) return;
    const visible = total(cs.slice(1)), ap = e.apuesta[k] || 0;
    // su tapada puede ser cualquiera de las que la banca no vio (y no lo pasó: si no, ya se habría pasado)
    const posibles = quedan.filter((c) => visible + valor(c) <= SIETE_Y_MEDIO);
    if (!posibles.length) return;
    const gana = posibles.filter((c) => visible + valor(c) <= tb).length / posibles.length;
    s += ap * (gana - (1 - gana));
  });
  return s;
}

export function bot(e, j, ahora, dif = "rapido") {
  const acc = acciones(e, j);
  if (!acc.length) return null;
  const desde = e.fase === "apuesta" ? e.faseDesde : e.turnoDesde;
  if (ahora - desde < demora(e, dif) + (e.fase === "apuesta" ? j * 250 : 0)) return null;
  if (e.fase === "apuesta") return { t: "apostar", n: apuesta(e, j, dif) };

  const t = total(e.cartas[j]);
  const quedan = noVistas(e, j);
  if (t >= SIETE_Y_MEDIO) return { t: "plantarse" };
  if (t <= 3) return { t: "carta" };
  const p = riesgo(t, quedan);

  if (j === e.banca) {
    if (dif === "tranquilo") return t < 5 ? { t: "carta" } : { t: "plantarse" };
    if (dif === "rapido") return t < 5.5 ? { t: "carta" } : { t: "plantarse" };
    // El Relámpago de banca: plantarse o pedir una más (mirando una carta adelante)
    const quieto = valorPlantarse(e, j, t, quedan);
    let pidiendo = 0;
    for (const c of quedan) { const nt = t + valor(c); pidiendo += nt > SIETE_Y_MEDIO ? -e.apuesta.reduce((s, x, k) => s + (k !== j && !e.paso[k] && x ? x : 0), 0) : valorPlantarse(e, j, nt, quedan.filter((x) => x !== c)); }
    pidiendo /= quedan.length || 1;
    return pidiendo > quieto ? { t: "carta" } : { t: "plantarse" };
  }

  // como jugador: plantarse temprano rinde más (la banca gana los empates)
  if (dif === "tranquilo") return t < 5.5 && p < 0.55 ? { t: "carta" } : { t: "plantarse" };
  if (dif === "rapido") return t < 5 ? { t: "carta" } : { t: "plantarse" };
  return t < 4 ? { t: "carta" } : { t: "plantarse" };
}
