// Mesa de la GENERALA (2026-11-19), sobre el esqueleto común de a varios (nucleo/mesa-n.js), con los dados «Eclipse»
// del Desconfío (Pedro: «los mismos dados»). Al centro, la bandeja con el cubilete y los dados del que tira (todos ven
// todo) y la planilla de todos. En tu turno: se tira tocando el cubilete (sin botón, como en el Desconfío), se guarda un
// dado tocándolo y se anota tocando tu casillero, que muestra cuánto te daría. Tachar (anotar 0) pide confirmación.
import { montarMesaN, esc } from "../../nucleo/mesa-n.js";
import { sonido } from "../../nucleo/sonido.js";
import { puntaje, CORTOS, NOMBRES, TIROS, servible } from "./motor.js";
import { dado, cubilete, DEFS } from "../desconfio/dados.js";

const QUIETO = matchMedia("(prefers-reduced-motion: reduce)").matches;
const ORD = ["", "1º", "2º", "3º"];
// «anotó 30 al full», «tachó la escalera»
const A_CAT = { 1: "al 1", 2: "al 2", 3: "al 3", 4: "al 4", 5: "al 5", 6: "al 6", E: "a la escalera", F: "al full", P: "al póker", G: "a la generala", DG: "a la doble generala" };
const CON_ART = { 1: "el 1", 2: "el 2", 3: "el 3", 4: "el 4", 5: "el 5", 6: "el 6", E: "la escalera", F: "el full", P: "el póker", G: "la generala", DG: "la doble generala" };

export function montarMesa(cont, { fuente, salir, otraMesa }) {
  let aparte = new Set();     // los dados que guardás para el próximo tiro
  let tachar = null;          // el casillero que estás por tachar (pide confirmación)
  let animar = null;          // { guardados } del tiro que acaba de llegar
  let recien = null;          // { jugador, cat } lo último anotado, para marcarlo un rato
  let tRecien = 0;
  let vActual = fuente.vista(), pActual = null;

  function bandeja(v, p) {
    const nom = (j) => (j === p.yo ? "Vos" : p.nombre(j));
    if (v.fase === "fin") {
      const u = v.ultima;
      return `<div class="bandeja-g"><p class="quien-g">${v.servida !== null ? `${esc(nom(v.servida))} sacó generala servida` : u ? `Último: ${esc(nom(u.jugador))}, ${esc(NOMBRES[u.cat])}` : ""}</p>
        <div class="dados-g">${v.dados.map((d) => dado(d)).join("")}</div></div>`;
    }
    const mio = v.turno === p.yo;
    const quien = mio ? (v.tiro === 0 ? "Te toca. Tocá el cubilete para tirar." : `Tu ${ORD[v.tiro]} tiro de ${TIROS}`) : `Tira ${esc(p.nombre(v.turno))}${v.tiro ? ` · ${ORD[v.tiro]} tiro` : "…"}`;
    const puedeTirar = v.puedoTirar && aparte.size < 5;
    const sacude = animar ? " sacude" : "";
    const dadosHTML = v.tiro === 0
      ? (v.ultima && !mio ? "" : `<span class="toca-g">${mio ? "" : "esperando el tiro"}</span>`)
      : v.dados.map((d, i) => {
        const guardado = mio ? aparte.has(i) : v.guardados.includes(i);
        const rueda = animar && !animar.guardados.includes(i) ? " rueda" : "";
        const cls = `${guardado ? "guardado" : ""}${rueda}`;
        return mio && v.puedoTirar
          ? `<button type="button" class="dado-g ${cls}" data-i="${i}" aria-pressed="${guardado}" aria-label="${guardado ? "Soltar" : "Guardar"} el ${d}" style="--i:${i}">${dado(d)}</button>`
          : `<span class="dado-g ${cls}" style="--i:${i}">${dado(d)}</span>`;
      }).join("");
    // del que tiró antes, lo que anotó (mientras el que sigue no tiró)
    const antes = v.tiro === 0 && v.ultima && v.ultima.jugador !== v.turno
      ? `<p class="antes-g">${(() => {
          const u = v.ultima, yoFui = u.jugador === p.yo, quien = yoFui ? "" : `${esc(p.nombre(u.jugador))} `;
          if (!u.puntos) return `${quien}${yoFui ? "Tachaste" : "tachó"} ${CON_ART[u.cat]}`;
          return `${quien}${yoFui ? "Anotaste" : "anotó"} <b>${u.puntos}</b> ${A_CAT[u.cat]}${u.servida ? (u.cat === "E" ? " (servida)" : " (servido)") : ""}`;
        })()}</p>
         <div class="dados-g chicos">${v.ultima.dados.map((d) => dado(d)).join("")}</div>` : "";
    return `<div class="bandeja-g${mio ? " mia" : ""}">
      <p class="quien-g">${quien}</p>
      <div class="tiro-g">
        ${mio ? `<button type="button" class="cubo-g${sacude}" ${puedeTirar ? "" : "disabled"} aria-label="${v.tiro === 0 ? "Tirar los dados" : `Tirar de nuevo los que no guardaste (${TIROS - v.tiro} ${TIROS - v.tiro === 1 ? "tiro queda" : "tiros quedan"})`}">${cubilete("grande")}</button>`
        : `<span class="cubo-g ajeno${sacude}">${cubilete("grande")}</span>`}
        <div class="dados-g">${dadosHTML}</div>
      </div>
      ${mio ? `<p class="ayuda-g">${v.tiro === 0 ? "" : v.tiro < TIROS ? "Tocá los dados que guardás y el cubilete para tirar el resto, o anotá en tu columna." : "No quedan tiros: anotá en tu columna."}</p>` : ""}
      ${antes}
    </div>`;
  }

  function planilla(v, p) {
    const { yo, n } = p;
    const anotando = v.puedoAnotar;
    const pl = v.planillas[yo];
    const cab = Array.from({ length: n }, (_, j) => `<th scope="col" class="${j === yo ? "yo" : ""}${v.turno === j ? " turno" : ""}"><span>${esc(j === yo ? "Vos" : p.nombre(j))}</span></th>`).join("");
    const filas = v.cats.map((cat) => `<tr><th scope="row">${esc(CORTOS[cat])}</th>${Array.from({ length: n }, (_, j) => {
      const x = v.planillas[j][cat];
      const marca = `${j === yo ? "yo" : ""}${v.turno === j ? " turno" : ""}${recien && recien.jugador === j && recien.cat === cat ? " recien" : ""}`;
      if (x === null && j === yo && anotando) {
        const pts = puntaje(v.dados, cat, v.tiro === 1, pl);
        return `<td class="${marca}"><button type="button" class="anotar-g${pts ? "" : " cero"}${tachar === cat ? " por-tachar" : ""}" data-cat="${cat}" aria-label="${pts ? `Anotar ${pts} ${cat.length === 1 && /\d/.test(cat) ? `al ${cat}` : `a ${NOMBRES[cat].toLowerCase()}`}` : `Tachar ${NOMBRES[cat].toLowerCase()}`}">${pts || "✕"}</button></td>`;
      }
      return `<td class="${marca}${x === 0 ? " cruz" : ""}">${x === null ? "" : x === 0 ? "✕" : x}</td>`;
    }).join("")}</tr>`).join("");
    const tot = `<tr class="total-g"><th scope="row">Total</th>${v.totales.map((t, j) => `<td class="${j === yo ? "yo" : ""}${v.turno === j ? " turno" : ""}">${t}</td>`).join("")}</tr>`;
    return `<table class="planilla-g" data-n="${n}" aria-label="Planilla ${v.tipo}"><thead><tr><th scope="col" class="tipo-g">${v.tipo === "corta" ? "Corta" : "Planilla"}</th>${cab}</tr></thead><tbody>${filas}${tot}</tbody></table>`;
  }

  function pintar(v, ev, p) {
    const { yo, n } = p;
    if (!v.puedoAnotar) tachar = null;
    p.estado(v.fase === "fin" ? "Terminó la partida" : `Planilla ${v.tipo} · ${v.cats.length} casilleros`);
    p.turno(v.fase === "jugar" ? v.turno : null);
    for (let j = 0; j < n; j++) {
      const t = v.totales[j];
      p.sillaExtra(j).innerHTML = `<span class="pts-g">${t} pts</span>`;
      if (j !== yo) p.sillaCartas(j).innerHTML = v.turno === j && v.fase === "jugar" ? `<span class="tirando-g">tirando</span>` : "";
    }
    p.centro.innerHTML = `<div class="mesa-g">${bandeja(v, p)}${planilla(v, p)}</div>`;
    animar = null;
    p.miExtra.innerHTML = `<span class="pts-g">${v.totales[yo]} puntos</span>`;

    const c = p.controles;
    if (tachar) {
      c.innerHTML = `<span class="ctrl-nota">¿Tachás ${esc(NOMBRES[tachar].toLowerCase())}? Vale 0 y no se usa más.</span><button class="boton suave no-tachar">No</button><button class="boton primario si-tachar">Tachar</button>`;
    } else if (v.turno === yo && v.fase === "jugar") {
      c.innerHTML = `<span class="ctrl-nota">Tu turno</span>`;   // la ayuda va en la bandeja, así el pie queda en una línea
    } else c.innerHTML = `<span class="ctrl-nota">${v.fase === "fin" ? "" : v.turno !== null ? `Le toca a ${esc(p.nombre(v.turno))}` : ""}</span>`;
  }

  function alEventos(v, ev, p) {
    const nom = (j) => (j === p.yo ? "Vos" : p.nombre(j));
    for (const e of ev) {
      if (e.t === "turno" || e.t === "revancha") { aparte = new Set(); tachar = null; if (e.t === "turno" && e.jugador === p.yo) sonido.play("tic"); }
      else if (e.t === "tiro") {
        animar = QUIETO ? null : { guardados: e.guardados };
        sonido.play("carta");
        if (e.jugador === p.yo) aparte = new Set(e.guardados);
      } else if (e.t === "servida") { sonido.play("coincidencia"); p.grito("¡Generala servida!", 2200); }
      else if (e.t === "anota") {
        recien = { jugador: e.jugador, cat: e.cat };
        clearTimeout(tRecien); tRecien = setTimeout(() => { recien = null; repintar(); }, 2600);
        if ((e.cat === "G" || e.cat === "DG") && e.puntos > 0) { sonido.play("coincidencia"); p.grito(e.cat === "DG" ? "¡Doble generala!" : "¡Generala!"); }
        else if (e.servida) {
          // servido: grito grande (Pedro, 2026-11-19); quién fue lo dice la bandeja. La escalera es «servida»
          const que = `¡${NOMBRES[e.cat]} ${e.cat === "E" ? "servida" : "servido"}!`;
          sonido.play("ya"); p.grito(que, 1800);
        }
        else if (e.puntos > 0 && servible(e.cat)) sonido.play("ya");
        else sonido.play("poner");
      }
    }
  }

  const final = (v) => {
    const gane = v.ganadores.includes(v.yo);
    const nom = (j) => (j === v.yo ? "Vos" : v.nombres[j] || "otro");
    const titulo = v.servida !== null ? (gane ? "¡Generala servida!" : `${nom(v.servida)}: servida`) : v.ganadores.length > 1 ? (gane ? "¡Empate arriba!" : "Empate") : gane ? "¡Ganaste!" : `Ganó ${nom(v.ganador)}`;
    return {
      gane, titulo,
      html: `<p>${v.servida !== null ? (gane ? "Cinco iguales en el primer tiro: partida ganada." : "Cinco iguales en el primer tiro y se terminó.") : v.ganadores.length > 1 ? `Empataron ${v.ganadores.map((j) => esc(nom(j))).join(" y ")} con ${v.totales[v.ganador]}.` : `Con ${v.totales[v.ganador]} puntos.`}</p>
        <ol class="tabla-porotos">${v.orden.map((j) => `<li class="${j === v.yo ? "yo" : ""}"><b>${esc(nom(j))}</b><span>${v.totales[j]}</span></li>`).join("")}</ol>`,
    };
  };

  const desmontar = montarMesaN(cont, {
    fuente, salir, otraMesa, clase: "generala", titulo: "Generala",
    pintar: (v, ev, p) => { vActual = v; pActual = p; pintar(v, ev, p); }, alEventos, final,
  });
  cont.querySelector(".mesa-n").insertAdjacentHTML("afterbegin", DEFS);
  function repintar() { if (pActual) pintar(vActual, [], pActual); }

  async function mandar(accion, b) {
    if (b) b.disabled = true;
    const r = await fuente.enviar(accion);
    if (r) { sonido.play("rechazo"); pActual?.aviso(r.mensaje); if (b) b.disabled = false; }
  }
  function onClick(e) {
    const v = vActual;
    if (e.target.closest(".no-tachar")) { tachar = null; repintar(); return; }
    if (e.target.closest(".si-tachar")) { const cat = tachar; tachar = null; mandar({ t: "anotar", cat }, e.target.closest("button")); return; }
    const cubo = e.target.closest("button.cubo-g");
    if (cubo && !cubo.disabled && v.puedoTirar) { tachar = null; mandar({ t: "tirar", guardar: [...aparte] }, cubo); return; }
    const d = e.target.closest("button.dado-g");
    if (d && v.puedoTirar && v.tiro > 0) {
      const i = Number(d.dataset.i);
      if (aparte.has(i)) aparte.delete(i); else aparte.add(i);
      sonido.play("tic"); repintar(); return;
    }
    const a = e.target.closest(".anotar-g");
    if (a && v.puedoAnotar) {
      const cat = a.dataset.cat;
      if (a.classList.contains("cero")) { tachar = cat; repintar(); return; }
      tachar = null; mandar({ t: "anotar", cat }, a);
    }
  }
  cont.addEventListener("click", onClick);
  return () => { cont.removeEventListener("click", onClick); clearTimeout(tRecien); desmontar(); };
}
