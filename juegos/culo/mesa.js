// Mesa del CULO SUCIO (2026-11-18), sobre el esqueleto común de a varios (nucleo/mesa-n.js).
// Cada silla: cuántas cartas le quedan (en abanico de dorsos), si ya salió o si tiró sus últimas. Al centro, la pila boca
// abajo con lo que se viene diciendo («Rata tiró dos sietes») y, cuando alguien desconfía, las cartas dadas vuelta con
// el veredicto. Abajo, tu mano: tocás de 1 a 4 cartas, al abrir elegís qué número decís, y «Tirar». El «¡Desconfío!»
// aparece siempre que se puede, sea o no tu turno.
import { montarMesaN, esc } from "../../nucleo/mesa-n.js";
import { frente, dorso, ROTULO } from "../../nucleo/cartas.js";
import { sonido } from "../../nucleo/sonido.js";
import { NUMEROS, numero, dicho, nombreNumero } from "./motor.js";

const ETIQ = { 10: "S", 11: "C", 12: "R" };
const carta = (id, cls = "", attrs = "") => `<span class="carta-s ${cls}" ${attrs}>${id ? frente(id) : dorso()}</span>`;
const giro = (k) => ((k * 37) % 13) - 6;

export function montarMesa(cont, { fuente, salir, otraMesa }) {
  const antes = ROTULO.texto;
  ROTULO.texto = "culo sucio";
  let elegidas = [], numeroElegido = null;

  function pintar(v, ev, p) {
    const { yo, n } = p;
    const nom = (j) => (j === yo ? "Vos" : p.nombre(j));
    // si cambió la mano (levanté la pila o tiré), limpio la selección
    elegidas = elegidas.filter((c) => v.mano.includes(c));
    if (v.fase !== "abrir" || v.turno !== yo) numeroElegido = null;
    const r = v.ronda;
    p.estado(v.fase === "fin" ? "Terminó la partida" : r ? `Ronda de ${nombreNumero(r.numero)}` : v.turno === yo ? "Abrís vos: elegí qué decís" : `Abre ${p.nombre(v.turno)}`);
    p.turno(v.fase === "abrir" || v.fase === "seguir" ? v.turno : null);

    for (let j = 0; j < n; j++) {
      const k = v.enMano[j], puesto = v.fuera.indexOf(j);
      const est = v.fase === "fin" && v.culo === j ? `<span class="est culo">culo sucio</span>`
        : puesto >= 0 ? `<span class="est fuera">afuera ${puesto + 1}º</span>`
        : v.pendiente === j ? `<span class="est ultimas">¡tiró las últimas!</span>` : "";
      p.sillaExtra(j).innerHTML = `${j !== yo ? `<span class="cuenta-cartas">${k} ${k === 1 ? "carta" : "cartas"}</span>` : ""}${est}`;
      if (j !== yo) p.sillaCartas(j).innerHTML = `<span class="abanico">${Array.from({ length: Math.min(k, 6) }, (_, i) => `<span class="dorso-mini" style="--i:${i - (Math.min(k, 6) - 1) / 2}">${dorso()}</span>`).join("")}</span>`;
    }

    // centro
    const rv = v.revelar;
    let centro = `<div class="pila-culo" aria-label="Pila: ${v.pila} cartas">${v.pila ? Array.from({ length: Math.min(v.pila, 7) }, (_, i) => `<span class="dorso-pila" style="--g:${giro(i)}deg;--y:${-i * 2}px">${dorso()}</span>`).join("") : `<span class="pila-vacia">pila vacía</span>`}${v.pila ? `<b>${v.pila}</b>` : ""}</div>`;
    if (rv) {
      centro += `<div class="revelar-culo ${rv.mintio ? "mintio" : "verdad"}">
        <p><b>${esc(nom(rv.desconfia))}</b> ${rv.desconfia === yo ? "desconfiaste" : "desconfió"} de <b>${esc(nom(rv.jugador))}</b>, que dijo ${esc(dicho(rv.cartas.length, rv.numero))}:</p>
        <div class="reveladas">${rv.cartas.map((c) => carta(c, numero(c) === rv.numero ? "bien" : "mal")).join("")}</div>
        <p class="veredicto">${rv.mintio ? "¡Mentía!" : "¡Era verdad!"} <span>${esc(nom(rv.toma))} ${rv.toma === yo ? "te llevás" : "se lleva"} la pila (${rv.pila}).</span></p></div>`;
    } else if (r && v.ultima) {
      const u = v.ultima;
      centro += `<div class="dicho-culo"><p class="lo-dicho"><b>${esc(nom(u.jugador))}</b> ${u.jugador === yo ? "dijiste" : "dijo"} <em>${esc(dicho(u.n, r.numero))}</em></p>
        <p class="ronda-hist">${r.jugadas.map((x) => `${esc(nom(x.jugador))} ${x.n}`).join(" · ")}</p></div>`;
    } else if (v.fase === "abrir") centro += `<div class="dicho-culo"><p class="lo-dicho">${v.turno === yo ? "Abrís vos. Elegí cartas y qué número decís." : `Abre ${esc(p.nombre(v.turno))}…`}</p></div>`;
    p.centro.innerHTML = centro;

    // mi mano
    p.miZona.innerHTML = `<div class="mano-culo" role="group" aria-label="Tu mano">${v.mano.map((c) => carta(c, elegidas.includes(c) ? "elegida" : "", `data-c="${c}" role="button" tabindex="0" aria-pressed="${elegidas.includes(c)}" aria-label="${c}"`)).join("")}</div>`;
    p.miExtra.innerHTML = `<span class="cuenta-cartas">${v.mano.length} ${v.mano.length === 1 ? "carta" : "cartas"}</span>${v.fuera.includes(yo) ? `<span class="est fuera">afuera ${v.fuera.indexOf(yo) + 1}º</span>` : v.pendiente === yo ? `<span class="est ultimas">tiraste las últimas</span>` : ""}`;

    // controles
    const c = p.controles;
    const miTurno = (v.fase === "abrir" || v.fase === "seguir") && v.turno === yo;
    const duda = v.puedoDesconfiar ? `<button class="boton desconfio">¡Desconfío!</button>` : "";
    const confio = v.puedoConfiar ? `<button class="boton confio">Confío</button>` : "";
    if (v.fase === "fin") c.innerHTML = "";
    else if (miTurno && v.fase === "abrir") {
      c.innerHTML = `<div class="numeros" role="radiogroup" aria-label="Qué número decís">${NUMEROS.map((x) => `<button class="num${numeroElegido === x ? " si" : ""}" data-num="${x}" role="radio" aria-checked="${numeroElegido === x}" aria-label="${nombreNumero(x)}">${ETIQ[x] || x}</button>`).join("")}</div>`
        + `<button class="boton primario tirar" ${elegidas.length && numeroElegido ? "" : "disabled"}>${elegidas.length && numeroElegido ? `Tirar: «${dicho(elegidas.length, numeroElegido)}»` : elegidas.length ? "Elegí qué número decís" : "Elegí de 1 a 4 cartas"}</button>`;
    } else if (miTurno && v.fase === "seguir" && !v.puedoConfiar) {
      c.innerHTML = `${duda}<button class="boton primario tirar" ${elegidas.length ? "" : "disabled"}>${elegidas.length ? `Confío y tiro: «${dicho(elegidas.length, r.numero)}»` : `Elegí cartas para decir ${nombreNumero(r.numero)}`}</button>`;
    } else if (duda || confio) c.innerHTML = `${confio}${duda}${!miTurno ? `<span class="ctrl-nota">Le toca a ${esc(p.nombre(v.turno))}</span>` : ""}`;
    else c.innerHTML = `<span class="ctrl-nota">${v.fase === "revelar" ? "Dando vuelta las cartas…" : v.fuera.includes(yo) ? "Ya saliste: mirá cómo se ensucian." : v.turno !== null ? `Le toca a ${esc(p.nombre(v.turno))}` : ""}</span>`;

  }

  function alEventos(v, ev, p) {
    const nom = (j) => (j === p.yo ? "Vos" : p.nombre(j));
    for (const e of ev) {
      if (e.t === "tiro") sonido.play("poner");
      else if (e.t === "desconfio") { sonido.play("coincidencia"); p.grito(e.jugador === p.yo ? "¡Desconfío!" : `¡${nom(e.jugador)} desconfía!`); }
      else if (e.t === "levanta") sonido.play("llevar");
      else if (e.t === "sale") { sonido.play("ya"); p.aviso(e.jugador === p.yo ? `¡Saliste ${e.puesto}º!` : `${nom(e.jugador)} salió ${e.puesto}º`); }
      else if (e.t === "ultimas" && e.jugador !== p.yo) p.aviso(`${nom(e.jugador)} tiró sus últimas cartas. ¿Le creés?`, 3200);
      else if (e.t === "reparto" || e.t === "revancha") { elegidas = []; numeroElegido = null; }
    }
  }

  const final = (v) => {
    const soyCulo = v.culo === v.yo;
    const filas = [...v.fuera, ...(v.culo !== null ? [v.culo] : [])];
    return {
      gane: !soyCulo,
      titulo: soyCulo ? "Culo sucio" : v.fuera[0] === v.yo ? "¡Saliste primero!" : "¡Te salvaste!",
      html: `${soyCulo ? `<p>Te quedaste con las cartas.</p>` : v.culo !== null ? `<p>El culo sucio es ${esc(v.nombres[v.culo])}.</p>` : ""}
        <ol class="tabla-porotos">${filas.map((j, k) => `<li class="${j === v.yo ? "yo" : ""}"><b>${j === v.yo ? "Vos" : esc(v.nombres[j])}</b>${j === v.culo ? "<small>culo sucio</small>" : `<span>${k + 1}º</span>`}</li>`).join("")}</ol>`,
    };
  };

  let vActual = fuente.vista(), pActual = null;
  const desmontar = montarMesaN(cont, {
    fuente, salir, otraMesa, clase: "culo", titulo: "Culo sucio",
    pintar: (v, ev, p) => { vActual = v; pActual = p; pintar(v, ev, p); }, alEventos, final,
  });
  const repintar = () => { if (pActual) pintar(vActual, [], pActual); };

  async function mandar(accion, b) {
    if (b) b.disabled = true;
    const r = await fuente.enviar(accion);
    if (r) { sonido.play("rechazo"); pActual?.aviso(r.mensaje); if (b) b.disabled = false; }
  }
  function tocarCarta(id) {
    const v = vActual;
    if (elegidas.includes(id)) elegidas = elegidas.filter((x) => x !== id);
    else if (elegidas.length < 4) elegidas = [...elegidas, id];
    else { pActual?.aviso("Hasta 4 cartas por vez."); return; }
    // al abrir, si todavía no elegiste número, propongo el de la primera carta (podés cambiarlo y mentir)
    if (v.fase === "abrir" && v.turno === v.yo && numeroElegido === null && elegidas.length) numeroElegido = numero(elegidas[0]);
    sonido.play("tic");
    repintar();
  }
  function onClick(e) {
    const c = e.target.closest(".mano-culo [data-c]");
    if (c) { tocarCarta(c.dataset.c); return; }
    const nb = e.target.closest("[data-num]");
    if (nb) { numeroElegido = Number(nb.dataset.num); repintar(); return; }
    if (e.target.closest(".desconfio")) { mandar({ t: "desconfio" }, e.target.closest("button")); return; }
    if (e.target.closest(".confio")) { mandar({ t: "confio" }, e.target.closest("button")); return; }
    const t = e.target.closest(".tirar");
    if (t && elegidas.length) {
      const v = vActual;
      const accion = v.fase === "abrir" ? { t: "tirar", cartas: [...elegidas], numero: numeroElegido } : { t: "tirar", cartas: [...elegidas] };
      elegidas = [];
      mandar(accion, t);
    }
  }
  function onKey(e) {
    const c = e.target.closest?.(".mano-culo [data-c]");
    if (c && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); tocarCarta(c.dataset.c); }
  }
  cont.addEventListener("click", onClick);
  cont.addEventListener("keydown", onKey);
  return () => { cont.removeEventListener("click", onClick); cont.removeEventListener("keydown", onKey); desmontar(); ROTULO.texto = antes; };
}
