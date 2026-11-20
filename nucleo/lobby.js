// Inicio de AZAR (identidad «Eclipse», etapa 4, 2026-11-18). A pantalla completa en compu y celular, sin scroll:
//   arriba la marca, «Jugar» y «Vos», el sonido, la pantalla completa y tu luna;
//   el cielo con el eclipse (nucleo/cielo.js) detrás del saludo; las cuatro barajas sobre el mostrador con la franja de luz;
//   «Seguir» (tu última partida con un amigo) abajo; la columna «Amigos» a la derecha (abajo en el celular).
// «Vos» es un panel encima: entrar con Google, elegir usuario, historial, cerrar sesión o borrar la cuenta.
// AZAR no tiene tienda: lo que se consigue con la gloria vive solo adentro del truco y se llama «Tienda».
import { JUEGOS, juegoPorId } from "./registro.js";
import * as nube from "./nube.js";
import { ambiente } from "./ambiente.js";
import { anclar, abrirCielo, destello } from "./cielo.js";
import * as pantalla from "./pantalla.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Signos de las barajas: trazo fino, como en la maqueta de la identidad.
const PALO = {
  espada: `<path d="M32 6v40M24 46h16M32 46v10M28 56h8"/><path d="M29 12l3-6 3 6"/>`,
  oro: `<circle cx="32" cy="32" r="16"/><circle cx="32" cy="32" r="8"/>`,
  copa: `<path d="M20 12h24c0 12-5 20-12 20s-12-8-12-20zM32 32v14M24 52h16M27 46h10"/>`,
  basto: `<path d="M30 8c6 6-4 12 2 18s-6 10 0 16 -4 10 2 14"/><path d="M27 20l8-3M26 34l9-2"/>`,
  // juegos de a varios (etapa 5): media luna rayada (siete y medio), dos cartas cruzadas (culo sucio), un dado (desconfío)
  medio: `<circle cx="32" cy="32" r="17"/><path d="M32 15v34M26 18v28M20 24v16"/>`,
  culo: `<rect x="16" y="14" width="22" height="32" rx="3"/><rect x="27" y="20" width="22" height="32" rx="3" transform="rotate(12 38 36)"/>`,
  dado: `<rect x="15" y="15" width="34" height="34" rx="7"/><circle cx="24" cy="24" r="2.4"/><circle cx="32" cy="32" r="2.4"/><circle cx="40" cy="40" r="2.4"/>`,
  // generala: una planilla con renglones y un dado del cinco apoyado encima
  // chinchón: tres cartas seguidas en abanico y, en la del medio, el sol tapado del comodín
  chinchon: `<rect x="10" y="16" width="20" height="30" rx="3" transform="rotate(-14 20 46)"/><rect x="34" y="16" width="20" height="30" rx="3" transform="rotate(14 44 46)"/><rect x="22" y="10" width="20" height="30" rx="3"/><circle cx="32" cy="25" r="5"/><circle cx="32" cy="25" r="7.6" stroke-dasharray="2 2.2"/>`,
  planilla: `<rect x="12" y="8" width="30" height="44" rx="3"/><path d="M17 17h20M17 24h20M17 31h12"/><rect x="30" y="34" width="22" height="22" rx="5" transform="rotate(-10 41 45)"/><circle cx="36" cy="40" r="1.8"/><circle cx="46" cy="38.4" r="1.8"/><circle cx="41" cy="45" r="1.8"/><circle cx="36.2" cy="51.4" r="1.8"/><circle cx="46.4" cy="49.6" r="1.8"/>`,
};
const signo = (p) => `<svg class="signo" viewBox="0 0 64 64" aria-hidden="true">${PALO[p] || PALO.oro}</svg>`;
const MEDIALUNA = `<svg class="medialuna" viewBox="0 0 32 32" aria-hidden="true"><path d="M21 4.5A12.5 12.5 0 1 0 27.5 21 10 10 0 1 1 21 4.5z"/></svg>`;
const ICO_SONIDO = (on) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/>${on ? '<path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>' : '<path d="M16 9.5l5 5M21 9.5l-5 5"/>'}</svg>`;

// La fase de la luna dice dónde está cada amigo (las personas son lunas; los bots, soles).
const FASE = {
  juega: { txt: "jugando", luna: `<circle cx="7" cy="7" r="6" fill="#E9B54A"/>` },
  on: { txt: "en AZAR", luna: `<circle cx="7" cy="7" r="6" fill="#C7CCE4"/><circle cx="10" cy="5" r="5" fill="#121629"/>` },
  rec: { txt: "pasó hoy", luna: `<circle cx="7" cy="7" r="5.4" fill="none" stroke="#8A90AE" stroke-width="1.2"/>` },
  off: { txt: "hace rato", luna: `<circle cx="7" cy="7" r="5.4" fill="none" stroke="#565C7A" stroke-width="1.2" stroke-dasharray="1.6 1.8"/>` },
};
const fase = (e) => `<svg class="fase" viewBox="0 0 14 14" aria-hidden="true">${(FASE[e] || FASE.rec).luna}</svg>`;
const luna = (nombre, e) => `<span class="luna">${esc(String(nombre || "?").slice(0, 1).toUpperCase())}${e ? fase(e) : ""}</span>`;

function saludoHora() {
  const h = new Date().getHours();
  return h < 6 ? "Buenas noches" : h < 13 ? "Buen día" : h < 20 ? "Buenas tardes" : "Buenas noches";
}

export function montarLobby(app, { abrirJuego, tab: tabInicial = "jugar" }) {
  let vos = tabInicial === "vos", aviso = "", cargando = false, partidas = null, partidasTruco = null, confirmarBorrado = false;
  let amigos = null, vivo = true, conectadosAntes = new Set(), sondeo = null;

  function toast(txt) { aviso = txt; pintarAviso(); setTimeout(() => { if (aviso === txt) { aviso = ""; pintarAviso(); } }, 3500); }
  function pintarAviso() { const t = app.querySelector(".toast"); if (t) { t.textContent = aviso; t.hidden = !aviso; } }

  // ---------- partes ----------
  function nav() {
    const p = nube.miPerfil();
    return `<header class="az-nav">
      <span class="marca">${MEDIALUNA}<span>AZAR</span></span>
      <nav class="pestanas" aria-label="Secciones"><button data-tab="jugar" aria-current="${!vos}">Jugar</button><button data-tab="vos" aria-current="${vos}">Vos</button></nav>
      <div class="nav-der">
        <button class="ico-btn" data-accion="sonido" aria-pressed="${ambiente.encendido}" aria-label="Sonido de ambiente" title="Sonido de ambiente">${ICO_SONIDO(ambiente.encendido)}</button>
        ${pantalla.sePuede() ? `<button class="ico-btn" data-accion="pantalla" aria-label="Pantalla completa" title="Pantalla completa">${pantalla.iconoPantalla()}</button>` : ""}
        <button class="yo" data-tab="vos" aria-label="${p ? esc(p.usuario) : "Entrar"}">${p ? luna(p.usuario, "on") : `<span class="luna vacia"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7"/></svg></span>`}</button>
      </div></header>`;
  }

  function saludo() {
    const p = nube.miPerfil();
    const n = (amigos || []).filter((a) => a.estado === "juega" || a.estado === "on").length;
    const quien = p ? esc(p.usuario) : "";
    return `${saludoHora()}${quien ? ", " + quien : ""}${n ? ` · ${n} ${n === 1 ? "amigo" : "amigos"} en AZAR` : ""}`;
  }

  function barajas() {
    return JUEGOS.map((j) => `<button class="baraja" data-juego="${j.id}" aria-label="${esc(j.nombre)}, ${esc(j.cuantos)}">
        ${signo(j.palo)}<b>${esc(j.nombre)}</b><small>${esc(j.cuantos)}</small><span class="vivo">${esc(j.lema)}</span></button>`).join("")
      + `<div class="baraja vacia" aria-hidden="true"><small>próximo juego</small></div>`;
  }

  function seguir() {
    const u = (partidas || [])[0];
    if (!u) return "";
    const j = juegoPorId(u.partidas_juego?.juego);
    if (!j) return "";
    return `<div class="seguir">${signo(j.palo)}<div><small>Tu última · ${u.gano ? "ganaste" : "perdiste"}</small><b>${esc(j.nombre)} con un amigo</b></div>
      <button class="btn prim chico" data-juego="${j.id}">${u.gano ? "Otra" : "Revancha"}</button></div>`;
  }

  function columnaAmigos() {
    const p = nube.miPerfil();
    let cuerpo;
    if (!nube.activa()) cuerpo = `<p class="nota">Las cuentas no están activadas en esta copia. Podés jugar igual contra los bots y con amigos por link.</p>`;
    else if (!p) cuerpo = `<p class="nota">Entrá con Google y vas a ver acá quién está en AZAR y quién está jugando.</p><button class="btn sec" data-tab="vos">Entrar</button>`;
    else if (amigos === null) cuerpo = `<p class="nota">Buscando a tus amigos…</p>`;
    else if (!amigos.length) cuerpo = `<p class="nota">Todavía no sumaste amigos. Se suman desde el truco: Jugar → Tus amigos, con tu link de amigo.</p>`;
    else {
      const grupo = (t, lista) => (lista.length ? `<span class="grupo-t">${t}</span>${lista.map((a) => `<div class="amigo">${luna(a.usuario, a.estado)}<div><b>${esc(a.usuario)}</b><small class="${a.estado === "juega" ? "j" : ""}">${FASE[a.estado]?.txt || "hace rato"}</small></div></div>`).join("")}` : "");
      cuerpo = grupo("Jugando", amigos.filter((a) => a.estado === "juega")) + grupo("En AZAR", amigos.filter((a) => a.estado === "on"))
        + grupo("Pasaron hoy", amigos.filter((a) => a.estado === "rec")) + grupo("Sin conectarse hoy", amigos.filter((a) => a.estado === "off"));
    }
    return `<aside class="amigos" aria-label="Amigos"><h2>Amigos</h2><div class="amigos-lista">${cuerpo}</div>
      <div class="leyenda"><span>${fase("juega")} jugando</span><span>${fase("on")} en AZAR</span><span>${fase("rec")} pasó hoy</span><span>${fase("off")} hace rato</span></div></aside>`;
  }


  // ---------- «Vos» único (2026-11-19, Pedro: «unificá»): el perfil de toda la cuenta vive acá. Junta las partidas del
  // truco y las de los otros juegos; la cara, lo que tenés puesto y los equipos se eligen en el truco (Tienda y Equipos).
  const fecha = (iso) => { const d = iso ? new Date(iso) : null; return d && !isNaN(d) ? d.toLocaleDateString("es-AR", { day: "numeric", month: "short" }) : ""; };
  function historialUnico() {
    const truco = (partidasTruco || []).map((x) => ({ juego: "truco", gano: !!x.gano, cuando: x.jugada, rivales: x.rivales || [],
      marcador: x.puntos0 != null ? `${x.lado === 0 ? x.puntos0 : x.puntos1} a ${x.lado === 0 ? x.puntos1 : x.puntos0}` : "", extra: x.gloria ? `+${x.gloria} de gloria` : "" }));
    const otros = (partidas || []).map((x) => ({ juego: x.partidas_juego?.juego, gano: !!x.gano, cuando: x.partidas_juego?.jugada, rivales: x.rivales || [], marcador: "", extra: "" }));
    return [...truco, ...otros].sort((a, b) => String(b.cuando || "").localeCompare(String(a.cuando || "")));
  }
  function perfilCompleto(p) {
    const cargandoTodo = partidas === null || partidasTruco === null;
    const lista = cargandoTodo ? [] : historialUnico();
    const ganadas = lista.filter((x) => x.gano).length;
    let racha = 0; for (const x of lista) { if (x.gano) racha++; else break; }
    const porJuego = {};
    for (const x of lista) { const k = (porJuego[x.juego] ||= { g: 0, p: 0 }); if (x.gano) k.g++; else k.p++; }
    const cifra = (n, t, cl = "") => `<div class="${cl}"><b>${cargandoTodo ? "·" : n}</b><span>${t}</span></div>`;
    const filas = lista.slice(0, 12).map((x) => {
      const j = juegoPorId(x.juego);
      return `<li class="${x.gano ? "gane" : "perdi"}"><span class="h-sello" aria-label="${x.gano ? "ganaste" : "perdiste"}">${x.gano ? "G" : "P"}</span>
        <span class="h-medio"><b>${esc(j?.nombre || x.juego || "")}${x.rivales.length ? ` <i>contra ${esc(x.rivales.join(", "))}</i>` : ""}</b><small>${esc(fecha(x.cuando))}${x.extra ? ` · ${esc(x.extra)}` : ""}</small></span>
        ${x.marcador ? `<span class="h-fin">${esc(x.marcador)}</span>` : ""}</li>`;
    }).join("");
    const titulo = p.titulo ? `<small class="p-titulo">${esc(p.titulo)}</small>` : "";
    return `<div class="perfil-grande">${luna(p.usuario, "on")}<div><b class="p-nombre">${esc(p.usuario)}</b>${titulo}
        <a class="chip-gloria-az" href="juegos/truco/?ir=pulperia">${Number(p.puntos) || 0} de gloria · Tienda ›</a></div></div>
      <div class="cifras-az">${cifra(lista.length, "jugadas")}${cifra(ganadas, "ganadas", "g")}${cifra(lista.length - ganadas, "perdidas", "p")}${cifra(racha, "racha")}</div>
      ${Object.keys(porJuego).length ? `<div class="por-juego">${Object.entries(porJuego).map(([k, v]) => `<span><b>${esc(juegoPorId(k)?.nombre || k)}</b> ${v.g}–${v.p}</span>`).join("")}</div>` : ""}
      <h2>Tus partidas</h2>
      ${cargandoTodo ? `<p class="nota">Cargando…</p>` : filas ? `<ul class="historial">${filas}</ul>` : `<p class="nota">Todavía no jugaste ninguna con un amigo.</p>`}
      <p class="nota chica">Se anotan las partidas con alguien que también entró con su cuenta y confirmó el resultado. Las de los bots no. Los juegos de a varios (siete, culo sucio, Desconfío, generala, chinchón) todavía no se guardan.</p>
      <h2>Tu cara y tu mesa</h2>
      <p class="nota">Tu cara, lo que tenés puesto y tus equipos se eligen en el truco, con la gloria.</p>
      <div class="vos-links"><a class="btn sec" href="juegos/truco/?ir=pulperia">Tienda</a><a class="btn sec" href="juegos/truco/?ir=vos">Equipos del truco</a></div>
      <div class="acciones"><button class="btn sec" data-accion="salir">Cerrar sesión</button>
        ${confirmarBorrado ? `<div class="borrar"><p class="nota">Esto borra tu usuario, tu gloria y tu historial en todo AZAR, también en el truco. No se puede deshacer. Escribí tu usuario para confirmar:</p><input class="campo" id="confirmar" autocomplete="off" aria-label="Escribí tu usuario"><button class="btn peligro" data-accion="borrar-ok">Borrar mi cuenta</button><button class="btn suave" data-accion="borrar-no">No, volver</button></div>`
          : `<button class="btn suave" data-accion="borrar">Borrar mi cuenta</button>`}</div>`;
  }
  const legal = () => `<p class="legal"><a href="terminos.html" target="_blank" rel="noopener">Términos</a> · <a href="privacidad.html" target="_blank" rel="noopener">Privacidad</a></p>`;
  function panelVos() {
    const p = nube.miPerfil(), u = nube.miUsuario();
    let c;
    if (!nube.activa()) c = `<p class="nota">Las cuentas todavía no están activadas en esta copia. Podés jugar igual contra los bots y con amigos por link.</p>`;
    else if (!u) c = `<h2>Tu usuario</h2><p class="nota">Entrá con Google para tener tu usuario, tus amigos y tu historial. Es el mismo usuario en todos los juegos de AZAR.</p>
      <button class="btn prim" data-accion="google">Entrar con Google</button>`;
    else if (!p) c = `<h2>Elegí tu usuario</h2><p class="nota">De 3 a 16 letras o números, sin espacios. Es el que ven los demás.</p>
      <input class="campo" id="usuario" maxlength="16" autocomplete="off" aria-label="Usuario"><button class="btn prim" data-accion="crear">Crear usuario</button>`;
    else c = perfilCompleto(p);
    return `<section class="panel-vos" role="dialog" aria-label="Vos" ${vos ? "" : "hidden"}><button class="cerrar-vos" data-tab="jugar" aria-label="Cerrar">×</button>${c}${legal()}</section>`;
  }

  // ---------- pintar ----------
  function pintar() {
    if (!vivo) return;
    app.innerHTML = `<div class="azar${vos ? " con-vos" : ""}">${nav()}
      <main class="escena">
        <div class="cielo-zona" aria-hidden="true"><span class="ancla-eclipse"></span></div>
        <div class="saludo-bloque"><span class="saludo">${saludo()}</span><h1 class="titular">¿A qué jugamos<br>esta noche?</h1></div>
        <section class="mostrador" aria-label="Juegos"><div class="barajas">${barajas()}</div><div class="az-franja"></div><div class="az-reflejo"></div></section>
        ${seguir()}
      </main>
      ${columnaAmigos()}${panelVos()}
      <p class="toast" role="status" ${aviso ? "" : "hidden"}>${esc(aviso)}</p></div>`;
    anclar(app.querySelector(".ancla-eclipse"), app.querySelector(".az-franja"));
  }
  function pintarParte(sel, html) { const v = app.querySelector(sel); if (v) v.outerHTML = html; else pintar(); }

  // ---------- datos ----------
  async function cargarAmigos() {
    if (!vivo || !nube.miPerfil()) return;
    try {
      const lista = await nube.misAmigos();
      if (!vivo) return;
      const ahora = new Set(lista.filter((a) => a.estado === "on" || a.estado === "juega").map((a) => a.id));
      const llego = amigos !== null && [...ahora].some((id) => !conectadosAntes.has(id));
      conectadosAntes = ahora; amigos = lista;
      pintarParte(".amigos", columnaAmigos());
      const s = app.querySelector(".saludo"); if (s) s.textContent = saludo().replace(/&amp;/g, "&");
      if (llego) destello();  // un amigo acaba de entrar: anillo de diamante breve
    } catch { if (amigos === null) { amigos = []; pintarParte(".amigos", columnaAmigos()); } }
  }
  async function cargarPartidas() {
    if (!nube.miPerfil()) { partidas = null; partidasTruco = null; return; }
    const [x, t] = await Promise.all([nube.misPartidasJuego(20).catch(() => []), nube.misPartidasTruco(60).catch(() => [])]);
    partidas = [...x].sort((a, b) => String(b.partidas_juego?.jugada || "").localeCompare(String(a.partidas_juego?.jugada || "")));
    partidasTruco = t;
    if (vivo) pintar();
  }

  // ---------- intensidad del sonido: sube al pasar por los juegos y por el eclipse ----------
  // Cada juego tiene su acorde (foco "juego:<id>"); el eclipse crece cuanto más cerca pasa el puntero (hasta ~4 radios).
  app.onpointermove = (ev) => {
    const b = ev.target.closest(".baraja:not(.vacia)");
    if (b) { ambiente.foco("juego:" + b.dataset.juego, 1); return; }
    const ancla = app.querySelector(".ancla-eclipse")?.getBoundingClientRect();
    if (ancla && ancla.width > 0 && !vos) {
      const r = ancla.width / 2, d = Math.hypot(ev.clientX - (ancla.left + r), ev.clientY - (ancla.top + r));
      const cerca = 1 - Math.max(0, d - r) / (r * 3.5);
      if (cerca > 0) { ambiente.foco("eclipse", cerca * cerca * (3 - 2 * cerca)); return; }
    }
    ambiente.reposo();
  };
  app.onpointerleave = () => ambiente.reposo();
  ambiente.mesa(false);

  // ---------- acciones ----------
  app.onclick = async (ev) => {
    const t = ev.target.closest("[data-tab],[data-juego],[data-accion]");
    if (!t || cargando) return;
    if (t.dataset.tab) {
      vos = t.dataset.tab === "vos"; confirmarBorrado = false; pintar();
      if (vos && nube.miPerfil() && partidas === null) cargarPartidas();
      return;
    }
    if (t.dataset.juego) { abrirJuego(t.dataset.juego); return; }
    const a = t.dataset.accion, p = nube.miPerfil();
    if (a === "sonido") { const on = ambiente.alternar(); t.setAttribute("aria-pressed", on); t.innerHTML = ICO_SONIDO(on); return; }
    if (a === "pantalla") { await pantalla.alternar(); t.innerHTML = pantalla.iconoPantalla(); return; }
    try {
      cargando = true;
      if (a === "google") await nube.entrarConGoogle();
      else if (a === "crear") await nube.crearPerfil(app.querySelector("#usuario").value);  // el historial lo trae el aviso de sesión
      else if (a === "salir") { await nube.salir(); partidas = null; partidasTruco = null; amigos = null; }
      else if (a === "borrar") { confirmarBorrado = true; pintar(); }
      else if (a === "borrar-no") { confirmarBorrado = false; pintar(); }
      else if (a === "borrar-ok") {
        if (nube.normalizarUsuario(app.querySelector("#confirmar").value) !== p.usuario) toast("Escribí tu usuario tal cual para confirmar.");
        else { await nube.borrarMiCuenta(); confirmarBorrado = false; partidas = null; vos = false; toast("Cuenta borrada."); }
      }
    } catch (e) { toast(e.message || "Algo salió mal. Probá de nuevo."); }
    finally { cargando = false; }
  };
  const alTecla = (ev) => { if (ev.key === "Escape" && vos) { vos = false; pintar(); } };
  addEventListener("keydown", alTecla);
  const alPantalla = () => { const b = app.querySelector('[data-accion="pantalla"]'); if (b) b.innerHTML = pantalla.iconoPantalla(); };
  document.addEventListener("fullscreenchange", alPantalla);

  nube.on("sesion", () => { if (!vivo) return; amigos = null; partidas = null; partidasTruco = null; pintar(); cargarAmigos(); cargarPartidas(); });
  pintar();
  abrirCielo();
  cargarAmigos(); cargarPartidas();
  sondeo = setInterval(cargarAmigos, 20000);
  return () => {
    vivo = false; clearInterval(sondeo); app.onclick = null; app.onpointermove = null; app.onpointerleave = null;
    removeEventListener("keydown", alTecla); document.removeEventListener("fullscreenchange", alPantalla);
  };
}
