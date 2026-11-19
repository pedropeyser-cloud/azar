// DESCONFÍO, el dudo de AZAR (etapa 5, 2026-11-18). Motor puro: sin DOM, sin red, sin Date.now().
// Reglas completas en docs/desconfio/reglas.md. En corto:
//   - 5 dados por cabeza, tapados. Se apuesta «cuántos hay de un número entre todos»; los ases son comodines.
//   - Subir: más cantidad, o misma cantidad y número más alto. A ases con la mitad (para arriba); de ases, doble más uno.
//   - «¡Desconfío!»: si hay menos, pierde un dado el que apostó; si hay al menos eso, el que desconfió.
//   - «¡Confío!»: si hay justo eso, el que confió recupera un dado (tope 5); si no, lo pierde él.
//   - Obligada: la primera vez que alguien queda con un dado, abre él, los ases no son comodines y no se cambia el número.
//   - Gana el último con dados.

export const juego = { id: "desconfio", nombre: "Desconfío", jugadores: [2, 6] };
export const DADOS = 5;
export const CARAS = [1, 2, 3, 4, 5, 6];

const UNIDADES = ["", "un", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce", "quince",
  "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte", "veintiún", "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis",
  "veintisiete", "veintiocho", "veintinueve", "treinta"];
const NOMBRE = { 1: ["as", "ases"], 2: ["dos", "doses"], 3: ["tres", "treses"], 4: ["cuatro", "cuatros"], 5: ["cinco", "cincos"], 6: ["seis", "seises"] };
/** «cuatro cincos», «un as», «tres ases». */
export function dicho(c, cara) { const [s, p] = NOMBRE[cara] || ["?", "?"]; return `${UNIDADES[c] ?? c} ${c === 1 ? s : p}`; }
export const nombreCara = (cara, plural = true) => (NOMBRE[cara] || ["?", "?"])[plural ? 1 : 0];
export const cantidad = (c) => (c === 1 ? "uno" : UNIDADES[c] === "veintiún" ? "veintiuno" : UNIDADES[c] ?? String(c));

function rng(semilla) {
  let s = semilla >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const copia = (e) => JSON.parse(JSON.stringify(e));
const rechazo = (e, motivo, mensaje) => ({ estado: e, eventos: [], rechazo: { motivo, mensaje } });
const ordenar = (ds) => [...ds].sort((a, b) => a - b);

/** ¿`nueva` sube a `prev`? (prev null = abrir). Devuelve null si sí, o el motivo en palabras. */
export function porQueNo(prev, nueva, total, obligada) {
  const { c, cara } = nueva;
  if (!Number.isInteger(c) || c < 1 || !CARAS.includes(cara)) return "Apuesta mal armada.";
  if (c > total) return `En la mesa hay ${total} dados.`;
  if (!prev) return cara === 1 && !obligada ? "No se abre con ases." : null;
  if (obligada) return cara !== prev.cara ? "En la obligada no se cambia el número: subí la cantidad." : c > prev.c ? null : "Tenés que decir más.";
  if (prev.cara !== 1 && cara !== 1) return c > prev.c || (c === prev.c && cara > prev.cara) ? null : "Subí la cantidad o, con la misma cantidad, un número más alto.";
  if (prev.cara !== 1 && cara === 1) return c >= Math.ceil(prev.c / 2) ? null : `A ases, por lo menos ${dicho(Math.ceil(prev.c / 2), 1)}.`;
  if (cara === 1) return c > prev.c ? null : "Entre ases, subí la cantidad.";
  return c >= prev.c * 2 + 1 ? null : `Para salir de ases, por lo menos ${dicho(prev.c * 2 + 1, cara)}.`;
}
export const esValida = (prev, nueva, total, obligada) => porQueNo(prev, nueva, total, obligada) === null;

/** Todas las subidas válidas (para la pantalla y los bots), de la más chica a la más grande en cada número. */
export function subidas(prev, total, obligada) {
  const out = [];
  for (const cara of CARAS) for (let c = 1; c <= total; c++) if (esValida(prev, { c, cara }, total, obligada)) { out.push({ c, cara }); }
  return out;
}
/** La subida más chica con ese número (o null). */
export function minimaCon(prev, cara, total, obligada) {
  for (let c = 1; c <= total; c++) if (esValida(prev, { c, cara }, total, obligada)) return c;
  return null;
}

/** Cuántos dados cuentan para `cara` (con los ases de comodín, salvo apostando a ases o en la obligada). */
export function contar(todos, cara, obligada) {
  let k = 0;
  for (const ds of todos) for (const d of ds) if (d === cara || (d === 1 && cara !== 1 && !obligada)) k++;
  return k;
}

const vivos = (e) => e.cuantos.map((c, j) => (c > 0 ? j : -1)).filter((j) => j >= 0);
const total = (e) => e.cuantos.reduce((s, c) => s + c, 0);
function siguiente(e, j) { for (let k = 1; k <= e.n; k++) { const x = (j + k) % e.n; if (e.cuantos[x] > 0) return x; } return null; }

/** Tira los dados de la ronda `e.rondaN` (o usa los fijos de `e.tiradas`, pruebas). */
function tirar(e) {
  const fijos = e.tiradas?.[e.rondaN - 1];
  const r = rng((e.semilla + e.rondaN * 7919) >>> 0);
  e.dados = e.cuantos.map((c, j) => (fijos?.[j] ? ordenar(fijos[j].slice(0, c)) : ordenar(Array.from({ length: c }, () => 1 + Math.floor(r() * 6)))));
}

/** Opciones: { jugadores (2 a 6), nombres, semilla, ahora, abre, pausaRevelar = 4200, dados = 5, tiradas (pruebas) } */
export function nuevaPartida({ jugadores = 2, nombres, semilla, ahora = 0, abre, pausaRevelar = 4200, dados = DADOS, tiradas } = {}) {
  const n = Math.max(2, Math.min(6, jugadores | 0));
  const sem = (semilla ?? Math.floor(Math.random() * 2 ** 31)) >>> 0;
  const d = Math.max(1, Math.min(DADOS, dados | 0));
  const e = {
    n, nombres: (nombres || []).slice(0, n).concat(Array(n).fill("Jugador")).slice(0, n),
    cuantos: Array(n).fill(d), dados: [], semilla: sem, rondaN: 1, tiradas: tiradas || null,
    fase: "apostar", turno: Number.isInteger(abre) ? abre % n : Math.floor(rng(sem ^ 0x9e3779b9)() * n), turnoDesde: ahora,
    apuesta: null, cadena: [], obligada: false, yaObligada: Array(n).fill(false),
    revelar: null, pausaRevelar, fuera: [], ganador: null, seq: 0,
  };
  tirar(e);
  e.eventosIniciales = [{ t: "ronda", abre: e.turno, ronda: 1, obligada: false }];
  return e;
}

/** Acciones: { t: "apostar", c, cara } · { t: "desconfio" } · { t: "confio" }. Todas en tu turno. */
export function aplicar(e0, j, a, ahora = 0) {
  if (!a || typeof a !== "object" || !Number.isInteger(j) || j < 0 || j >= e0.n) throw new Error("acción mal formada");
  if (e0.fase === "fin") return rechazo(e0, "fin", "La partida terminó.");
  if (e0.fase === "revelar") return rechazo(e0, "revelando", "Esperá, se están contando los dados.");
  if (e0.turno !== j) return rechazo(e0, "no_es_tu_turno", "No es tu turno.");
  const e = copia(e0), ev = [];

  if (a.t === "apostar") {
    const nueva = { c: a.c, cara: a.cara };
    const no = porQueNo(e.apuesta, nueva, total(e), e.obligada);
    if (no) return rechazo(e0, "apuesta", no);
    e.apuesta = { c: a.c, cara: a.cara, jugador: j };
    e.cadena.push({ ...e.apuesta });
    ev.push({ t: "apuesta", jugador: j, c: a.c, cara: a.cara });
    e.turno = siguiente(e, j); e.turnoDesde = ahora;
    e.seq++;
    return { estado: e, eventos: ev };
  }

  if (a.t === "desconfio" || a.t === "confio") {
    if (!e.apuesta) return rechazo(e0, "sin_apuesta", "Primero alguien tiene que apostar.");
    const { c, cara, jugador: de } = e.apuesta;
    const hay = contar(e.dados, cara, e.obligada);
    let pierde = null, gana = null;
    if (a.t === "desconfio") pierde = hay >= c ? j : de;
    else if (hay === c) gana = e.cuantos[j] < DADOS ? j : null;
    else pierde = j;
    const acierta = a.t === "desconfio" ? pierde === de : hay === c;
    e.revelar = { tipo: a.t, quien: j, de, c, cara, hay, obligada: e.obligada, dados: copia(e.dados), pierde, gana, acierta, hasta: ahora + e.pausaRevelar };
    e.fase = "revelar"; e.turno = null;
    ev.push({ t: a.t, jugador: j, de, c, cara, hay, pierde, gana, acierta, dados: copia(e.dados) });
    e.seq++;
    return { estado: e, eventos: ev };
  }
  throw new Error("acción desconocida");
}

/** Cierra la vuelta: saca o devuelve el dado, ve si alguien salió o ganó, y tira la ronda nueva. */
export function reloj(e0, ahora) {
  if (e0.fase !== "revelar" || ahora < e0.revelar.hasta) return { estado: e0, eventos: [] };
  const e = copia(e0), ev = [];
  const { pierde, gana, quien } = e.revelar;
  if (pierde !== null) { e.cuantos[pierde]--; ev.push({ t: "pierde_dado", jugador: pierde, quedan: e.cuantos[pierde] }); }
  if (gana !== null) { e.cuantos[gana] = Math.min(DADOS, e.cuantos[gana] + 1); ev.push({ t: "gana_dado", jugador: gana, quedan: e.cuantos[gana] }); }
  if (pierde !== null && e.cuantos[pierde] === 0) { e.fuera.push(pierde); ev.push({ t: "sale", jugador: pierde, puesto: e.n - e.fuera.length + 1 }); }
  e.revelar = null; e.apuesta = null; e.cadena = [];
  const vs = vivos(e);
  if (vs.length === 1) {
    e.fase = "fin"; e.ganador = vs[0]; e.turno = null; e.obligada = false;
    ev.push({ t: "fin", ganador: e.ganador, orden: [e.ganador, ...[...e.fuera].reverse()] });
    e.seq++;
    return { estado: e, eventos: ev };
  }
  // quién abre
  let abre = pierde === null ? quien : e.cuantos[pierde] > 0 ? pierde : siguiente(e, pierde);
  e.obligada = false;
  if (pierde !== null && e.cuantos[pierde] === 1 && !e.yaObligada[pierde] && vs.some((k) => e.cuantos[k] > 1)) {
    e.obligada = true; e.yaObligada[pierde] = true; abre = pierde;
  }
  e.rondaN++;
  tirar(e);
  e.fase = "apostar"; e.turno = abre; e.turnoDesde = ahora;
  ev.push({ t: "ronda", abre, ronda: e.rondaN, obligada: e.obligada });
  e.seq++;
  return { estado: e, eventos: ev };
}

/** Lo que ve `yo`: sus dados; de los demás, cuántos tienen; al cantar, todos. */
export function vista(e, yo) {
  const enJuego = e.fase === "apostar" && e.turno === yo;
  return {
    juego: "desconfio", n: e.n, yo, nombres: [...e.nombres], fase: e.fase, turno: e.turno, turnoDesde: e.turnoDesde,
    ronda: e.rondaN, mios: [...(e.dados[yo] || [])], cuantos: [...e.cuantos], total: total(e),
    apuesta: e.apuesta ? { ...e.apuesta } : null, cadena: e.cadena.map((x) => ({ ...x })), obligada: e.obligada,
    revelar: e.revelar ? copia(e.revelar) : null, fuera: [...e.fuera], ganador: e.ganador,
    ganadores: e.fase === "fin" ? [e.ganador] : [],
    orden: e.fase === "fin" ? [e.ganador, ...[...e.fuera].reverse()] : [],
    puedoApostar: enJuego, puedoCantar: enJuego && !!e.apuesta,
    seq: e.seq,
  };
}
