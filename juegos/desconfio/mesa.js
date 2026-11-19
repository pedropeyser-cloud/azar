// Mesa del DESCONFÍO (2026-11-18), sobre el esqueleto común de a varios (nucleo/mesa-n.js), con los dados «Eclipse».
// Cada silla: su cubilete tapado y cuántos dados le quedan; al cantar, sus dados a la vista (los que cuentan, arriba).
// Al centro, la apuesta en pie («cuatro» y el dado del cinco), quién la dijo y la cadena de la ronda; al cantar, la cuenta
// y quién pierde el dado. Abajo, tu cubilete y tus dados: al empezar cada ronda están tapados y se ven tocando el
// cubilete, que se sacude (Pedro: sin botón «Sacudir», se toca el cubilete). Para apostar: cantidad con − y +, el número
// tocando la cara, y «Apostar». Al lado, «¡Desconfío!» y «¡Confío!».
import { montarMesaN, esc } from "../../nucleo/mesa-n.js";
import { sonido } from "../../nucleo/sonido.js";
import { dicho, esValida, minimaCon, porQueNo, CARAS } from "./motor.js";
import { dado, cubilete, DEFS } from "./dados.js";

const cuenta = (d, cara, obligada) => d === cara || (d === 1 && cara !== 1 && !obligada);
const QUIETO = matchMedia("(prefers-reduced-motion: reduce)").matches;

export function montarMesa(cont, { fuente, salir, otraMesa }) {
  let visto = 0;              // la ronda cuyos dados ya miraste
  let sel = null;             // { c, cara } lo que estás armando para apostar
  let selSeq = -1;            // la jugada sobre la que armaste `sel`
  let claveZona = "", sacudiendo = 0;
  let vActual = fuente.vista(), pActual = null;

  /** Una apuesta de arranque razonable: subir lo mínimo con tu número más repetido (o el de la apuesta). */
  function propuesta(v) {
    const mio = (() => { let m = 2, k = -1; for (let cara = 2; cara <= 6; cara++) { const x = v.mios.filter((d) => cuenta(d, cara, v.obligada)).length; if (x > k) { k = x; m = cara; } } return m; })();
    const prefer = v.obligada ? (v.apuesta?.cara ?? v.mios[0] ?? 2) : mio;
    for (const cara of [prefer, v.apuesta?.cara, 2, 3, 4, 5, 6, 1].filter(Boolean)) { const c = minimaCon(v.apuesta, cara, v.total, v.obligada); if (c) return { c, cara }; }
    return null;
  }

  function pintarZona(v, p) {
    const enVuelta = v.fase === "revelar" && v.revelar;
    const mios = enVuelta ? v.revelar.dados[p.yo] : v.mios;
    const verlos = enVuelta || v.fase === "fin" || visto === v.ronda;
    const clave = `${v.ronda}|${mios.join()}|${verlos}|${enVuelta ? "v" : ""}|${v.cuantos[p.yo]}`;
    if (clave === claveZona) return;
    claveZona = clave;
    if (!v.cuantos[p.yo] && !enVuelta) { p.miZona.innerHTML = `<p class="sin-dados">Te quedaste sin dados. Mirá cómo termina.</p>`; return; }
    const r = v.revelar;
    p.miZona.innerHTML = `<button type="button" class="cubo-mio${verlos ? " abierto" : ""}" aria-label="${verlos ? "Sacudir el cubilete" : "Levantar el cubilete y ver tus dados"}">${cubilete("grande")}</button>
      <div class="mis-dados${verlos ? "" : " tapados"}" aria-label="Tus dados">${verlos
        ? mios.map((d) => dado(d, enVuelta ? (cuenta(d, r.cara, r.obligada) ? "dc-cuenta" : "dc-apagado") : "")).join("")
        : `<span class="toca">Tocá el cubilete para ver tus ${v.cuantos[p.yo]} ${v.cuantos[p.yo] === 1 ? "dado" : "dados"}</span>`}</div>`;
  }

  function pintar(v, ev, p) {
    const { yo, n } = p;
    const nom = (j) => (j === yo ? "Vos" : p.nombre(j));
    const r = v.revelar, enVuelta = v.fase === "revelar" && r;
    p.estado(v.fase === "fin" ? "Terminó la partida" : `Ronda ${v.ronda} · ${v.total} dados en la mesa${v.obligada ? " · obligada" : ""}`);
    p.turno(v.fase === "apostar" ? v.turno : null);

    for (let j = 0; j < n; j++) {
      const k = v.cuantos[j];
      const ult = [...v.cadena].reverse().find((x) => x.jugador === j);
      const puesto = v.fuera.indexOf(j);
      p.sillaExtra(j).innerHTML = `<span class="cuantos-dados" title="${k} dados">${k} ${k === 1 ? "dado" : "dados"}</span>`
        + (puesto >= 0 ? `<span class="est fuera">afuera</span>` : ult && v.fase === "apostar" ? `<span class="dijo">dijo ${esc(dicho(ult.c, ult.cara))}</span>` : "");
      if (j === yo) continue;
      const zona = p.sillaCartas(j);
      if (enVuelta && r.dados[j]?.length) zona.innerHTML = `<span class="dados-silla">${r.dados[j].map((d) => dado(d, `mini ${cuenta(d, r.cara, r.obligada) ? "dc-cuenta" : "dc-apagado"}`)).join("")}</span>`;
      else zona.innerHTML = k ? cubilete(`chico${v.turno === j ? " pensando" : ""}`) : "";
    }

    // centro
    let centro = "";
    if (enVuelta) {
      const ases = r.cara !== 1 && !r.obligada ? " (con los ases)" : "";
      const que = r.tipo === "desconfio"
        ? `<b>${esc(nom(r.quien))}</b> ${r.quien === yo ? "desconfiaste" : "desconfió"} de <b>${esc(nom(r.de))}</b>, que ${r.de === yo ? "dijiste" : "dijo"} ${esc(dicho(r.c, r.cara))}.`
        : `<b>${esc(nom(r.quien))}</b> ${r.quien === yo ? "confiaste" : "confió"}: ${esc(dicho(r.c, r.cara))} justos.`;
      const fallo = r.pierde !== null ? `${r.pierde === yo ? "Perdés" : `${esc(nom(r.pierde))} pierde`} un dado.` : r.gana !== null ? `${r.gana === yo ? "¡Recuperás" : `¡${esc(nom(r.gana))} recupera`} un dado!` : "Justo, pero ya tenía cinco.";
      centro = `<div class="vuelta-dc ${r.acierta ? "acierta" : "erra"}"><p>${que}</p>
        <p class="hay">Hay <b>${r.hay}</b>${ases}. ${r.tipo === "desconfio" ? (r.hay >= r.c ? "Era cierto." : "¡Mentía!") : r.acierta ? "¡Justo!" : "No era justo."}</p>
        <p class="pierde-dc">${fallo}</p></div>`;
    } else if (v.fase === "apostar") {
      if (v.apuesta) {
        const a = v.apuesta;
        centro = `<div class="apuesta-dc"><small>${esc(nom(a.jugador))} ${a.jugador === yo ? "dijiste" : "dijo"}</small>
          <p class="frase-dc" aria-label="${esc(dicho(a.c, a.cara))}"><span>${esc(dicho(a.c, a.cara).split(" ")[0])}</span>${dado(a.cara, "frase")}</p>
          ${v.cadena.length > 1 ? `<p class="cadena-dc">${v.cadena.slice(-6).map((x) => `<span>${esc(nom(x.jugador))} ${x.c}${dado(x.cara, "mini")}</span>`).join("")}</p>` : ""}</div>`;
      } else centro = `<div class="apuesta-dc"><p class="abre-dc">${v.turno === yo ? "Abrís vos." : `Abre ${esc(p.nombre(v.turno))}…`}</p></div>`;
      if (v.obligada) centro += `<p class="obligada-dc">Obligada: los ases no son comodines y no se cambia el número.</p>`;
    }
    p.centro.innerHTML = centro;

    pintarZona(v, p);
    p.miExtra.innerHTML = `<span class="cuantos-dados">${v.cuantos[yo]} ${v.cuantos[yo] === 1 ? "dado" : "dados"}</span>${v.fuera.includes(yo) ? `<span class="est fuera">afuera</span>` : ""}`;

    // controles
    const c = p.controles;
    if (v.puedoApostar) {
      if (selSeq !== v.seq || !sel || !esValida(v.apuesta, sel, v.total, v.obligada)) { sel = propuesta(v); selSeq = v.seq; }
      const caras = CARAS.filter((x) => !v.obligada || !v.apuesta || x === v.apuesta.cara);
      const minC = sel ? minimaCon(v.apuesta, sel.cara, v.total, v.obligada) : 1;
      c.innerHTML = (sel ? `<div class="armar-dc">
          <div class="paso-dc" role="group" aria-label="Cantidad"><button class="menos" aria-label="Uno menos" ${sel.c <= minC ? "disabled" : ""}>−</button><b aria-live="polite">${sel.c}</b><button class="mas" aria-label="Uno más" ${sel.c >= v.total ? "disabled" : ""}>+</button></div>
          <div class="caras-dc" role="radiogroup" aria-label="Qué número">${caras.map((x) => { const ok = minimaCon(v.apuesta, x, v.total, v.obligada) !== null; return `<button class="cara-dc${sel.cara === x ? " si" : ""}" data-cara="${x}" role="radio" aria-checked="${sel.cara === x}" ${ok ? "" : "disabled"}>${dado(x)}</button>`; }).join("")}</div>
        </div>
        <button class="boton primario apostar">Apostar: «${esc(dicho(sel.c, sel.cara))}»</button>` : "")
        + (v.puedoCantar ? `<button class="boton canto-confio">¡Confío!</button><button class="boton canto-desconfio">¡Desconfío!</button>` : "");
    } else c.innerHTML = `<span class="ctrl-nota">${v.fase === "revelar" ? "Se levantan los cubiletes…" : v.fase === "fin" ? "" : !v.cuantos[yo] ? "Ya saliste." : v.turno !== null ? `Le toca a ${esc(p.nombre(v.turno))}` : ""}</span>`;
  }

  function alEventos(v, ev, p) {
    const nom = (j) => (j === p.yo ? "Vos" : p.nombre(j));
    for (const e of ev) {
      if (e.t === "ronda" || e.t === "revancha") { claveZona = ""; sel = null; if (e.t === "ronda" && e.obligada) p.aviso(e.abre === p.yo ? "Obligada: abrís vos con tu único dado." : `Obligada de ${nom(e.abre)}: nadie cambia el número.`, 3400); }
      else if (e.t === "apuesta") sonido.play("poner");
      else if (e.t === "desconfio") { sonido.play("coincidencia"); p.grito("¡Desconfío!"); }
      else if (e.t === "confio") { sonido.play("coincidencia"); p.grito("¡Confío!"); }
      else if (e.t === "pierde_dado") sonido.play(e.jugador === p.yo ? "perdiste" : "llevar");
      else if (e.t === "gana_dado") sonido.play("ya");
      else if (e.t === "sale") p.aviso(e.jugador === p.yo ? "Te quedaste sin dados." : `${nom(e.jugador)} se quedó sin dados.`);
    }
  }

  const final = (v) => {
    const gane = v.ganador === v.yo;
    return {
      gane,
      titulo: gane ? "¡Ganaste!" : `Ganó ${v.ganador === null ? "" : v.nombres[v.ganador] || "otro"}`,
      html: `<p>${gane ? "Te quedaste con los últimos dados." : "Fue el último con dados."}</p>
        <ol class="tabla-porotos">${v.orden.map((j, k) => `<li class="${j === v.yo ? "yo" : ""}"><b>${j === v.yo ? "Vos" : esc(v.nombres[j])}</b><span>${k + 1}º</span></li>`).join("")}</ol>`,
    };
  };

  const desmontar = montarMesaN(cont, {
    fuente, salir, otraMesa, clase: "desconfio", titulo: "Desconfío",
    pintar: (v, ev, p) => { vActual = v; pActual = p; pintar(v, ev, p); }, alEventos, final,
  });
  cont.querySelector(".mesa-n").insertAdjacentHTML("afterbegin", DEFS);
  const repintar = () => { if (pActual) pintar(vActual, [], pActual); };

  function sacudir() {
    const v = vActual, cubo = cont.querySelector(".cubo-mio");
    if (!cubo || sacudiendo) return;
    const primera = visto !== v.ronda && v.fase === "apostar";
    sonido.play("carta");
    if (QUIETO) { visto = v.ronda; claveZona = ""; repintar(); return; }
    cubo.classList.add("sacude");
    cont.querySelector(".mis-dados")?.classList.add("tapados");
    sacudiendo = setTimeout(() => {
      sacudiendo = 0;
      if (primera) visto = v.ronda;
      claveZona = ""; repintar();
      cont.querySelector(".mis-dados")?.classList.add("caen");
    }, 720);
  }
  async function mandar(accion, b) {
    if (b) b.disabled = true;
    const r = await fuente.enviar(accion);
    if (r) { sonido.play("rechazo"); pActual?.aviso(r.mensaje); if (b) b.disabled = false; }
  }
  function onClick(e) {
    const v = vActual;
    if (e.target.closest(".cubo-mio")) { sacudir(); return; }
    if (e.target.closest(".canto-desconfio")) { mandar({ t: "desconfio" }, e.target.closest("button")); return; }
    if (e.target.closest(".canto-confio")) { mandar({ t: "confio" }, e.target.closest("button")); return; }
    if (!sel) return;
    const cb = e.target.closest("[data-cara]");
    if (cb && !cb.disabled) { const cara = Number(cb.dataset.cara); const min = minimaCon(v.apuesta, cara, v.total, v.obligada); sel = { cara, c: Math.max(min, Math.min(sel.c, v.total)) }; if (!esValida(v.apuesta, sel, v.total, v.obligada)) sel.c = min; sonido.play("tic"); repintar(); return; }
    if (e.target.closest(".mas")) { if (sel.c < v.total) sel = { ...sel, c: sel.c + 1 }; sonido.play("tic"); repintar(); return; }
    if (e.target.closest(".menos")) { const nuevo = { ...sel, c: sel.c - 1 }; if (esValida(v.apuesta, nuevo, v.total, v.obligada)) sel = nuevo; sonido.play("tic"); repintar(); return; }
    const ap = e.target.closest(".apostar");
    if (ap) { const no = porQueNo(v.apuesta, sel, v.total, v.obligada); if (no) { pActual?.aviso(no); return; } mandar({ t: "apostar", c: sel.c, cara: sel.cara }, ap); }
  }
  cont.addEventListener("click", onClick);
  return () => { cont.removeEventListener("click", onClick); clearTimeout(sacudiendo); desmontar(); };
}
