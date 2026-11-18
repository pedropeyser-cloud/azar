// Sala de 2 a 6 lugares para los juegos de a varios sin parejas (siete y medio, culo sucio, desconfío; 2026-11-18).
// Generaliza la estrella de la escoba de a 4 (juegos/escoba/red4-fuente.js): el anfitrión tiene el estado completo, es
// el árbitro y hace jugar a los bots; cada invitado manda sus jugadas y recibe solo su vista.
//
// Sala de espera: el anfitrión está en el lugar 0. Los que entran se suman al final de la ronda. El anfitrión puede
// sumar o sacar bots (hasta 3, uno por personaje) y cambiarle el personaje a un bot. La mesa es de `min` a `max`.
// Si un invitado se va (o se le corta y no vuelve en 15 s), juega un bot por él. Si se va el anfitrión, se termina.
// Todo lo que llega de otro navegador se limpia antes de usarse: la sala acá, la vista y los eventos con el adaptador.
//
// Adaptador de cada juego (ver docs/contrato-juego.md, «Juegos de a varios»):
//   { id, nombre, min, max, nuevaPartida(opts), aplicar, reloj, vista, bot(estado, j, ahora, dif),
//     frases: { [dif]: { momento: [textos] } }, charla(eventos, n) → [{ j, momento, chance }],
//     accionLimpia(a) → accion|null, vistaLimpia(v, yo, n), eventosLimpios(ev, n) }
import { abrirSalaVarios, entrarSala, codigoNuevo, linkDe } from "./red.js";
import { valido as emoteValido, tope as topeEmote } from "./emotes.js";
import { limpiarEstilo } from "../juegos/chin/red-fuente.js";
import { PERSONAJES } from "../juegos/chin/personajes.js";

const ahora = () => performance.now();
const azar = (a) => a[Math.floor(Math.random() * a.length)];
export const limpiarNombre = (s) => String(s ?? "").replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, 16) || "Jugador";
const idOk = (x) => (typeof x === "string" && /^[0-9a-f-]{36}$/.test(x) ? x : null);
const claveOk = (x) => (typeof x === "string" && /^[a-z0-9]{8,24}$/.test(x) ? x : null);
export const DIFS = ["tranquilo", "rapido", "implacable"];
export const MAX_BOTS = 3;
/** Nombre y cara de un bot (los mismos tres personajes del Chin). */
export const personaje = (dif) => { const p = PERSONAJES[dif] || PERSONAJES.rapido; return { nombre: p.nombre, cara: p.cara }; };
const asientoOk = (x, n) => (Number.isInteger(x) && x >= 0 && x < n ? x : null);

const jugLimpio = (x) => ({ nombre: limpiarNombre(x?.nombre), estilo: limpiarEstilo(x?.estilo), id: idOk(x?.id), bot: DIFS.includes(x?.bot) ? x.bot : undefined });
/** La sala de espera que manda el anfitrión: quién está en cada lugar. */
export function salaLimpia(s, max = 6) {
  const lista = Array.isArray(s?.sillas) ? s.sillas.slice(0, max) : [];
  const sillas = lista.map((x) => ({ tipo: ["anfitrion", "persona", "bot"].includes(x?.tipo) ? x.tipo : "bot", nombre: limpiarNombre(x?.nombre), bot: DIFS.includes(x?.bot) ? x.bot : null }));
  return { sillas, tuya: asientoOk(s?.tuya, sillas.length) };
}

function base() {
  const subs = new Set(), subsE = new Set(), subsC = new Set(), subsD = new Set();
  return {
    subs, subsE, subsC, subsD,
    suscribir(fn) { subs.add(fn); return () => subs.delete(fn); },
    suscribirEmote(fn) { subsE.add(fn); return () => subsE.delete(fn); },
    suscribirConexion(fn) { subsC.add(fn); return () => subsC.delete(fn); },
    suscribirDicho(fn) { subsD.add(fn); return () => subsD.delete(fn); },
    conexion(e) { subsC.forEach((f) => f(e)); },
    limpiar() { subs.clear(); subsE.clear(); subsC.clear(); subsD.clear(); },
  };
}

/** Quién dice qué y cuándo: un bot habla como mucho cada 4 s, salvo al final. */
export function hablador(frasesDe, enviar) {
  let ultimo = 0;
  return function decir(j, dif, momento, chance = 1) {
    if (Math.random() > chance) return;
    const t = ahora(), final = momento === "gana" || momento === "pierde";
    if (!final && t - ultimo < 4000) return;
    ultimo = t;
    const txt = azar(frasesDe(dif)?.[momento] || []);
    if (txt) setTimeout(() => enviar(j, txt), 700 + Math.random() * 500 + (final ? j * 500 : 0));
  };
}

/**
 * Anfitrión. Devuelve { codigo, link, fuente, sillas(), personas(), sumarBot(), sacarBot(j), cambiarBot(j), alAbrir,
 * alSala, alError, puedeEmpezar(), empezar(), cerrar() }. `opciones` va a `nuevaPartida` (pruebas: partidas cortas).
 */
export function crearAnfitrionN(yo, A, { opciones = {}, bots = ["rapido"] } = {}) {
  const b = base();
  const codigo = codigoNuevo();
  const yoLimpio = { nombre: limpiarNombre(yo.nombre), estilo: limpiarEstilo(yo.estilo), id: idOk(yo.id) };
  const datosBot = (s) => { const pj = personaje(s.bot); s.nombre = pj.nombre; s.estilo = { cara: pj.cara }; s.id = null; return s; };
  // cada silla: { tipo, cid?, clave?, nombre, estilo, id, bot }
  const sillas = [{ tipo: "anfitrion", ...yoLimpio }, ...bots.filter((d, k, a) => DIFS.includes(d) && a.indexOf(d) === k).slice(0, Math.min(MAX_BOTS, A.max - 1)).map((d) => datosBot({ tipo: "bot", bot: d }))];
  const porCid = new Map();                 // cid → silla (objeto) o null si todavía no dijo hola
  const pings = new Map(), cortes = new Map();
  let estado = null, timer = null, abierta = false, empezada = false;
  let quieren = [];
  const topeE = topeEmote();
  const aviso = { sala: null, error: null, abrio: null };
  const asientoDe = (s) => sillas.indexOf(s);
  const esBot = (j) => sillas[j]?.tipo === "bot";
  const jug = () => sillas.map((s) => ({ nombre: s.nombre, estilo: s.estilo || {}, id: s.id || null, ...(s.tipo === "bot" ? { bot: s.bot } : {}) }));
  const nombres = () => sillas.map((s) => s.nombre);
  const salaPara = (j) => ({ t: "sala", sillas: sillas.map((s) => ({ tipo: s.tipo, nombre: s.nombre, bot: s.tipo === "bot" ? s.bot : null })), tuya: j });
  function avisarSala() {
    sillas.forEach((s, j) => { if (s.tipo === "persona" && s.cid) sala.enviar(s.cid, salaPara(j)); });
    aviso.sala?.();
  }
  const mandarA = (j, ev) => { const s = sillas[j]; if (s.tipo === "persona" && s.cid) sala.enviar(s.cid, { t: "vista", v: A.vista(estado, j), ev, jug: jug(), yo: j, n: sillas.length, th: ahora() }); };
  const decir = hablador((dif) => A.frases[dif], (j, txt) => dicho(j, txt));
  function dicho(j, txt) { b.subsD.forEach((f) => f(txt, j)); sala.todos({ t: "dicho", j, txt }); }
  function comentar(ev) { for (const c of A.charla(ev, sillas.length)) if (esBot(c.j)) decir(c.j, sillas[c.j].bot, c.momento, c.chance); }
  function emitir(ev) {
    b.subs.forEach((f) => f(A.vista(estado, 0), ev));
    for (let j = 1; j < sillas.length; j++) mandarA(j, ev);
    comentar(ev);
  }
  function aplicarReal(j, accion) {
    try {
      const r = A.aplicar(estado, j, accion, ahora());
      if (r.rechazo) return { motivo: r.rechazo.motivo, mensaje: r.rechazo.mensaje };
      estado = r.estado;
      emitir(r.eventos);
    } catch { return { motivo: "mal", mensaje: "Esa jugada no se puede." }; }
    return null;
  }
  let inicial = [];
  function nueva() {
    estado = A.nuevaPartida({ ...opciones, jugadores: sillas.length, nombres: nombres(), ahora: ahora() });
    inicial = estado.eventosIniciales || [];
    quieren = sillas.map(() => false);
  }
  function quiereRevancha(j) {
    if (!estado || estado.fase !== "fin") return;
    quieren[j] = true;
    if (sillas.every((s, k) => s.tipo === "bot" || quieren[k])) { nueva(); emitir([{ t: "revancha" }, ...inicial]); }
    else emitir([{ t: "quiere_revancha", jugador: j }]);
  }
  /** Un invitado se fue: en la sala de espera se libera su lugar; con la partida empezada, juega un bot por él. */
  function liberar(j, seFue = true) {
    const s = sillas[j];
    if (!s || s.tipo !== "persona") return;
    const nombreAntes = s.nombre;
    if (!empezada) { sillas.splice(j, 1); recontar(); avisarSala(); return; }
    const dif = DIFS.find((d) => !sillas.some((x) => x.tipo === "bot" && x.bot === d)) || "rapido";
    Object.assign(s, { tipo: "bot", bot: dif, cid: null, clave: null });
    datosBot(s);
    estado.nombres[j] = s.nombre;
    quieren[j] = false;
    emitir([]);
    if (seFue) dicho(j, `${nombreAntes} se fue: juego yo en su lugar.`);
    if (estado.fase === "fin" && quieren.some(Boolean)) quiereRevancha(quieren.findIndex(Boolean));
  }
  /** Después de sacar una silla, los cid siguen apuntando al mismo objeto: no hay que tocar nada. */
  function recontar() { /* porCid guarda la silla, no el número */ }

  /** Se cerró (o dejó de latir) la conexión de un invitado. */
  function seCorto(cid) {
    const s = porCid.get(cid);
    porCid.delete(cid); pings.delete(cid);
    if (!s || s.cid !== cid) return;
    s.cid = null;
    const j = asientoDe(s);
    if (!empezada) { liberar(j, false); return; }
    clearTimeout(cortes.get(s));
    cortes.set(s, setTimeout(() => { if (s.tipo === "persona" && !s.cid) liberar(asientoDe(s)); }, 15000));
  }

  const sala = abrirSalaVarios(codigo, A.max - 1, {
    alAbrir: () => { abierta = true; aviso.abrio?.(); },
    alEntrar: (cid) => {
      porCid.set(cid, null); pings.set(cid, ahora());
      // el que se conecta y no se presenta en 8 s no ocupa lugar
      setTimeout(() => { if (porCid.has(cid) && porCid.get(cid) === null) { porCid.delete(cid); pings.delete(cid); sala.cortar(cid); } }, 8000);
    },
    alSalir: (cid) => seCorto(cid),
    alError: (e) => aviso.error?.(e),
    alMensaje: (cid, m) => {
      const s = porCid.get(cid);
      const j = s ? asientoDe(s) : null;
      switch (m.t) {
        case "hola": {
          if (s) return;
          const clave = claveOk(m.clave);
          const datos = { nombre: limpiarNombre(m.nombre), estilo: limpiarEstilo(m.estilo), id: idOk(m.id) };
          // vuelve alguien que se había cortado: a su lugar
          let silla = clave ? sillas.find((x) => x.tipo === "persona" && x.clave === clave) : null;
          if (silla) { clearTimeout(cortes.get(silla)); silla.cid = cid; }
          else {
            if (empezada) { sala.enviar(cid, { t: "empezada" }); setTimeout(() => sala.cortar(cid), 300); return; }
            if (sillas.length >= A.max) {
              // la mesa está llena: si hay un bot, la persona le saca el lugar
              const k = sillas.map((x, i) => (x.tipo === "bot" ? i : -1)).filter((i) => i > 0).pop();
              if (k === undefined) { sala.enviar(cid, { t: "lleno" }); setTimeout(() => sala.cortar(cid), 300); return; }
              sillas.splice(k, 1);
            }
            silla = { tipo: "persona", cid, clave, bot: null, ...datos };
            // las personas van antes que los bots (los bots cierran la ronda)
            const primerBot = sillas.findIndex((x, i) => i > 0 && x.tipo === "bot");
            if (primerBot < 0) sillas.push(silla); else sillas.splice(primerBot, 0, silla);
          }
          porCid.set(cid, silla);
          if (empezada) { const k = asientoDe(silla); estado.nombres[k] = silla.nombre; mandarA(k, [{ t: "revancha" }]); emitir([]); b.conexion("conectado"); }
          else avisarSala();
          break;
        }
        case "ping":
          pings.set(cid, ahora());
          sala.enviar(cid, { t: "pong", t0: m.t0, th: ahora() });
          break;
        case "accion": {
          if (!estado || j === null || j < 0) return;
          const a = A.accionLimpia(m.a);
          sala.enviar(cid, { t: "resp", n: m.n, r: a ? aplicarReal(j, a) : { motivo: "mal", mensaje: "Esa jugada no se puede." } });
          break;
        }
        case "revancha": if (j !== null && j >= 0) quiereRevancha(j); break;
        case "no_revancha":
          if (!estado || estado.fase !== "fin" || j === null || j < 0) return;
          quieren.fill(false);
          emitir([{ t: "no_revancha", jugador: j }]);
          break;
        case "emote":
          if (j === null || j < 0 || !emoteValido(m.k) || !topeE(j)) return;
          b.subsE.forEach((f) => f(m.k, j));
          sala.todos({ t: "emote", k: m.k, j }, cid);
          break;
        case "me_voy":
          if (j === null || j < 0) return;
          porCid.delete(cid); s.cid = null;
          liberar(j);
          sala.cortar(cid);
          break;
        default:
      }
    },
  });

  const fuente = {
    yo: 0, esLocal: false, esAnfitrion: true, ahora, formato: 1,
    get nombres() { return estado ? estado.nombres : nombres(); },
    get inicial() { return inicial; },
    vista: () => A.vista(estado, 0),
    jugadores: jug,
    enviar: (accion) => aplicarReal(0, accion),
    suscribir: b.suscribir, suscribirEmote: b.suscribirEmote, suscribirConexion: b.suscribirConexion, suscribirDicho: b.suscribirDicho,
    emote(k) { if (emoteValido(k)) sala.todos({ t: "emote", k, j: 0 }); },
    revancha() { quiereRevancha(0); },
    declinar() { if (!estado || estado.fase !== "fin") return; quieren.fill(false); emitir([{ t: "no_revancha", jugador: 0 }]); },
    irse() { try { sala.todos({ t: "me_voy" }); } catch { /* ya no hay canal */ } },
    latencia: () => 0,
    _estado: () => estado,   // pruebas
    destruir() { clearInterval(timer); cortes.forEach((t) => clearTimeout(t)); sala.cerrar(); b.limpiar(); },
  };

  const libres = () => DIFS.filter((d) => !sillas.some((x) => x.tipo === "bot" && x.bot === d));
  const nBots = () => sillas.filter((s) => s.tipo === "bot").length;
  return {
    codigo, link: linkDe(codigo, A.id), fuente,
    sillas: () => sillas.map((s) => ({ tipo: s.tipo, nombre: s.nombre, bot: s.tipo === "bot" ? s.bot : null })),
    personas: () => sillas.filter((s) => s.tipo === "persona").length,
    puedeSumarBot: () => !empezada && sillas.length < A.max && nBots() < MAX_BOTS && libres().length > 0,
    puedeEmpezar: () => !empezada && sillas.length >= A.min,
    sumarBot() { if (!this.puedeSumarBot()) return; sillas.push(datosBot({ tipo: "bot", bot: libres()[0] })); avisarSala(); },
    sacarBot(j) { if (empezada || !esBot(j)) return; sillas.splice(j, 1); avisarSala(); },
    /** El bot de ese lugar pasa al siguiente personaje que no esté sentado. */
    cambiarBot(j) {
      if (empezada || !esBot(j)) return;
      const l = libres();
      if (!l.length) return;
      const orden = [...DIFS.slice(DIFS.indexOf(sillas[j].bot) + 1), ...DIFS];
      sillas[j].bot = orden.find((d) => l.includes(d));
      datosBot(sillas[j]);
      avisarSala();
    },
    alAbrir(fn) { aviso.abrio = fn; if (abierta) fn(); },
    alSala(fn) { aviso.sala = fn; },
    alError(fn) { aviso.error = fn; },
    empezar() {
      if (empezada || sillas.length < A.min) return false;
      empezada = true;
      nueva();
      timer = setInterval(() => {
        if (!estado) return;
        const t = ahora();
        if (estado.fase !== "fin") {
          for (let j = 1; j < sillas.length; j++) {
            if (!esBot(j)) continue;
            const a = A.bot(estado, j, t, sillas[j].bot);
            if (!a) continue;
            const r = A.aplicar(estado, j, a, t);
            if (!r.rechazo) { estado = r.estado; emitir(r.eventos); break; }
          }
        }
        if (A.reloj) { const rr = A.reloj(estado, t); if (rr.eventos.length) { estado = rr.estado; emitir(rr.eventos); } }
        for (const [cid, t0] of pings) {
          const s = porCid.get(cid);
          if (s && t - t0 > 9000 && s.cid === cid) { seCorto(cid); sala.cortar(cid); }
        }
      }, 60);
      for (let j = 1; j < sillas.length; j++) mandarA(j, [{ t: "revancha" }, ...inicial]);
      setTimeout(() => { const j = sillas.findIndex((s) => s.tipo === "bot"); if (j > 0) decir(j, sillas[j].bot, "empieza", 0.8); }, 900);
      return true;
    },
    cerrar: fuente.destruir,
  };
}

/** Invitado. Devuelve { fuente, alSala(fn(sala)), alListo(fn), alError(fn) }; `fuente.yo` es su lugar. */
export function entrarComoInvitadoN(codigo, yo, A) {
  const b = base();
  let v = null, offset = 0, rtt = 0, n = 0, miAsiento = null, cuantos = 2;
  let jug = [], nombres = [];
  const pend = new Map();
  let ultimoPong = 0, cortadoAviso = false, vigia = null, pingT = null, listo = null, error = null, enSala = null;
  const topeE = topeEmote();
  const CLAVE = `${A.id}.${codigo}`;
  let clave = null;
  try { clave = sessionStorage.getItem(CLAVE); } catch { /* ok */ }
  if (!claveOk(clave)) {
    clave = Array.from(crypto.getRandomValues(new Uint8Array(12)), (x) => "abcdefghjkmnpqrstuvwxyz23456789"[x % 31]).join("");
    try { sessionStorage.setItem(CLAVE, clave); } catch { /* ok */ }
  }

  const sala = entrarSala(codigo, {
    alConectar: () => {
      sala.enviar({ t: "hola", nombre: yo.nombre, estilo: yo.estilo, id: yo.id, clave });
      const ping = () => sala.enviar({ t: "ping", t0: ahora(), rtt });
      ping();
      clearInterval(pingT); pingT = setInterval(ping, 2500);
      ultimoPong = ahora();
      clearInterval(vigia);
      vigia = setInterval(() => { if (!cortadoAviso && ahora() - ultimoPong > 7000) { cortadoAviso = true; b.conexion("cortado"); } }, 1000);
      b.conexion("conectado");
    },
    alCortar: () => b.conexion("cortado"),
    alError: (e) => error?.(e),
    alMensaje: (m) => {
      switch (m.t) {
        case "sala": enSala?.(salaLimpia(m, A.max)); break;
        case "vista": {
          if (!m.v || typeof m.v !== "object") return;
          const nn = Number.isInteger(m.n) && m.n >= A.min && m.n <= A.max ? m.n : null;
          if (!nn) return;
          const a = asientoOk(m.yo, nn);
          if (a === null || a === 0) return;
          miAsiento = a; cuantos = nn;
          v = A.vistaLimpia(m.v, miAsiento, cuantos);
          if (Array.isArray(m.jug) && m.jug.length === cuantos) { jug = m.jug.map(jugLimpio); nombres = jug.map((x) => x.nombre); }
          v.nombres = nombres;
          if (listo) { const f = listo; listo = null; f(); }
          b.subs.forEach((f) => f(v, A.eventosLimpios(m.ev, cuantos)));
          break;
        }
        case "pong": {
          const t1 = ahora();
          ultimoPong = t1;
          if (cortadoAviso) { cortadoAviso = false; b.conexion("conectado"); }
          rtt = Math.max(0, t1 - m.t0);
          if (Number.isFinite(m.th)) offset = m.th + rtt / 2 - t1;
          break;
        }
        case "resp": {
          const r = pend.get(m.n);
          if (r) { pend.delete(m.n); r(m.r && typeof m.r.mensaje === "string" ? { motivo: String(m.r.motivo), mensaje: m.r.mensaje.slice(0, 120) } : null); }
          break;
        }
        case "emote": { const j = asientoOk(m.j, cuantos); if (j !== null && j !== miAsiento && emoteValido(m.k) && topeE(j)) b.subsE.forEach((f) => f(m.k, j)); break; }
        case "dicho": { const j = asientoOk(m.j, cuantos); if (j !== null && typeof m.txt === "string") b.subsD.forEach((f) => f(m.txt.replace(/[\u0000-\u001f<>]/g, "").slice(0, 140), j)); break; }
        case "lleno": error?.({ type: "lleno" }); break;
        case "empezada": error?.({ type: "empezada" }); break;
        case "me_voy": clearInterval(pingT); clearInterval(vigia); b.conexion("se_fue"); break;
        default:
      }
    },
  });

  const fuente = {
    get yo() { return miAsiento ?? 1; },
    esLocal: false, esAnfitrion: false, formato: 1, inicial: [],
    ahora: () => ahora() + offset,
    get nombres() { return nombres; },
    vista: () => v,
    jugadores: () => jug,
    enviar(accion) {
      return new Promise((res) => {
        const id = ++n;
        pend.set(id, res);
        sala.enviar({ t: "accion", a: accion, n: id });
        setTimeout(() => { if (pend.delete(id)) res(null); }, 4000);
      });
    },
    suscribir: b.suscribir, suscribirEmote: b.suscribirEmote, suscribirConexion: b.suscribirConexion, suscribirDicho: b.suscribirDicho,
    emote(k) { if (emoteValido(k)) sala.enviar({ t: "emote", k }); },
    revancha() { sala.enviar({ t: "revancha" }); },
    declinar() { sala.enviar({ t: "no_revancha" }); },
    irse() { try { sala.enviar({ t: "me_voy" }); } catch { /* ya no hay canal */ } try { sessionStorage.removeItem(CLAVE); } catch { /* ok */ } },
    latencia: () => Math.round(rtt / 2),
    destruir() { clearInterval(pingT); clearInterval(vigia); sala.cerrar(); b.limpiar(); },
  };
  return { fuente, alSala(fn) { enSala = fn; }, alListo(fn) { if (v) fn(); else listo = fn; }, alError(fn) { error = fn; } };
}

/**
 * Fuente LOCAL: vos (lugar 0) contra los bots de `bots` (uno por personaje, en ese orden). Misma interfaz que la de red.
 * `opciones` va a `nuevaPartida`; `semilla` fija el reparto (pruebas); `pausado` frena a los bots (pruebas).
 */
export function crearLocalN(A, { bots = ["rapido"], nombre = "Vos", estilo = {}, opciones = {}, semilla, callado = false, pausado = false } = {}) {
  const difs = [null, ...bots.filter((d, k, a) => DIFS.includes(d) && a.indexOf(d) === k).slice(0, Math.min(MAX_BOTS, A.max - 1))];
  const pjs = difs.map((d) => (d ? personaje(d) : null));
  const nombres = difs.map((d, j) => (j === 0 ? nombre : pjs[j].nombre));
  const b = base();
  let estado = null, botPausado = !!pausado;
  const decir = hablador((dif) => A.frases[dif], (j, txt) => b.subsD.forEach((f) => f(txt, j)));
  const comentar = (ev) => { if (!callado) for (const c of A.charla(ev, difs.length)) if (c.j > 0) decir(c.j, difs[c.j], c.momento, c.chance); };
  const emitir = (ev) => { const v = A.vista(estado, 0); b.subs.forEach((f) => f(v, ev)); comentar(ev); };
  const nueva = (sem) => { estado = A.nuevaPartida({ ...opciones, jugadores: difs.length, nombres, ahora: performance.now(), semilla: sem }); };
  function pulso() {
    if (estado.fase === "fin") return;
    const t = performance.now();
    if (!botPausado) {
      for (let j = 1; j < difs.length; j++) {
        const a = A.bot(estado, j, t, difs[j]);
        if (!a) continue;
        const r = A.aplicar(estado, j, a, t);
        if (!r.rechazo) { estado = r.estado; emitir(r.eventos); break; }
      }
    }
    if (A.reloj) { const rr = A.reloj(estado, t); if (rr.eventos.length) { estado = rr.estado; emitir(rr.eventos); } }
  }
  nueva(semilla);
  const inicial = estado.eventosIniciales || [];
  const timer = setInterval(pulso, 60);
  setTimeout(() => { if (difs[1]) decir(1, difs[1], "empieza", 0.9); }, 900);
  return {
    yo: 0, nombres, esLocal: true, esAnfitrion: true, formato: 1, inicial, bots: difs.slice(1),
    ahora: () => performance.now(),
    vista: () => A.vista(estado, 0),
    enviar(accion) {
      try {
        const r = A.aplicar(estado, 0, accion, performance.now());
        if (r.rechazo) return r.rechazo;
        estado = r.estado;
        emitir(r.eventos);
      } catch { return { motivo: "mal", mensaje: "Esa jugada no se puede." }; }
      return null;
    },
    suscribir: b.suscribir, suscribirEmote: b.suscribirEmote, suscribirDicho: b.suscribirDicho, suscribirConexion() { return () => {}; },
    jugadores: () => difs.map((d, j) => (j === 0 ? { nombre, estilo, id: null } : { nombre: nombres[j], estilo: { cara: pjs[j].cara }, id: null, bot: d })),
    emote() {},
    latencia: () => 0,
    pausarBot(v) { botPausado = !!v; },                         // pruebas
    _armar(e) { estado = e; emitir([{ t: "revancha" }]); },     // pruebas
    _estado: () => estado,                                      // pruebas
    revancha() { nueva(); emitir([{ t: "revancha" }, ...(estado.eventosIniciales || [])]); },
    declinar() {},
    irse() {},
    destruir() { clearInterval(timer); b.limpiar(); },
  };
}
