// Mesa del SIETE Y MEDIO (2026-11-18), sobre el esqueleto común de a varios (nucleo/mesa-n.js).
// Cada silla: porotos, lo que apostó, la marca de banca y sus cartas (la tapada de los demás se ve de dorso hasta que se
// pasan o termina la mano). Al centro, el mazo y el resultado de la mano. Abajo, tus cartas con tu total y los botones:
// las fichas para apostar (de 1 a 5) y «Carta» / «Me planto» cuando te toca.
import { montarMesaN, esc } from "../../nucleo/mesa-n.js";
import { frente, dorso, ROTULO } from "../../nucleo/cartas.js";
import { sonido } from "../../nucleo/sonido.js";
import { total, mostrar, TOPE_APUESTA } from "./motor.js";

const POROTO = `<svg class="poroto" viewBox="0 0 20 14" aria-hidden="true"><path d="M3 7.5C2 3 7 1 10.5 2.6c2 .9 2.6.2 4.4-.4C18 1.4 19.6 5 18.6 8.4 17.4 12.6 11 13.6 6.6 12.6 4.4 12 3.4 9.6 3 7.5z"/><path d="M8 4.6c1.4 1 3.4 1.1 5 .2" fill="none"/></svg>`;
const porotos = (k) => `<span class="porotos" title="${k} porotos">${POROTO}<b>${k}</b></span>`;
const carta = (id, cls = "") => `<span class="carta-s ${cls}">${id ? frente(id) : dorso()}</span>`;

export function montarMesa(cont, { fuente, salir, otraMesa }) {
  const antes = ROTULO.texto;
  ROTULO.texto = "siete y medio";
  let vistos = [];   // cuántas cartas ya mostré de cada uno (para animar solo las nuevas)

  function pintar(v, ev, p) {
    const { yo, n } = p;
    const enMano = (j) => v.porotos[j] > 0 || v.cartas[j].length > 0;
    // estado de arriba
    const bancaNom = j => (j === yo ? "vos" : p.nombre(j));
    p.estado(v.fase === "fin" ? "Terminó la partida" : `Mano ${v.manoN} · banca: ${bancaNom(v.banca)}`);
    p.turno(v.fase === "turnos" || v.fase === "banca" ? v.turno : null);

    for (let j = 0; j < n; j++) {
      const ext = p.sillaExtra(j), cs = v.cartas[j] || [];
      const visibles = cs.slice(1).filter(Boolean);
      const tVisible = total(visibles), tMio = cs.every(Boolean) ? total(cs) : null;
      const est = !enMano(j) ? "sin porotos"
        : v.paso[j] ? `se pasó · ${mostrar(total(cs.filter(Boolean)))}`
        : v.plantado[j] ? "se plantó"
        : v.turno === j && (v.fase === "turnos" || v.fase === "banca") ? (j === yo ? "te toca" : "pensando…")
        : v.fase === "apuesta" && j !== v.banca && v.apuesta[j] === null && v.porotos[j] > 0 ? "apostando…" : "";
      ext.innerHTML = `${j === v.banca ? `<span class="tag-banca">banca</span>` : ""}${porotos(v.porotos[j])}`
        + `${v.apuesta[j] ? `<span class="apuesta" title="Apostó ${v.apuesta[j]}">apostó ${v.apuesta[j]}</span>` : ""}`
        + `${j !== yo && visibles.length && !v.paso[j] && tMio === null ? `<span class="a-la-vista">a la vista ${mostrar(tVisible)}</span>` : ""}`
        + `${est ? `<span class="est${v.paso[j] ? " paso" : ""}">${esc(est)}</span>` : ""}`;
      // cartas: animo solo las que llegaron recién
      const zona = p.sillaCartas(j);
      const ya = vistos[j] ?? 0;
      zona.innerHTML = cs.map((c, k) => carta(c, `${k === 0 && !c ? "tapada" : ""}${k >= ya ? " nueva" : ""}${k === 0 && c && j === yo && v.fase !== "resultado" && v.fase !== "fin" ? " mia-tapada" : ""}`)).join("")
        + (j === yo && cs.length ? `<span class="mi-total${tMio > 7.5 ? " paso" : tMio === 7.5 ? " justo" : ""}" aria-label="Tu total">${mostrar(tMio ?? 0)}</span>` : "");
      vistos[j] = cs.length;
    }

    // centro: el mazo y, al cerrar la mano, cómo le fue a cada uno contra la banca
    const r = v.resultado;
    p.centro.innerHTML = `<div class="mazo-siete" aria-label="Mazo">${dorso()}<b>${v.mazo}</b></div>`
      + (v.fase === "resultado" && r ? `<div class="resultado-siete">
          <p class="res-banca">La banca${r.banca === yo ? " (vos)" : ` (${esc(p.nombre(r.banca))})`} ${r.bancaPaso ? "se pasó" : `se plantó con ${mostrar(r.totalBanca)}`}</p>
          <ul>${r.filas.map((f) => `<li class="${f.porotos > 0 ? "cobra" : "paga"}"><b>${f.jugador === yo ? "Vos" : esc(p.nombre(f.jugador))}</b>
            <span>${f.resultado === "paso" ? "se pasó" : mostrar(f.total)}${f.resultado === "doble" ? " · de mano, doble" : ""}</span>
            <em>${f.porotos > 0 ? "+" : ""}${f.porotos}</em></li>`).join("")}</ul></div>`
        : v.fase === "apuesta" ? `<p class="centro-nota">${v.banca === yo ? "Sos la banca: esperá las apuestas." : "Mirá tu tapada y apostá."}</p>`
        : v.fase === "banca" ? `<p class="centro-nota">Juega la banca${v.banca === yo ? ": te toca" : ""}.</p>` : "");

    // controles
    const c = p.controles;
    const miTurno = (v.fase === "turnos" || v.fase === "banca") && v.turno === yo;
    if (v.fase === "apuesta" && yo !== v.banca && v.porotos[yo] > 0 && v.apuesta[yo] === null) {
      const max = Math.min(TOPE_APUESTA, v.porotos[yo]);
      c.innerHTML = `<span class="ctrl-nota">Mirá tu tapada. ¿Cuánto apostás?</span>
        <div class="fichas">${Array.from({ length: max }, (_, k) => `<button class="ficha" data-n="${k + 1}" aria-label="Apostar ${k + 1}">${k + 1}</button>`).join("")}</div>`;
    } else if (miTurno) {
      const t = total(v.cartas[yo]);
      c.innerHTML = `<button class="boton primario pedir">Carta</button><button class="boton plantar">Me planto con ${mostrar(t)}</button>`;
    } else if (v.fase === "fin") c.innerHTML = "";
    else {
      const quien = v.fase === "apuesta" ? (yo === v.banca ? "Esperando las apuestas" : "Esperando a los demás") : v.turno !== null ? `Le toca a ${esc(p.nombre(v.turno))}` : v.fase === "resultado" ? "Ya viene la mano siguiente" : "";
      c.innerHTML = `<span class="ctrl-nota">${quien}</span>`;
    }
  }

  function alEventos(v, ev, p) {
    for (const e of ev) {
      if (e.t === "reparto") { vistos = []; sonido.play("carta"); }
      else if (e.t === "carta") sonido.play("carta");
      else if (e.t === "apuesta") sonido.play("tic");
      else if (e.t === "se_paso") { sonido.play(e.jugador === p.yo ? "perdiste" : "poner"); p.grito(e.jugador === p.yo ? "¡Te pasaste!" : `${p.nombre(e.jugador)} se pasó`); }
      else if (e.t === "siete_y_medio") { sonido.play("coincidencia"); p.grito(e.deMano ? "¡Siete y medio de mano!" : "¡Siete y medio!"); }
      else if (e.t === "banca" && e.jugador === p.yo) p.aviso("Te toca como banca: pedí o plantate.");
      else if (e.t === "resultado") sonido.play("llevar");
    }
  }

  const final = (v) => {
    const gs = v.ganadores?.length ? v.ganadores : [v.ganador];
    const gane = gs.includes(v.yo);
    const orden = v.porotos.map((k, j) => ({ j, k })).sort((a, b) => b.k - a.k);
    const nom = (j) => (j === v.yo ? "vos" : v.nombres[j] || "otro");
    return {
      gane,
      titulo: gs.length > 1 ? (gane ? "¡Empate arriba!" : `Empataron ${gs.map(nom).join(" y ")}`) : gane ? "¡Ganaste!" : `Ganó ${nom(gs[0])}`,
      html: `<ol class="tabla-porotos">${orden.map((x) => `<li class="${x.j === v.yo ? "yo" : ""}"><b>${x.j === v.yo ? "Vos" : esc(v.nombres[x.j])}</b>${porotos(x.k)}${v.perdedores.includes(x.j) ? "<small>sin porotos</small>" : ""}</li>`).join("")}</ol>`,
    };
  };

  const desmontar = montarMesaN(cont, { fuente, salir, otraMesa, clase: "siete", titulo: "Siete y medio", pintar, alEventos, final });
  // controles: delegado una vez
  cont.addEventListener("click", onClick);
  async function onClick(e) {
    const f = e.target.closest(".ficha"), pd = e.target.closest(".pedir"), pl = e.target.closest(".plantar");
    if (!f && !pd && !pl) return;
    const b = e.target.closest("button"); b.disabled = true;
    const r = await fuente.enviar(f ? { t: "apostar", n: Number(f.dataset.n) } : pd ? { t: "carta" } : { t: "plantarse" });
    if (r) { sonido.play("rechazo"); b.disabled = false; }
  }
  return () => { cont.removeEventListener("click", onClick); desmontar(); ROTULO.texto = antes; };
}
