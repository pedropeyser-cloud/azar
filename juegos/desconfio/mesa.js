// Mesa del DESCONFÍO con manos de póker (2026-11-19), sobre el esqueleto común de a varios (nucleo/mesa-n.js) y con los
// dados «Eclipse». Un solo cubilete que pasa de mano en mano: está en la silla del que lo tiene.
// Cada silla: sus vidas (soles), las rondas que ganó y si quedó afuera de la ronda. Al centro, el canto en pie en
// grande (el nombre y los cinco dados de la mano cantada) con la cadena de la ronda; al levantar el cubilete, lo que
// había y quién pierde la vida.
// Abajo, cuando el cubilete es tuyo: de cero, lo tocás y tirás los cinco. Si te lo pasan, lo tocás para mirar los
// dados; tocás los que querés volver a tirar (bajan hacia el cubilete) y tocás el cubilete otra vez (una sola vez).
// Para cantar, cinco dados que se tocan para cambiar el número, «Lo que tengo», «Lo justo» y una mano más o una
// menos; la mesa te dice si lo que vas a cantar es verdad o mentira. Cuando te cantan: «Le creo» o «¡Desconfío!».
import { montarMesaN, esc } from "../../nucleo/mesa-n.js";
import { sonido } from "../../nucleo/sonido.js";
import { nombreMano, ordenMano, supera, minimaQueSupera, esVerdad, rango, MANOS, VIDAS, DADOS } from "./motor.js";
import { dado, cubilete, DEFS } from "./dados.js";

const QUIETO = matchMedia("(prefers-reduced-motion: reduce)").matches;
const soles = (k) => `<span class="vidas-dc" role="img" aria-label="${k} ${k === 1 ? "vida" : "vidas"}">${Array.from({ length: Math.max(VIDAS, k) }, (_, i) => `<i class="${i < k ? "si" : ""}"></i>`).join("")}</span>`;
const rondas = (k) => (k ? `<span class="puntos-dc">${k} ${k === 1 ? "ronda" : "rondas"}</span>` : "");
const fila = (ds, cls = "") => `<span class="mano-dc">${ordenMano(ds).map((d) => dado(d, cls)).join("")}</span>`;

export function montarMesa(cont, { fuente, salir, otraMesa }) {
  let vActual = fuente.vista(), pActual = null;
  let mirado = "";            // el turno cuyos dados ya miraste (levantando el cubilete)
  let marcados = new Set();   // los dados que vas a volver a tirar
  let canto = null, cantoClave = "";
  let claveZona = "", sacudiendo = 0, enviando = false;

  /** Una clave por cada vez que el cubilete llega a alguien (y por cada tiro). */
  const turnoDe = (v) => `${v.ronda}:${v.cadena.length}:${v.turno}:${v.llego}`;
  const esMio = (v) => v.fase === "mano" && v.turno === v.yo;
  const veoDados = (v) => esMio(v) && (v.tiro || v.llego === "verdad" || mirado === turnoDe(v));

  /** Lo que se propone cantar: lo que tenés si alcanza; si no, lo justo. */
  function propuesta(v) {
    if (v.mios.length === DADOS && supera(v.mios, v.aSuperar)) return [...v.mios];
    return minimaQueSupera(v.aSuperar) || [...v.mios];
  }

  function pintarZona(v, p) {
    const mio = esMio(v), veo = veoDados(v);
    const clave = `${turnoDe(v)}|${v.fase}|${v.mios.join()}|${veo}|${v.tiro?.cuantos ?? "-"}|${[...marcados].join()}|${v.vidas[p.yo]}|${v.enRonda[p.yo]}`;
    if (clave === claveZona) return;
    claveZona = clave;
    if (!v.vidas[p.yo]) { p.miZona.innerHTML = `<p class="sin-dados">Te quedaste sin vidas. Mirá cómo termina.</p>`; return; }
    if (v.fase === "fin") { p.miZona.innerHTML = ""; return; }
    if (!v.enRonda[p.yo]) { p.miZona.innerHTML = `<p class="sin-dados">Te agarraron mintiendo: esta ronda la mirás. Volvés en la próxima.</p>`; return; }
    if (!mio) {
      const quien = v.fase === "revelar" ? "" : v.turno === null ? "" : v.fase === "responder" && v.turno === p.yo ? "Te cantaron: ¿le creés?" : `El cubilete lo tiene ${esc(p.nombre(v.fase === "responder" ? v.canto?.jugador : v.turno))}.`;
      p.miZona.innerHTML = quien ? `<p class="espera-dc">${quien}</p>` : "";
      return;
    }
    const puedoTirar = v.puedoTirar;
    let ayuda, etiqueta;
    if (!v.aSuperar && puedoTirar) { ayuda = "Tocá el cubilete para tirar los cinco dados."; etiqueta = "Tirar los cinco dados"; }
    else if (!veo) { ayuda = "Te pasaron el cubilete: tocalo para mirar los dados."; etiqueta = "Levantar el cubilete y mirar los dados"; }
    else if (puedoTirar) {
      ayuda = marcados.size ? `Tocá el cubilete para volver a tirar ${marcados.size === 1 ? "ese dado" : `esos ${marcados.size}`}. O cantá así.` : "Tocá los dados que querés volver a tirar (una vez) o cantá así.";
      etiqueta = marcados.size ? `Volver a tirar ${marcados.size === 1 ? "un dado" : `${marcados.size} dados`}` : "Cubilete";
    } else { ayuda = ""; etiqueta = "Sacudir el cubilete"; }
    const tocables = veo && puedoTirar && v.aSuperar;
    const dados = veo
      ? v.mios.map((d, i) => (tocables
        ? `<button type="button" class="dado-dc${marcados.has(i) ? " al-cubo" : ""}" data-i="${i}" aria-pressed="${marcados.has(i)}" aria-label="${d === 1 ? "as" : d}${marcados.has(i) ? ", vuelve a tirarse" : ", se guarda"}">${dado(d)}</button>`
        : dado(d))).join("")
      : "";
    p.miZona.innerHTML = `<button type="button" class="cubo-mio${puedoTirar || !veo ? "" : " abierto"}" aria-label="${etiqueta}">${cubilete("grande")}</button>
      <div class="mis-dados${veo ? "" : " tapados"}" aria-label="Tus dados">${dados || `<span class="toca">${ayuda}</span>`}</div>
      ${veo && ayuda ? `<p class="ayuda-dc">${ayuda}</p>` : ""}`;
  }

  function pintar(v, ev, p) {
    const { yo, n } = p;
    const nom = (j) => (j === yo ? "Vos" : p.nombre(j));
    const r = v.revelar, enVuelta = v.fase === "revelar" && r;
    const enRondaN = v.enRonda.filter((x, j) => x && v.vidas[j] > 0).length;
    p.estado(v.fase === "fin" ? "Terminó la partida" : `Ronda ${v.ronda} · ${enRondaN} en la ronda`);
    p.turno(v.fase === "mano" || v.fase === "responder" ? v.turno : null);

    const tieneCubo = v.fase === "mano" ? v.turno : v.fase === "responder" ? v.canto?.jugador : enVuelta ? r.de : null;
    for (let j = 0; j < n; j++) {
      const est = !v.vidas[j] ? `<span class="est fuera">sin vidas</span>` : !v.enRonda[j] && v.fase !== "fin" ? `<span class="est fuera">afuera esta ronda</span>` : "";
      p.sillaExtra(j).innerHTML = soles(v.vidas[j]) + rondas(v.puntos[j]) + est;
      if (j === yo) continue;
      p.sillaCartas(j).innerHTML = tieneCubo === j ? cubilete(`chico${v.turno === j ? " pensando" : ""}`) : "";
    }

    // centro
    let centro = "";
    if (enVuelta) {
      const que = `<b>${esc(nom(r.quien))}</b> ${r.quien === yo ? "desconfiaste" : "desconfió"} de <b>${esc(nom(r.de))}</b>, que ${r.de === yo ? "cantaste" : "cantó"} «${esc(nombreMano(r.mano))}».`;
      const pierde = r.verdad
        ? `${r.pierde === yo ? "Perdés una vida y tenés" : `${esc(nom(r.pierde))} pierde una vida y tiene`} que superarla.`
        : `${r.pierde === yo ? "Perdés una vida y quedás" : `${esc(nom(r.pierde))} pierde una vida y queda`} afuera de la ronda.`;
      centro = `<div class="vuelta-dc ${r.verdad ? "erra" : "acierta"}"><p>${que}</p>
        <div class="hay-dc">${fila(r.dados, "frase")}</div>
        <p class="hay">Había ${esc(r.nombreHay)}. ${r.verdad ? "Era cierto." : "¡Mentía!"}</p>
        <p class="pierde-dc">${pierde}</p></div>`;
    } else if (v.fase === "responder" && v.canto) {
      const c = v.canto;
      const previos = v.cadena.slice(0, -1).slice(-4);
      centro = `<div class="canto-dc"><small>${esc(nom(c.jugador))} ${c.jugador === yo ? "cantaste" : "canta"}${c.de0 ? "" : c.tiro ? ` · volvió a tirar ${c.tiro === 1 ? "un dado" : c.tiro}` : " · sin volver a tirar"}</small>
        <p class="nombre-dc">${esc(nombreMano(c.mano))}</p>
        ${fila(c.mano, "frase")}
        ${previos.length ? `<p class="cadena-dc">${previos.map((x) => `<span>${esc(nom(x.jugador))}: ${esc(nombreMano(x.mano))}</span>`).join("")}</p>` : ""}
        <p class="decide-dc">${v.turno === yo ? "¿Le creés?" : `${esc(p.nombre(v.turno))} decide si le cree…`}</p></div>`;
    } else if (v.fase === "mano") {
      const quien = v.turno === yo ? "Tenés el cubilete" : `${esc(p.nombre(v.turno))} tiene el cubilete`;
      const como = v.aSuperar
        ? `${v.turno === yo ? "Tenés" : "Tiene"} que superar <b>«${esc(nombreMano(v.aSuperar))}»</b>${v.tiro ? ` · volvió a tirar ${v.tiro.cuantos === 1 ? "un dado" : v.tiro.cuantos}` : ""}`
        : v.tiro ? "Tiró de cero" : "Tira de cero";
      centro = `<div class="canto-dc"><p class="abre-dc">${quien}</p><p class="supera-dc">${como}</p></div>`;
    }
    p.centro.innerHTML = centro;

    pintarZona(v, p);

    // controles
    const c = p.controles;
    if (v.puedoCantar && veoDados(v)) {
      const clave = `${turnoDe(v)}|${v.tiro?.cuantos ?? "-"}`;
      if (clave !== cantoClave || !canto) { canto = propuesta(v); cantoClave = clave; }
      const ok = supera(canto, v.aSuperar), verdad = esVerdad(v.mios, canto);
      const r0 = rango(canto), rMin = v.aSuperar ? rango(v.aSuperar) + 1 : 0;
      c.innerHTML = `<div class="armar-dc">
          <div class="cantar-dados" role="group" aria-label="Lo que vas a cantar: tocá un dado para cambiarle el número">${canto.map((d, i) => `<button type="button" class="dado-canto" data-k="${i}" aria-label="Dado ${i + 1}: ${d}">${dado(d)}</button>`).join("")}</div>
          <div class="paso-dc" role="group" aria-label="Mano"><button class="menos" aria-label="Una mano menos" ${r0 <= rMin ? "disabled" : ""}>−</button><button class="mas" aria-label="Una mano más" ${r0 >= MANOS.length - 1 ? "disabled" : ""}>+</button></div>
          <div class="atajos-dc"><button class="boton suave chico lo-mio">Lo que tengo</button>${v.aSuperar ? `<button class="boton suave chico lo-justo">Lo justo</button>` : ""}</div>
        </div>
        <button class="boton primario cantar" ${ok ? "" : "disabled"}>Cantar «${esc(nombreMano(canto))}»</button>
        <p class="aviso-canto ${!ok ? "no" : verdad ? "verdad" : "mentira"}" aria-live="polite">${!ok ? `No supera «${esc(nombreMano(v.aSuperar))}»` : verdad ? "Es verdad: lo tenés" : "Es mentira"}</p>`;
    } else if (v.puedoResponder) {
      c.innerHTML = `<button class="boton canto-creo" ${v.puedoCreer ? "" : "disabled"}>Le creo</button><button class="boton canto-desconfio">¡Desconfío!</button>
        ${v.puedoCreer ? "" : `<p class="aviso-canto no">No hay mano más alta: solo queda desconfiar.</p>`}`;
    } else {
      const nota = v.fase === "revelar" ? "Se levanta el cubilete…" : v.fase === "fin" ? "" : !v.vidas[yo] ? "Ya saliste." : esMio(v) ? "" : v.turno !== null ? `Le toca a ${esc(p.nombre(v.turno))}` : "";
      c.innerHTML = nota ? `<span class="ctrl-nota">${nota}</span>` : "";
    }
  }

  function alEventos(v, ev, p) {
    const nom = (j) => (j === p.yo ? "Vos" : p.nombre(j));
    for (const e of ev) {
      if (["ronda", "revancha", "cubilete", "creo"].includes(e.t)) { claveZona = ""; marcados = new Set(); canto = null; }
      if (e.t === "tiro") { sonido.play("carta"); if (e.jugador === p.yo) { claveZona = ""; marcados = new Set(); canto = null; } }
      else if (e.t === "canto") sonido.play("poner");
      else if (e.t === "creo") { sonido.play("tic"); if (e.jugador !== p.yo) p.aviso(`${nom(e.jugador)} ${e.de === p.yo ? "te" : "le"} creyó.`, 1800); }
      else if (e.t === "desconfio") { sonido.play("coincidencia"); p.grito("¡Desconfío!"); }
      else if (e.t === "pierde_vida") sonido.play(e.jugador === p.yo ? "perdiste" : "llevar");
      else if (e.t === "gana_ronda" && !ev.some((x) => x.t === "fin")) { sonido.play("ya"); p.grito(e.jugador === p.yo ? "¡Ronda para vos!" : `Ronda para ${nom(e.jugador)}`, 1700); }
      else if (e.t === "sale") p.aviso(e.jugador === p.yo ? "Te quedaste sin vidas." : `${nom(e.jugador)} se quedó sin vidas.`);
    }
    if (ev.some((e) => e.t === "tiro" && e.jugador === p.yo)) requestAnimationFrame(() => cont.querySelector(".mis-dados")?.classList.add("caen"));
  }

  const final = (v) => {
    const gane = v.ganador === v.yo;
    return {
      gane,
      titulo: gane ? "¡Ganaste!" : `Ganó ${v.ganador === null ? "" : v.nombres[v.ganador] || "otro"}`,
      html: `<p>${gane ? "Fuiste el último con vidas." : "Fue el último con vidas."}</p>
        <ol class="tabla-porotos">${v.orden.map((j, k) => `<li class="${j === v.yo ? "yo" : ""}"><b>${j === v.yo ? "Vos" : esc(v.nombres[j])}</b><span>${k + 1}º · ${v.puntos[j]} ${v.puntos[j] === 1 ? "ronda" : "rondas"}</span></li>`).join("")}</ol>`,
    };
  };

  const desmontar = montarMesaN(cont, {
    fuente, salir, otraMesa, clase: "desconfio", titulo: "Desconfío",
    pintar: (v, ev, p) => { vActual = v; pActual = p; pintar(v, ev, p); }, alEventos, final,
  });
  cont.querySelector(".mesa-n").insertAdjacentHTML("afterbegin", DEFS);
  const repintar = () => { if (pActual) pintar(vActual, [], pActual); };

  async function mandar(accion, b) {
    if (enviando) return null;
    enviando = true;
    if (b) b.disabled = true;
    const r = await fuente.enviar(accion);
    enviando = false;
    if (r) { sonido.play("rechazo"); pActual?.aviso(r.mensaje); if (b) b.disabled = false; }
    return r;
  }
  function sacudir(despues) {
    const cubo = cont.querySelector(".cubo-mio");
    if (!cubo || sacudiendo) return;
    sonido.play("carta");
    if (QUIETO) { despues?.(); return; }
    cubo.classList.add("sacude");
    sacudiendo = setTimeout(() => { sacudiendo = 0; cubo.classList.remove("sacude"); despues?.(); }, 720);
  }
  function tocarCubilete() {
    const v = vActual;
    if (!esMio(v)) return;
    if (!v.aSuperar && v.puedoTirar) { sacudir(() => mandar({ t: "tirar", guarda: [] })); return; }
    if (!veoDados(v)) { sacudir(() => { mirado = turnoDe(vActual); claveZona = ""; repintar(); cont.querySelector(".mis-dados")?.classList.add("caen"); }); return; }
    if (v.puedoTirar) {
      if (!marcados.size) { pActual?.aviso("Tocá primero los dados que querés volver a tirar.", 2200); return; }
      const guarda = [0, 1, 2, 3, 4].filter((i) => !marcados.has(i));
      sacudir(() => mandar({ t: "tirar", guarda }));
      return;
    }
    sacudir();
  }
  function onClick(e) {
    const v = vActual;
    if (e.target.closest(".cubo-mio")) { tocarCubilete(); return; }
    const dm = e.target.closest(".dado-dc[data-i]");
    if (dm) { const i = Number(dm.dataset.i); if (marcados.has(i)) marcados.delete(i); else marcados.add(i); sonido.play("tic"); claveZona = ""; repintar(); return; }
    if (e.target.closest(".canto-desconfio")) { mandar({ t: "desconfio" }, e.target.closest("button")); return; }
    if (e.target.closest(".canto-creo")) { mandar({ t: "creo" }, e.target.closest("button")); return; }
    if (!canto) return;
    const dc = e.target.closest(".dado-canto");
    if (dc) { const k = Number(dc.dataset.k); canto = canto.map((d, i) => (i === k ? (d % 6) + 1 : d)); sonido.play("tic"); repintar(); return; }
    const rMin = v.aSuperar ? rango(v.aSuperar) + 1 : 0;
    if (e.target.closest(".mas")) { const r = Math.min(MANOS.length - 1, Math.max(rMin, rango(canto) + 1)); canto = [...MANOS[r]]; sonido.play("tic"); repintar(); return; }
    if (e.target.closest(".menos")) { const r = Math.max(rMin, rango(canto) - 1); canto = [...MANOS[r]]; sonido.play("tic"); repintar(); return; }
    if (e.target.closest(".lo-mio")) { canto = [...v.mios]; sonido.play("tic"); repintar(); return; }
    if (e.target.closest(".lo-justo")) { canto = minimaQueSupera(v.aSuperar); sonido.play("tic"); repintar(); return; }
    const b = e.target.closest(".cantar");
    if (b) { if (!supera(canto, v.aSuperar)) { pActual?.aviso(`Tenés que superar «${nombreMano(v.aSuperar)}».`); return; } mandar({ t: "cantar", mano: ordenMano(canto) }, b); }
  }
  cont.addEventListener("click", onClick);
  return () => { cont.removeEventListener("click", onClick); clearTimeout(sacudiendo); desmontar(); };
}
