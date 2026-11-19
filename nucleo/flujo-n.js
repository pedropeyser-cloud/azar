// Pantallas comunes de los juegos de a varios (2026-11-18): menú (contra qué bots jugás o invitar amigos), sala de espera
// con los lugares de la ronda e ingreso por link (`?sala=…&juego=<id>`). Cada juego le pasa su adaptador (motor, bots,
// limpieza; ver nucleo/sala-n.js), su mesa y sus textos.
// ctx = { yo() → { nombre, estilo, id }, volver(), alFin?(...) }
import { crearAnfitrionN, entrarComoInvitadoN, crearLocalN, DIFS, personaje } from "./sala-n.js";
import { sonido } from "./sonido.js";
import { solBot } from "./caras.js";
import { PERSONAJES } from "../juegos/chin/personajes.js";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const leer = (k, def) => { try { return localStorage.getItem(k) ?? def; } catch { return def; } };
const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ok */ } };
const errorSala = (e) => (["network", "server-error", "socket-error", "socket-closed"].includes(e?.type)
  ? "No pude conectar con el servidor de salas. Revisá tu internet y probá de nuevo."
  : "No se pudo armar la sala. Probá de nuevo.");

/**
 * @param {{ A: object, montarMesa: (cont, o) => () => void, titulo: string, lema: string, reglas: string,
 *   notaBot?: Record<string, string>, opciones?: () => object, clase?: string,
 *   elecciones?: { clave: string, etiqueta: string, valores: [string, string, string?][], def: string }[] }} cfg
 * `elecciones`: opciones que se eligen en el menú con botones (la planilla de la generala); se recuerdan y van a
 * `nuevaPartida` con su `clave`, contra los bots y en la sala con amigos.
 * Devuelve { menu(app, ctx), entrar(app, codigo, ctx), cerrar(), contraBots(app, ctx, { bots, semilla }) }.
 */
export function crearFlujo({ A, montarMesa, titulo, lema, reglas, notaBot = {}, opciones: extra = () => ({}), clase = "", elecciones = [] }) {
  let baja = null;
  const leerEleccion = (x) => { const v = leer(`${A.id}.${x.clave}`, x.def); return x.valores.some(([k]) => k === v) ? v : x.def; };
  const opciones = () => ({ ...Object.fromEntries(elecciones.map((x) => [x.clave, leerEleccion(x)])), ...extra() });   // lo de la URL (pruebas) manda
  const eleccionesHTML = () => elecciones.map((x) => `<div class="grupo eleccion-n" data-clave="${esc(x.clave)}"><span class="etiqueta">${esc(x.etiqueta)}</span>
    <div class="elecciones-n" role="radiogroup" aria-label="${esc(x.etiqueta)}">${x.valores.map(([v, t, nota]) => `<button type="button" class="eleccion" role="radio" data-v="${esc(v)}" aria-checked="${leerEleccion(x) === v}"><b>${esc(t)}</b>${nota ? `<small>${esc(nota)}</small>` : ""}</button>`).join("")}</div></div>`).join("");
  const CLAVE_BOTS = `${A.id}.bots`;
  const botsGuardados = () => { const x = leer(CLAVE_BOTS, "rapido").split(",").filter((d) => DIFS.includes(d)); return x.length ? x : ["rapido"]; };
  const cerrar = () => { if (baja) { baja(); baja = null; } };

  function menu(app, ctx) {
    cerrar();
    let elegidos = botsGuardados();
    app.innerHTML = `
      <main class="inicio juego-menu menu-n ${clase}">
        <h1 class="sello">${esc(titulo)}</h1>
        <p class="lema">${lema}</p>
        ${eleccionesHTML()}
        <div class="grupo">
          <span class="etiqueta">contra los bots: elegí con quiénes (uno, dos o los tres)</span>
          <div class="dificultades">${DIFS.map((k) => `<button class="dif" data-k="${k}" aria-pressed="${elegidos.includes(k)}">${solBot(k, PERSONAJES[k].nombre)}<b>${PERSONAJES[k].nombre}</b><small>${esc(notaBot[k] || PERSONAJES[k].lema)}</small></button>`).join("")}</div>
          <button class="boton primario jugar"></button>
        </div>
        <div class="grupo">
          <span class="etiqueta">con amigos por link: de ${A.min} a ${A.max} en la mesa; los lugares que quieras los completan bots</span>
          <button class="boton amigos">Invitar amigos por link</button>
        </div>
        <details class="reglas"><summary>Cómo se juega</summary>${reglas}</details>
        <button class="boton suave volver">← Volver al inicio</button>
      </main>`;
    const jugar = app.querySelector(".jugar");
    const pintarJugar = () => { const n = elegidos.length + 1; jugar.textContent = `Jugar de a ${n}`; jugar.disabled = !elegidos.length; };
    pintarJugar();
    app.querySelectorAll(".dif").forEach((b) => b.addEventListener("click", () => {
      const k = b.dataset.k;
      elegidos = elegidos.includes(k) ? elegidos.filter((x) => x !== k) : DIFS.filter((d) => d === k || elegidos.includes(d));
      if (!elegidos.length) elegidos = [k];   // al menos uno
      app.querySelectorAll(".dif").forEach((x) => x.setAttribute("aria-pressed", elegidos.includes(x.dataset.k)));
      guardar(CLAVE_BOTS, elegidos.join(","));
      pintarJugar();
    }));
    app.querySelectorAll(".eleccion-n").forEach((g) => g.addEventListener("click", (e) => {
      const b = e.target.closest(".eleccion");
      if (!b) return;
      guardar(`${A.id}.${g.dataset.clave}`, b.dataset.v);
      g.querySelectorAll(".eleccion").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    }));
    jugar.addEventListener("click", () => contraBots(app, ctx, { bots: elegidos }));
    app.querySelector(".amigos").addEventListener("click", () => invitar(app, ctx));
    app.querySelector(".volver").addEventListener("click", () => ctx.volver());
  }

  function contraBots(app, ctx, { bots = botsGuardados(), semilla } = {}) {
    sonido.despertar();
    cerrar();
    const p = ctx.yo();
    const fuente = crearLocalN(A, { bots, nombre: p.nombre, estilo: p.estilo, semilla, opciones: { ...opciones() } });
    window.__fuente = fuente;   // pruebas
    const desmontar = montarMesa(app, { fuente, salir: ctx.volver, otraMesa: () => menu(app, ctx) });
    baja = () => { desmontar(); fuente.destruir(); };
  }

  function compartir(app, link) {
    const input = app.querySelector(".link");
    app.querySelector(".copiar").addEventListener("click", async (e) => {
      try { await navigator.clipboard.writeText(link); e.target.textContent = "¡Copiado!"; }
      catch { input.select(); e.target.textContent = "Seleccionado: copialo"; }
    });
    if (navigator.share) {
      const b = app.querySelector(".compartir");
      b.hidden = false;
      b.addEventListener("click", () => navigator.share({ title: titulo, text: `¿Un ${titulo.toLowerCase()}? Entrá con este link.`, url: link }).catch(() => {}));
    }
  }

  function sillasHTML(sillas, yo, editable) {
    return `<ol class="ronda-n">${sillas.map((s, j) => {
      const quien = s.tipo === "bot" ? "bot" : j === yo ? "vos" : s.tipo === "anfitrion" ? "armó la sala" : "amigo";
      const cara = s.tipo === "bot" ? solBot(s.bot, s.nombre) : `<span class="luna-n">${esc(s.nombre.slice(0, 1).toUpperCase())}</span>`;
      return `<li class="lugar ${s.tipo}${j === yo ? " mio" : ""}" data-j="${j}">${cara}<b>${esc(s.nombre)}</b><i>${quien}</i>
        ${editable && s.tipo === "bot" ? `<span class="lugar-acc"><button class="boton chico" data-otro="${j}">Otro</button><button class="boton chico" data-sacar="${j}" aria-label="Sacar a ${esc(s.nombre)}">Sacar</button></span>` : ""}</li>`;
    }).join("")}</ol>`;
  }

  function invitar(app, ctx) {
    sonido.despertar();
    cerrar();
    const a = crearAnfitrionN(ctx.yo(), A, { bots: botsGuardados(), opciones: opciones() });
    window.__anfitrion = a;   // pruebas
    baja = () => a.cerrar();
    app.innerHTML = `
      <main class="inicio sala sala-n ${clase}">
        <h1 class="sello chico">${esc(titulo)}</h1>
        <p class="lema" id="estado">Armando la sala…</p>
        <div class="grupo" id="compartir" hidden>
          <span class="etiqueta">mandales este link a tus amigos (hasta ${A.max - 1})</span>
          <input class="link" readonly value="${esc(a.link)}" aria-label="Link de la sala">
          <button class="boton primario copiar">Copiar link</button>
          <button class="boton compartir" hidden>Compartir…</button>
        </div>
        <div class="sillas"></div>
        <button class="boton suave sumar">+ Sumar un bot</button>
        <button class="boton primario empezar" disabled>Empezar</button>
        <button class="boton suave volver">Cancelar</button>
      </main>`;
    const estado = app.querySelector("#estado"), sillasEl = app.querySelector(".sillas"), empezar = app.querySelector(".empezar"), sumar = app.querySelector(".sumar");
    let abierta = false;
    const pintar = () => {
      const s = a.sillas();
      sillasEl.innerHTML = sillasHTML(s, 0, true);
      sumar.hidden = !a.puedeSumarBot();
      empezar.disabled = !abierta || !a.puedeEmpezar();
      const p = a.personas(), nb = s.filter((x) => x.tipo === "bot").length;
      empezar.textContent = s.length < A.min ? `Faltan ${A.min - s.length} para empezar` : `Empezar de a ${s.length}${p ? ` (${p} ${p === 1 ? "amigo" : "amigos"}${nb ? ` y ${nb} ${nb === 1 ? "bot" : "bots"}` : ""})` : ""}`;
    };
    sillasEl.addEventListener("click", (e) => {
      const o = e.target.closest("[data-otro]"), q = e.target.closest("[data-sacar]");
      if (o) a.cambiarBot(Number(o.dataset.otro));
      else if (q) a.sacarBot(Number(q.dataset.sacar));
    });
    sumar.addEventListener("click", () => a.sumarBot());
    a.alSala(pintar);
    a.alAbrir(() => {
      abierta = true;
      estado.textContent = "Esperando a tus amigos. Podés sumar o sacar bots.";
      app.querySelector("#compartir").hidden = false;
      pintar();
    });
    a.alError((e) => { estado.textContent = errorSala(e); });
    pintar();
    empezar.addEventListener("click", () => {
      if (!a.empezar()) return;
      const mesa = montarMesa(app, { fuente: a.fuente, salir: ctx.volver });
      window.__fuente = a.fuente;
      baja = () => { mesa(); a.cerrar(); };
    });
    compartir(app, a.link);
    app.querySelector(".volver").addEventListener("click", () => ctx.volver());
  }

  function entrar(app, codigo, ctx) {
    sonido.despertar();
    cerrar();
    const inv = entrarComoInvitadoN(codigo, ctx.yo(), A);
    baja = () => inv.fuente.destruir();
    app.innerHTML = `<main class="inicio sala sala-n ${clase}"><h1 class="sello chico">${esc(titulo)}</h1><p class="lema" id="estado">Entrando a la sala…</p><div class="sillas"></div><button class="boton suave volver">Cancelar</button></main>`;
    app.querySelector(".volver").addEventListener("click", () => { inv.fuente.irse(); ctx.volver(); });
    inv.alSala((s) => {
      const t = app.querySelector("#estado"), el = app.querySelector(".sillas");
      if (!t || s.tuya === null) return;
      t.textContent = `Ya estás en la mesa de ${s.sillas[0]?.nombre || "tu amigo"}. Esperando que arranque…`;
      el.innerHTML = sillasHTML(s.sillas, s.tuya, false);
    });
    inv.alError((e) => {
      const t = app.querySelector("#estado");
      if (!t) return;
      t.textContent = e?.type === "lleno" ? "Esa mesa ya está completa."
        : e?.type === "empezada" ? "Esa partida ya empezó sin vos."
        : e?.type === "peer-unavailable" ? "Todavía no encuentro la sala. Si tu amigo recién la armó, esperá unos segundos: sigo intentando."
        : "No pude conectar. Sigo intentando…";
    });
    inv.alListo(() => {
      const mesa = montarMesa(app, { fuente: inv.fuente, salir: ctx.volver });
      window.__fuente = inv.fuente;
      baja = () => { mesa(); inv.fuente.destruir(); };
    });
  }

  return { menu, entrar, cerrar, contraBots, personaje };
}
