// Mesa del CHINCHÓN (2026-11-20), con las ideas de la generala «Horizonte», sobre el esqueleto común de a varios
// (nucleo/mesa-n.js; el arco de caras y tu pie se esconden: cada uno está en el cielo).
// Arriba, el cielo: cada jugador con su cara, sus puntos y una barra de luz hacia los 100 (de ahí te vas), cuántas
// cartas tiene y si da, si se reenganchó o si quedó afuera. Al medio, la franja de luz del mostrador con el mazo y el
// pozo apoyados encima. Abajo, el paño con tu mano: la acomodás arrastrando (o con «Ordenar»), levantás tocando el mazo
// o el pozo, tocás una carta para elegirla y la tirás (o la arrastrás al pozo) o cortás con ella.
// No se marca qué juegos tenés armados (Pedro, 2026-11-20: «uno debe poder darse cuenta de eso»): el botón «Cortar» está
// siempre y la mesa dice que no si las sueltas pasan de 5.
// Cuando alguien corta, el paño muestra las manos de todos acomodadas, lo que suma cada uno y, al que se pasó de 100 y
// puede, el reenganche.
import { montarMesaN, esc } from "../../nucleo/mesa-n.js";
import { dorso, ROTULO, nombreCarta } from "../../nucleo/cartas.js";
import { sonido } from "../../nucleo/sonido.js";
import { cara, formaDeJugador } from "../../nucleo/caras.js";
import { TOPE, MAX_SUELTAS, esComodin, numero, palo, ordenar } from "./motor.js";
import { cartaSVG } from "./comodin.js";

const QUIETO = matchMedia("(prefers-reduced-motion: reduce)").matches;
const nombreDe = (id) => (esComodin(id) ? "el comodín" : `el ${nombreCarta(id).replace(/^1 /, "as ")}`);
const PALO_ORDEN = ["espada", "basto", "oro", "copa"];
const porNumero = (ids) => [...ids].sort((a, b) => (esComodin(a) - esComodin(b)) || numero(a) - numero(b) || PALO_ORDEN.indexOf(palo(a)) - PALO_ORDEN.indexOf(palo(b)) || a.localeCompare(b));

// el cielo de la mesa: estrellas fijas (siempre las mismas)
const ESTRELLAS = (() => {
  let s = 23; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return `<svg class="cx-estrellas" viewBox="0 0 1000 620" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${Array.from({ length: 140 }, () => {
    const rad = r() < 0.08 ? 1.6 : 0.5 + r() * 0.8;
    return `<circle cx="${(r() * 1000).toFixed(1)}" cy="${(r() * 620).toFixed(1)}" r="${rad.toFixed(2)}" fill="#F1EBDD" opacity="${(0.12 + r() * 0.5).toFixed(2)}"/>`;
  }).join("")}</svg>`;
})();

export function montarMesa(cont, { fuente, salir, otraMesa }) {
  const antes = ROTULO.texto;
  ROTULO.texto = "chinchón";
  let vActual = fuente.vista(), pActual = null;
  let orden = [];              // cómo acomodaste tu mano (solo en tu pantalla)
  let modoOrden = "palo";      // lo que hace el próximo «Ordenar»
  let elegida = null;          // la carta que tocaste para tirar o cortar
  let nueva = null;            // la que acabás de levantar (entra con un movimiento)
  let cayo = 0;                // para animar la carta que cae en el pozo
  let el = null;
  const globos = new Map();
  const caras = new Map();

  function armar(p) {
    p.centro.innerHTML = `<div class="cx-mesa">${ESTRELLAS}
      <div class="cx-cielo"><div class="cx-astral" aria-label="Jugadores y puntos"></div></div>
      <div class="cx-mostrador">
        <div class="cx-franja">
          <i class="cx-horizonte" aria-hidden="true"></i>
          <div class="cx-estado" aria-live="polite"></div>
          <div class="cx-montones">
            <button type="button" class="cx-mazo" aria-label="Mazo"><span class="cx-carta-m">${dorso()}</span><span class="cx-cuantas"></span></button>
            <button type="button" class="cx-pozo" aria-label="Pozo"><span class="cx-pozo-cartas"></span><span class="cx-cuantas"></span></button>
          </div>
          <span class="cx-lado" aria-hidden="true"></span>
        </div>
        <div class="cx-pano">
          <div class="cx-mano" role="group" aria-label="Tu mano"></div>
          <div class="cx-acciones"></div>
        </div>
        <div class="cx-recuento" hidden></div>
      </div></div>`;
    const m = p.centro.querySelector(".cx-mesa");
    el = { mesa: m, astral: m.querySelector(".cx-astral"), estado: m.querySelector(".cx-estado"), mazo: m.querySelector(".cx-mazo"),
      pozo: m.querySelector(".cx-pozo"), acciones: m.querySelector(".cx-acciones"), mano: m.querySelector(".cx-mano"),
      recuento: m.querySelector(".cx-recuento"), pano: m.querySelector(".cx-pano") };
  }

  const nom = (j, p) => (j === p.yo ? "Vos" : p.nombre(j));

  // ---------- el cielo ----------
  function cielo(v, p) {
    const n = v.n;
    el.astral.dataset.n = n;
    el.astral.style.setProperty("--n", n);
    let html = "";
    for (let j = 0; j < n; j++) {
      const jj = fuente.jugadores()[j], forma = formaDeJugador(jj, [2, 4, 1, 5, 0, 3][j % 6]), nm = p.nombre(j);
      const k = `${forma}|${nm}`;
      if (caras.get(j)?.k !== k) caras.set(j, { k, html: cara(forma, nm) });
      const pts = v.puntos[j], afuera = v.fuera.includes(j), turno = (v.fase === "robar" || v.fase === "tirar") && v.turno === j;
      const t = Math.min(1, Math.max(0, pts) / TOPE);
      const pasado = v.recuento?.pasados?.includes(j);
      const notas = [
        v.reparte === j && !afuera ? "da" : "",
        v.reenganches[j] ? "reenganchado" : "",
        afuera ? "afuera" : pasado ? "se pasó" : "",
      ].filter(Boolean);
      const cartasRiv = j !== p.yo && !afuera && v.fase !== "fin"
        ? `<span class="cx-dorsos" aria-label="${v.enMano[j]} cartas">${Array.from({ length: v.enMano[j] }, (_, i) => `<i style="--i:${i - (v.enMano[j] - 1) / 2}"></i>`).join("")}</span>` : "";
      html += `<div class="cx-quien${j === p.yo ? " yo" : ""}${turno ? " turno" : ""}${afuera ? " afuera" : ""}${pts > TOPE * 0.75 ? " cerca" : ""}" data-j="${j}" style="--t:${t.toFixed(3)}">
        <div class="cx-cara">${caras.get(j).html}<span class="cx-globo"></span></div>
        <div class="cx-datos">
          <b class="cx-nom">${esc(j === p.yo ? "Vos" : nm)}</b>
          <span class="cx-pts"><b>${pts}</b>${notas.length ? `<small>${notas.join(" · ")}</small>` : ""}</span>
          <span class="cx-barra" aria-hidden="true"><i></i></span>
          ${cartasRiv}
        </div>
      </div>`;
    }
    el.astral.innerHTML = html;
    for (const [j, txt] of globos) { const g = el.astral.querySelector(`.cx-quien[data-j="${j}"] .cx-globo`); if (g) { g.textContent = txt; g.classList.add("ver"); } }
  }

  // ---------- mazo y pozo ----------
  function montones(v, p) {
    const miTurno = v.turno === p.yo;
    const robo = miTurno && v.fase === "robar";
    el.mazo.querySelector(".cx-cuantas").textContent = v.enMazo;
    el.mazo.classList.toggle("llama", robo);
    el.mazo.disabled = !robo;
    el.mazo.classList.toggle("vacio", !v.enMazo);
    el.mazo.setAttribute("aria-label", robo ? `Levantar del mazo (${v.enMazo} cartas)` : `Mazo: ${v.enMazo} cartas`);
    const tirar = miTurno && v.fase === "tirar";
    el.pozo.classList.toggle("llama", robo && !!v.pozo);
    el.pozo.classList.toggle("recibe", tirar && !!elegida);
    el.pozo.disabled = !(robo && v.pozo) && !(tirar && elegida);
    el.pozo.querySelector(".cx-cuantas").textContent = v.enPozo > 1 ? v.enPozo : "";
    el.pozo.setAttribute("aria-label", v.pozo ? (robo ? `Levantar del pozo: ${nombreDe(v.pozo)}` : tirar && elegida ? `Tirar ${nombreDe(elegida)} al pozo` : `Pozo: ${nombreDe(v.pozo)}`) : "Pozo vacío");
    const pc = el.pozo.querySelector(".cx-pozo-cartas");
    const clave = `${v.pozo}|${v.enPozo}`;
    if (pc.dataset.k !== clave) {
      const debajo = v.enPozo > 1 ? `<span class="cx-carta-m debajo">${dorso()}</span>` : "";
      pc.innerHTML = v.pozo ? `${debajo}<span class="cx-carta-m arriba${cayo ? " cae" : ""}" data-c="${esc(v.pozo)}">${cartaSVG(v.pozo)}</span>` : `<span class="cx-vacio">pozo</span>`;
      pc.dataset.k = clave;
      cayo = 0;
    }
  }

  // ---------- la mano ----------
  function acomodarOrden(mano) {
    const quedan = orden.filter((c) => mano.includes(c));
    const faltan = mano.filter((c) => !quedan.includes(c));
    orden = [...quedan, ...faltan];
    return orden;
  }
  function mano(v, p) {
    const cartas = v.fase === "recuento" || v.fase === "fin" ? [] : acomodarOrden(v.mano);
    if (elegida && !cartas.includes(elegida)) elegida = null;
    const puedoElegir = v.turno === p.yo && v.fase === "tirar";
    el.mesa.style.setProperty("--n-mano", Math.max(cartas.length, 7));
    el.mano.innerHTML = cartas.map((c, i) => `<button type="button" class="cx-carta${c === elegida ? " elegida" : ""}${c === nueva ? " nueva" : ""}${c === v.levanto ? " levantada" : ""}" data-c="${esc(c)}" style="--i:${i}"
        aria-pressed="${c === elegida}" aria-label="${esc(nombreDe(c).replace(/^el /, ""))}${c === v.levanto ? " (la levantaste del pozo)" : ""}"${puedoElegir ? "" : ' aria-disabled="true"'}>${cartaSVG(c)}${c === v.levanto ? `<small class="cx-marca">del pozo</small>` : ""}</button>`).join("");
    nueva = null;
  }

  // ---------- estado y botones ----------
  function estado(v, p) {
    const miTurno = v.turno === p.yo;
    let titulo = "", sub = "";
    if (v.fase === "fin") titulo = "Terminó la partida";
    else if (v.fase === "recuento") titulo = v.recuento ? `${esc(nom(v.recuento.corto, p))} ${v.recuento.corto === p.yo ? "cortaste" : "cortó"}` : "Se cuenta";
    else if (v.fuera.includes(p.yo)) { titulo = "Quedaste afuera"; sub = `Le toca a ${esc(nom(v.turno, p))}.`; }
    else if (miTurno && v.fase === "robar") { titulo = "Te toca"; sub = v.pozo ? "Levantá del <b>mazo</b> o del <b>pozo</b>." : "Levantá del <b>mazo</b>."; }
    else if (miTurno && v.fase === "tirar") {
      titulo = elegida ? `${nombreDe(elegida).replace(/^el /, "").replace(/^./, (x) => x.toUpperCase())}` : "Tirá una";
      sub = elegida ? `Tirala al pozo o cortá con ella (sueltas de ${MAX_SUELTAS} o menos).` : "Tocá la carta que tirás. Para acomodar la mano, arrastrá las cartas.";
    } else if (v.turno !== null) { titulo = `Le toca a ${esc(nom(v.turno, p))}`; sub = v.fase === "robar" ? "Está por levantar." : "Está por tirar."; }
    el.estado.innerHTML = `<b>${titulo}</b>${sub ? `<small>${sub}</small>` : ""}<span class="cx-mano-n">Mano ${v.nroMano || 1}</span>`;

    const puedo = miTurno && v.fase === "tirar";
    const jugando = v.fase === "robar" || v.fase === "tirar";
    el.acciones.innerHTML = jugando && !v.fuera.includes(p.yo)
      ? `${puedo ? `<button type="button" class="boton primario cx-tirar"${elegida ? "" : " disabled"}>Tirar</button><button type="button" class="boton cx-cortar"${elegida ? "" : " disabled"}>Cortar</button>` : ""}
         <button type="button" class="boton suave cx-ordenar" title="Acomoda tu mano">${modoOrden === "palo" ? "Ordenar por palo" : "Ordenar por número"}</button>`
      : "";
  }

  // ---------- el recuento ----------
  let tCuenta = 0;
  function recuento(v, p) {
    const r = v.recuento;
    const ver = !!r && (v.fase === "recuento" || (v.fase === "fin" && r.chinchon));
    // aparece cuando termina el grito del corte (si no, el grito se pinta encima del título)
    if (ver && el.recuento.hidden) el.recuento.classList.add("entra");
    el.recuento.hidden = !ver;
    el.mesa.classList.toggle("contando", ver);
    if (!ver) { el.recuento.dataset.k = ""; el.recuento.classList.remove("entra"); return; }
    const k = `${r.corto}|${r.carta}|${v.nroMano}|${JSON.stringify(r.decidio)}|${v.fase}`;
    if (el.recuento.dataset.k === k) return;
    el.recuento.dataset.k = k;
    const filas = [...r.filas].sort((a, b) => (b.corto - a.corto) || (a.jugador === p.yo ? -1 : b.jugador === p.yo ? 1 : 0));
    const grupo = (cs, cls = "") => `<span class="cx-grupo ${cls}">${cs.map((c) => `<span class="cx-mini">${cartaSVG(c)}</span>`).join("")}</span>`;
    const quien = r.corto === p.yo ? "Cortaste" : `Cortó ${esc(p.nombre(r.corto))}`;
    const cortador = r.filas.find((f) => f.corto);
    const titulo = r.chinchon ? (r.corto === p.yo ? "¡Chinchón! Ganaste la partida" : `¡Chinchón de ${esc(p.nombre(r.corto))}!`)
      : cortador && cortador.puntos < 0 ? `${quien} sin sueltas: menos diez` : `${quien} con ${esc(nombreDe(r.carta))}`;
    const siguen = r.filas.map((f) => f.jugador).filter((j) => !r.pasados.includes(j));
    const conQue = siguen.length ? Math.max(...siguen.map((j) => v.puntos[j])) : 0;
    const yoDecido = r.puedeReenganche.includes(p.yo) && r.decidio[p.yo] === undefined && v.fase === "recuento";
    el.recuento.innerHTML = `<div class="cx-rec-caja">
      <h2>${titulo}</h2>
      <ol class="cx-filas">${filas.map((f) => {
        const j = f.jugador, pasado = r.pasados.includes(j);
        const dec = r.decidio[j], puede = r.puedeReenganche.includes(j);
        const nota = pasado ? (puede ? (dec === true ? `se reengancha con ${conQue}` : dec === false ? "queda afuera" : "se pasó: ¿se reengancha?") : "se pasó: afuera") : "";
        return `<li class="${j === p.yo ? "yo" : ""}${f.corto ? " corto" : ""}${pasado ? " pasado" : ""}">
          <b class="cx-f-nom">${esc(nom(j, p))}${f.corto ? `<small>${r.chinchon ? "chinchón" : "cortó"}</small>` : ""}</b>
          <span class="cx-f-cartas">${f.juegos.map((g) => grupo(g)).join("")}${f.pegadas?.length ? grupo(f.pegadas.map((x) => x.carta), "pegadas") : ""}${f.sueltas.length ? grupo(f.sueltas, "sueltas") : ""}</span>
          <span class="cx-f-pts">${r.chinchon ? "" : `<b>${f.puntos > 0 ? "+" : ""}${f.puntos}</b><small>${r.antes[j]} → ${r.antes[j] + f.puntos}</small>`}${nota ? `<em>${nota}</em>` : ""}</span>
        </li>`;
      }).join("")}</ol>
      ${yoDecido ? `<div class="cx-reengancho"><p>Te pasaste de ${TOPE}. Podés reengancharte una vez: volvés con ${conQue}, los puntos del que más tiene.</p>
        <div class="fin-botones"><button type="button" class="boton primario cx-si">Me reengancho</button><button type="button" class="boton suave cx-no">Me quedo afuera</button></div></div>` : ""}
      ${v.fase === "recuento" ? `<span class="cx-espera" aria-hidden="true"><i></i></span>` : ""}
    </div>`;
    // la barrita de espera hasta la mano siguiente
    const barra = el.recuento.querySelector(".cx-espera i");
    if (barra) {
      const ahora = fuente.ahora?.() ?? performance.now();
      const fin = r.puedeReenganche.some((j) => r.decidio[j] === undefined) ? r.tope : r.hasta;
      const ms = Math.max(400, (fin || ahora) - ahora);
      clearTimeout(tCuenta);
      barra.style.transition = "none"; barra.style.transform = "scaleX(1)";
      void barra.offsetWidth;
      barra.style.transition = `transform ${ms}ms linear`; barra.style.transform = "scaleX(0)";
    }
  }

  function pintar(v, ev, p) {
    if (!el || !p.centro.contains(el.mesa)) armar(p);
    p.estado(v.fase === "fin" ? "Terminó la partida" : `Mano ${v.nroMano || 1} · se va con más de ${TOPE}`);
    p.turno(v.fase === "robar" || v.fase === "tirar" ? v.turno : null);
    cielo(v, p);
    montones(v, p);
    mano(v, p);
    estado(v, p);
    recuento(v, p);
  }

  function alEventos(v, ev, p) {
    for (const e of ev) {
      if (e.t === "reparto") { sonido.play("llevar"); elegida = null; orden = []; if (e.mano > 1) p.aviso(`Mano ${e.mano}: da ${e.reparte === p.yo ? "vos" : p.nombre(e.reparte)}`, 2000); }
      else if (e.t === "robo") {
        sonido.play("carta");
        if (e.jugador === p.yo) { nueva = v.mano.find((c) => !orden.includes(c)) || null; }
        else if (e.de === "pozo") p.aviso(`${p.nombre(e.jugador)} levantó ${nombreDe(e.carta)} del pozo`, 2200);
        else if (el) { el.mazo.classList.remove("toca"); void el.mazo.offsetWidth; el.mazo.classList.add("toca"); }
      } else if (e.t === "tiro") { sonido.play("poner"); cayo = 1; if (e.jugador === p.yo) elegida = null; }
      else if (e.t === "mazo_nuevo") p.aviso("Se terminó el mazo: se mezcla el pozo", 2400);
      else if (e.t === "mano_nula") p.aviso("No quedan cartas: se reparte de nuevo", 2600);
      else if (e.t === "corte") {
        sonido.play("coincidencia"); elegida = null;
        const yo = e.jugador === p.yo;
        p.grito(e.chinchon ? "¡Chinchón!" : e.limpio ? "¡Menos diez!" : yo ? "¡Corto!" : `¡Corta ${p.nombre(e.jugador)}!`, 1300);
      } else if (e.t === "vuelve") p.aviso(e.jugador === p.yo ? `Volviste con ${e.puntos}` : `${p.nombre(e.jugador)} se reengancha con ${e.puntos}`, 2600);
      else if (e.t === "afuera") { sonido.play("perdiste"); p.aviso(e.jugador === p.yo ? `Te pasaste de ${TOPE}: quedaste afuera` : `${p.nombre(e.jugador)} se pasó de ${TOPE}: afuera`, 2800); }
      else if (e.t === "revancha") { elegida = null; orden = []; }
    }
  }

  const final = (v) => {
    const gane = v.ganador === v.yo;
    const nm = (j) => (j === v.yo ? "Vos" : v.nombres[j] || "otro");
    const titulo = v.chinchon !== null ? (gane ? "¡Chinchón!" : `Chinchón de ${nm(v.chinchon)}`) : gane ? "¡Ganaste!" : `Ganó ${nm(v.ganador)}`;
    // primero el que ganó; después los que siguen por puntos; al final los que se fueron, en orden inverso de salida
    const siguen = [...Array(v.n).keys()].filter((j) => !v.fuera.includes(j) && j !== v.ganador).sort((a, b) => v.puntos[a] - v.puntos[b]);
    const filas = [v.ganador, ...siguen, ...[...v.fuera].reverse()].filter((j) => j !== null && j !== undefined);
    return {
      gane, titulo,
      html: `<p>${v.chinchon !== null ? (gane ? "Siete cartas seguidas del mismo palo, sin comodín: partida ganada en el acto." : "Siete seguidas del mismo palo y se terminó.") : gane ? `Los demás se pasaron de ${TOPE}.` : `${esc(nm(v.ganador))} quedó solo debajo de ${TOPE}.`}</p>
        <ol class="tabla-porotos">${filas.map((j) => `<li class="${j === v.yo ? "yo" : ""}"><b>${esc(nm(j))}</b>${v.fuera.includes(j) ? `<small>afuera con ${v.puntos[j]}</small>` : `<span>${v.puntos[j]}</span>`}</li>`).join("")}</ol>`,
    };
  };

  const desmontar = montarMesaN(cont, {
    fuente, salir, otraMesa, clase: "chinchon", titulo: "Chinchón",
    pintar: (v, ev, p) => { vActual = v; pActual = p; pintar(v, ev, p); }, alEventos, final,
  });
  const repintar = () => { if (pActual) pintar(vActual, [], pActual); };

  // los globos de los bots: el esqueleto los pinta en el arco (escondido en esta mesa); se copian al lado de la cara
  const obs = new MutationObserver(() => {
    globos.clear();
    cont.querySelectorAll(".rivales-n .silla-n").forEach((s) => { const b = s.querySelector(".burbuja"); if (b?.classList.contains("ver") && b.textContent) globos.set(Number(s.dataset.j), b.textContent); });
    el?.astral.querySelectorAll(".cx-quien").forEach((q) => { const g = q.querySelector(".cx-globo"), t = globos.get(Number(q.dataset.j)); g.textContent = t || ""; g.classList.toggle("ver", !!t); });
  });
  const rivales = cont.querySelector(".rivales-n");
  if (rivales) obs.observe(rivales, { subtree: true, attributes: true, attributeFilter: ["class"], childList: true, characterData: true });

  async function mandar(accion, b) {
    if (b) b.disabled = true;
    const r = await fuente.enviar(accion);
    if (r) { sonido.play("rechazo"); pActual?.aviso(r.mensaje, 3000); if (b) b.disabled = false; }
    return r;
  }
  function elegir(c) {
    const v = vActual;
    if (!(v.turno === v.yo && v.fase === "tirar")) {
      if (v.turno === v.yo && v.fase === "robar") pActual?.aviso("Primero levantá del mazo o del pozo");
      return;
    }
    elegida = elegida === c ? null : c;
    sonido.play("tic");
    repintar();
  }
  function tirar(c, b) {
    const v = vActual;
    if (c === v.levanto) { sonido.play("rechazo"); pActual?.aviso("La que levantaste del pozo no la podés tirar en la misma vuelta"); return; }
    elegida = null;
    mandar({ t: "tirar", carta: c }, b);
  }

  // ---------- arrastrar: acomodar la mano o tirar al pozo ----------
  let arr = null;   // { c, b, id, x0, y0, movio, centros }
  function onDown(e) {
    const b = e.target.closest(".cx-carta");
    if (!b || e.button > 0) return;
    arr = { c: b.dataset.c, b, id: e.pointerId, x0: e.clientX, y0: e.clientY, movio: false };
  }
  function sobrePozo(x, y) { const r = el.pozo.getBoundingClientRect(); const m = 24; return x > r.left - m && x < r.right + m && y > r.top - m && y < r.bottom + m; }
  function onMove(e) {
    if (!arr || e.pointerId !== arr.id) return;
    const dx = e.clientX - arr.x0, dy = e.clientY - arr.y0;
    if (!arr.movio) {
      if (Math.hypot(dx, dy) < 7) return;
      arr.movio = true;
      arr.b.setPointerCapture?.(e.pointerId);
      arr.b.classList.add("agarrada");
      el.mano.classList.add("acomodando");
    }
    e.preventDefault();
    arr.b.style.translate = `${dx}px ${dy}px`;
    const v = vActual;
    el.pozo.classList.toggle("encima", v.turno === v.yo && v.fase === "tirar" && sobrePozo(e.clientX, e.clientY));
  }
  function onUp(e) {
    if (!arr || e.pointerId !== arr.id) return;
    const { c, b, movio } = arr; arr = null;
    el.mano.classList.remove("acomodando"); el.pozo.classList.remove("encima");
    if (!movio) return;   // fue un toque: lo resuelve el click
    b.classList.remove("agarrada");
    b.style.translate = "";
    b.dataset.arrastrada = "1";
    setTimeout(() => { delete b.dataset.arrastrada; }, 0);
    const v = vActual;
    if (v.turno === v.yo && v.fase === "tirar" && sobrePozo(e.clientX, e.clientY)) { tirar(c, null); return; }
    // nuevo lugar: según dónde la soltaste entre las otras
    const otras = [...el.mano.querySelectorAll(".cx-carta")].filter((x) => x !== b);
    let idx = otras.length;
    for (let i = 0; i < otras.length; i++) { const r = otras[i].getBoundingClientRect(); if (e.clientX < r.left + r.width / 2) { idx = i; break; } }
    const resto = orden.filter((x) => x !== c);
    resto.splice(idx, 0, c);
    orden = resto;
    sonido.play("tic");
    repintar();
  }
  function onClick(e) {
    const v = vActual;
    const carta = e.target.closest(".cx-carta");
    if (carta) { if (carta.dataset.arrastrada) return; elegir(carta.dataset.c); return; }
    if (e.target.closest(".cx-mazo")) { if (v.turno === v.yo && v.fase === "robar") mandar({ t: "robar", de: "mazo" }, null); return; }
    if (e.target.closest(".cx-pozo")) {
      if (v.turno === v.yo && v.fase === "robar" && v.pozo) mandar({ t: "robar", de: "pozo" }, null);
      else if (v.turno === v.yo && v.fase === "tirar" && elegida) tirar(elegida, null);
      return;
    }
    if (e.target.closest(".cx-tirar") && elegida) { tirar(elegida, e.target.closest("button")); return; }
    if (e.target.closest(".cx-cortar") && elegida) { const c = elegida; mandar({ t: "cortar", carta: c }, e.target.closest("button")).then((r) => { if (!r) elegida = null; }); return; }
    if (e.target.closest(".cx-ordenar")) {
      orden = modoOrden === "palo" ? ordenar(orden) : porNumero(orden);
      modoOrden = modoOrden === "palo" ? "numero" : "palo";
      sonido.play("tic"); repintar(); return;
    }
    if (e.target.closest(".cx-si")) { mandar({ t: "reenganche", si: true }, e.target.closest("button")); return; }
    if (e.target.closest(".cx-no")) { mandar({ t: "reenganche", si: false }, e.target.closest("button")); return; }
  }
  function onKey(e) {
    const c = e.target.closest?.(".cx-carta");
    if (!c) return;
    // con el teclado: flechas mueven la carta en la mano
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const i = orden.indexOf(c.dataset.c), j = i + (e.key === "ArrowLeft" ? -1 : 1);
      if (i < 0 || j < 0 || j >= orden.length) return;
      [orden[i], orden[j]] = [orden[j], orden[i]];
      repintar();
      el.mano.querySelector(`[data-c="${CSS.escape(c.dataset.c)}"]`)?.focus();
    }
  }
  cont.addEventListener("pointerdown", onDown);
  cont.addEventListener("pointermove", onMove);
  cont.addEventListener("pointerup", onUp);
  cont.addEventListener("pointercancel", onUp);
  cont.addEventListener("click", onClick);
  cont.addEventListener("keydown", onKey);
  if (QUIETO) cont.querySelector(".mesa-n")?.classList.add("quieto");
  // solo para las pruebas: cómo está acomodada tu mano en pantalla
  window.__manoChinchon = () => [...orden];
  return () => {
    cont.removeEventListener("pointerdown", onDown); cont.removeEventListener("pointermove", onMove); cont.removeEventListener("pointerup", onUp);
    cont.removeEventListener("pointercancel", onUp); cont.removeEventListener("click", onClick); cont.removeEventListener("keydown", onKey);
    obs.disconnect(); clearTimeout(tCuenta); delete window.__manoChinchon; desmontar(); ROTULO.texto = antes;
  };
}
