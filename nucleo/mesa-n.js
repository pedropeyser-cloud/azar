// Esqueleto de mesa para los juegos de a varios (2 a 6; siete y medio, culo sucio, desconfío — 2026-11-18).
// Los demás se sientan en arco arriba, en el orden de la ronda: el que te sigue (a tu derecha) queda a la derecha y el
// arco sigue por arriba hasta el de tu izquierda. Vos abajo, con tu zona (tus cartas o dados) y los controles.
// Cada juego pinta lo suyo con `pintar(v, ev, partes)`; el esqueleto pone caras, nombres, globos de los bots, salir con
// «¿Te vas?», el aviso de conexión, el grito grande y la pantalla final con revancha.
import { cara, formaDeJugador } from "./caras.js";
import { sonido } from "./sonido.js";
import * as pantalla from "./pantalla.js";

const el = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const QUIETO = matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * @param {HTMLElement} cont
 * @param {{ fuente, salir: () => void, otraMesa?: () => void, clase: string, titulo: string,
 *   pintar: (v, ev, partes) => void, alEventos?: (v, ev, partes) => void, final: (v) => { titulo: string, gane: boolean, html: string } }} o
 * `partes` = { mesa, silla(j), sillaCartas(j), sillaExtra(j), centro, miZona, miExtra, controles, aviso(txt, ms), grito(txt), yo, n, rel(j), nombre(j) }
 */
export function montarMesaN(cont, { fuente, salir, otraMesa, clase, titulo, pintar, alEventos, final }) {
  const yo = fuente.yo;
  let v = fuente.vista();
  const n = v.n;
  const rel = (j) => (j - yo + n) % n;
  let jug = fuente.jugadores();
  const formas = () => jug.map((j, i) => formaDeJugador(j, [2, 4, 1, 5, 0, 3][i % 6]));
  const nombre = (j) => (v.nombres?.[j] || jug[j]?.nombre || "Jugador");

  cont.innerHTML = "";
  // los demás, de izquierda a derecha en pantalla: el de mi izquierda (rel n-1) … el de mi derecha (rel 1)
  const orden = Array.from({ length: n - 1 }, (_, k) => (yo + n - 1 - k) % n);
  const mesa = el(`
    <div class="mesa-n ${clase}" data-n="${n}">
      <header class="franja-n">
        <button type="button" class="icono salir-btn" aria-label="Salir de la partida" title="Salir de la partida">←</button>
        <div class="titulo-n"><b>${esc(titulo)}</b><small class="estado-n" aria-live="polite"></small></div>
        ${pantalla.sePuede() ? `<button type="button" class="icono pantalla-n" aria-label="Pantalla completa" title="Pantalla completa">${pantalla.iconoPantalla()}</button>` : ""}
        <button type="button" class="icono sonido-btn" aria-label="Sonido"></button>
      </header>
      <div class="rivales-n">${orden.map((j) => `
        <div class="silla-n" data-j="${j}">
          <div class="cara-slot"><span class="burbuja"></span></div>
          <div class="silla-quien"><b class="nom"></b><span class="silla-extra"></span></div>
          <div class="silla-cartas"></div>
        </div>`).join("")}
      </div>
      <div class="centro-n"></div>
      <div class="yo-n">
        <div class="mi-zona"></div>
        <div class="mi-pie">
          <div class="cara-slot mia"><span class="burbuja"></span></div>
          <div class="mi-quien"><b class="nom"></b><span class="mi-extra"></span></div>
          <div class="controles-n"></div>
        </div>
      </div>
      <div class="grito-n" aria-live="assertive"></div>
      <div class="aviso-n" aria-live="polite"></div>
      <div class="corte-n" hidden>Se cortó la conexión. Reintentando…</div>
      <div class="fin-n" hidden role="dialog" aria-modal="true"></div>
      <div class="fin-n dejar-n" hidden role="dialog" aria-modal="true"></div>
    </div>`);
  cont.append(mesa);
  const $ = (s) => mesa.querySelector(s);
  const silla = (j) => (j === yo ? $(".yo-n") : mesa.querySelector(`.silla-n[data-j="${j}"]`));
  const caraSlot = (j) => (j === yo ? $(".cara-slot.mia") : silla(j)?.querySelector(".cara-slot"));

  function pintarCaras() {
    const f = formas();
    for (let j = 0; j < n; j++) {
      const slot = caraSlot(j);
      if (!slot) continue;
      const burbuja = slot.querySelector(".burbuja");
      slot.querySelectorAll("svg").forEach((x) => x.remove());
      slot.insertAdjacentHTML("afterbegin", cara(f[j], nombre(j)));   // cara() escapa la etiqueta
      slot.append(burbuja);
      const nom = j === yo ? $(".mi-quien .nom") : silla(j).querySelector(".nom");
      nom.textContent = j === yo ? (jug[j]?.nombre && jug[j].nombre !== "Jugador" ? jug[j].nombre : "Vos") : nombre(j);
    }
  }

  let tAviso = 0, tGrito = 0;
  const partes = {
    mesa, yo, n, rel, nombre, silla,
    sillaCartas: (j) => (j === yo ? $(".mi-zona") : silla(j).querySelector(".silla-cartas")),
    sillaExtra: (j) => (j === yo ? $(".mi-extra") : silla(j).querySelector(".silla-extra")),
    centro: $(".centro-n"), miZona: $(".mi-zona"), miExtra: $(".mi-extra"), controles: $(".controles-n"),
    estado: (txt) => { $(".estado-n").textContent = txt; },
    aviso(txt, ms = 2600) { const a = $(".aviso-n"); a.textContent = txt; a.classList.add("ver"); clearTimeout(tAviso); tAviso = setTimeout(() => a.classList.remove("ver"), ms); },
    grito(txt, ms = 1500) { const g = $(".grito-n"); g.textContent = txt; g.classList.remove("ver"); void g.offsetWidth; g.classList.add("ver"); clearTimeout(tGrito); tGrito = setTimeout(() => g.classList.remove("ver"), ms); },
    /** Marca de quién es el turno (borde de oro en su silla). */
    turno(j) { mesa.querySelectorAll(".silla-n, .yo-n").forEach((x) => x.classList.toggle("en-turno", x === silla(j))); },
    enviar: async (accion) => { const r = await fuente.enviar(accion); if (r) { sonido.play("rechazo"); partes.aviso(r.mensaje); } return r; },
  };

  // globos de los bots (y de los que se van)
  const tBurbuja = new Map();
  const quitarDicho = fuente.suscribirDicho?.((txt, j) => {
    const b = caraSlot(j)?.querySelector(".burbuja");
    if (!b) return;
    b.textContent = txt; b.classList.add("ver");
    clearTimeout(tBurbuja.get(j)); tBurbuja.set(j, setTimeout(() => b.classList.remove("ver"), 3200));
  }) || (() => {});
  const quitarConexion = fuente.suscribirConexion?.((e) => {
    $(".corte-n").hidden = e !== "cortado";
    if (e === "se_fue") { $(".corte-n").hidden = false; $(".corte-n").textContent = "El que armó la mesa se fue. La partida terminó."; }
  }) || (() => {});

  // sonido
  const btnSonido = $(".sonido-btn");
  const pintarSonido = () => { btnSonido.textContent = sonido.mudo ? "🔇" : "🔊"; btnSonido.setAttribute("aria-pressed", String(!sonido.mudo)); };
  btnSonido.addEventListener("click", () => { sonido.setMudo(!sonido.mudo); pintarSonido(); });
  pintarSonido();

  // pantalla completa: solo con el botón (Pedro, 2026-11-18); el flotante de los otros juegos se esconde en esta mesa
  document.body.classList.add("con-mesa-n");
  const btnPantalla = $(".pantalla-n");
  const pintarPantalla = () => { if (btnPantalla) { btnPantalla.innerHTML = pantalla.iconoPantalla(); btnPantalla.setAttribute("aria-label", pantalla.enCompleta() ? "Salir de pantalla completa" : "Pantalla completa"); } };
  btnPantalla?.addEventListener("click", () => pantalla.alternar());
  document.addEventListener("fullscreenchange", pintarPantalla);

  // salir con confirmación
  const dejar = $(".dejar-n");
  $(".salir-btn").addEventListener("click", () => {
    if (v.fase === "fin") { irse(); return; }
    dejar.innerHTML = `<div class="fin-caja"><h2>¿Te vas?</h2><p>${fuente.esLocal ? "La partida se pierde." : "En tu lugar va a jugar un bot."}</p>
      <div class="fin-botones"><button class="boton primario quedar">Me quedo</button><button class="boton suave irme">Me voy</button></div></div>`;
    dejar.hidden = false;
    dejar.querySelector(".quedar").addEventListener("click", () => { dejar.hidden = true; });
    dejar.querySelector(".irme").addEventListener("click", irse);
  });
  function irse() { try { fuente.irse?.(); } catch { /* ok */ } salir(); }

  // pantalla final
  const fin = $(".fin-n:not(.dejar-n)");
  let quierenRevancha = new Set(), yaPedi = false;
  function pintarFinal() {
    if (v.fase !== "fin") { fin.hidden = true; return; }
    const f = final(v);
    const esperando = !fuente.esLocal && yaPedi;
    const otros = [...quierenRevancha].filter((j) => j !== yo).map(nombre);
    fin.innerHTML = `<div class="fin-caja"><h2>${esc(f.titulo)}</h2>${f.html}
      ${otros.length ? `<p class="fin-nota">${esc(otros.join(", "))} ${otros.length === 1 ? "quiere" : "quieren"} la revancha.</p>` : ""}
      <div class="fin-botones">
        <button class="boton primario revancha" ${esperando ? "disabled" : ""}>${esperando ? "Esperando a los demás…" : "Revancha"}</button>
        ${fuente.esLocal && otraMesa ? `<button class="boton otra">Cambiar de bots</button>` : ""}
        <button class="boton suave salir-fin">Salir</button>
      </div></div>`;
    fin.hidden = false;
    fin.querySelector(".revancha").addEventListener("click", () => { yaPedi = true; fuente.revancha(); pintarFinal(); });
    fin.querySelector(".otra")?.addEventListener("click", () => otraMesa());
    fin.querySelector(".salir-fin").addEventListener("click", irse);
  }

  function alVista(nv, ev) {
    v = nv;
    if (!v) return;
    for (const e of ev) {
      if (e.t === "revancha") { quierenRevancha = new Set(); yaPedi = false; jug = fuente.jugadores(); pintarCaras(); }
      else if (e.t === "quiere_revancha") quierenRevancha.add(e.jugador);
      else if (e.t === "no_revancha") { quierenRevancha = new Set(); yaPedi = false; partes.aviso(`${nombre(e.jugador)} no quiere la revancha.`); }
    }
    const jj = fuente.jugadores();
    if (jj.some((x, k) => x?.nombre !== jug[k]?.nombre || x?.bot !== jug[k]?.bot)) { jug = jj; pintarCaras(); }
    if (ev.length) alEventos?.(v, ev, partes);
    pintar(v, ev, partes);
    pintarFinal();
    if (ev.some((e) => e.t === "fin")) sonido.play(v.ganador === yo || v.ganadores?.includes(yo) ? "gane" : "perdi");
  }
  pintarCaras();
  const quitar = fuente.suscribir(alVista);
  alVista(v, fuente.inicial || []);
  if (QUIETO) mesa.classList.add("quieto");

  return () => { document.body.classList.remove("con-mesa-n"); document.removeEventListener("fullscreenchange", pintarPantalla); quitar(); quitarDicho(); quitarConexion(); tBurbuja.forEach((t) => clearTimeout(t)); clearTimeout(tAviso); clearTimeout(tGrito); mesa.remove(); };
}
