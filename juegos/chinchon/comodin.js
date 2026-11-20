// El comodín del chinchón (2026-11-19). La baraja española de AZAR (nucleo/cartas.js) no tiene comodín: acá se dibuja
// con el mismo trazo (papel, tinta, índice ámbar en Manrope, título en Cormorant como las figuras). Tres propuestas para
// que Pedro elija (htmls/chinchon-comodines.html); cuando elija, queda una sola.
//   A «Eclipse»: el sol tapado de AZAR, disco negro con la corona de oro (la única luz del frente, como el halo de las bravas).
//   B «Sol y Luna»: un comodín con cara de sol y el otro con cara de luna.
//   C «Los cuatro palos»: una estrella con los cuatro palos alrededor: vale por cualquiera.
import { C, PALOS, sol } from "../../nucleo/cartas.js";

const W = 600, H = 860;
const NS = 'stroke-linecap="round" stroke-linejoin="round" fill="none"';
const titulo = (y = 250) => `<text x="300" y="${y}" text-anchor="middle" font-family="Cormorant Garamond, Georgia, serif" font-weight="600" font-size="118" fill="${C.tinta}">comodín</text>`;
const marco = (cuerpo, indice) => `<svg class="svg-carta" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="${W}" height="${H}" rx="30" fill="${C.papel}"/>${cuerpo}${indice}<g transform="rotate(180 300 430)">${indice}</g></svg>`;

// ---------- A «Eclipse» ----------
function eclipse(cx, cy, r, tinta, oro, sw) {
  let rayos = "";
  for (let k = 0; k < 12; k++) {
    const a = k * Math.PI / 6 + Math.PI / 12, x = Math.cos(a), y = Math.sin(a);
    rayos += `<line x1="${(cx + r * 1.42 * x).toFixed(1)}" y1="${(cy + r * 1.42 * y).toFixed(1)}" x2="${(cx + r * 1.82 * x).toFixed(1)}" y2="${(cy + r * 1.82 * y).toFixed(1)}" stroke="${tinta}" stroke-width="${sw}" ${NS}/>`;
  }
  return `<circle cx="${cx}" cy="${cy}" r="${r * 1.18}" stroke="${oro}" stroke-width="${sw * 1.5}" ${NS}/><circle cx="${cx}" cy="${cy}" r="${r}" fill="${tinta}"/>${rayos}`;
}
const indiceA = `<g>${eclipse(66, 78, 17, C.ambarP, C.ambarP, 5)}</g>`;
export const comodinA = () => marco(`${titulo(240)}${eclipse(300, 520, 104, C.tinta, C.ambar, 11)}`, indiceA);

// ---------- B «Sol y Luna» ----------
function carita(cx, cy, s, c, sw) {   // ojos cerrados y media sonrisa, en línea
  return `<path d="M${cx - 30 * s},${cy - 6 * s} q${12 * s},${-12 * s} ${24 * s},0 M${cx + 6 * s},${cy - 6 * s} q${12 * s},${-12 * s} ${24 * s},0 M${cx - 24 * s},${cy + 22 * s} q${24 * s},${22 * s} ${48 * s},0" stroke="${c}" stroke-width="${sw}" ${NS}/>`;
}
function luna(cx, cy, r, c, sw) {
  return `<path d="M${cx + r * 0.25},${cy - r} A${r},${r} 0 1 0 ${cx + r * 0.25},${cy + r} A${r * 1.35},${r * 1.35} 0 0 1 ${cx + r * 0.25},${cy - r} Z" stroke="${c}" stroke-width="${sw}" ${NS}/>`;
}
const estrella4 = (x, y, r, c, sw) => `<path d="M${x},${y - r} Q${x + r * .18},${y - r * .18} ${x + r},${y} Q${x + r * .18},${y + r * .18} ${x},${y + r} Q${x - r * .18},${y + r * .18} ${x - r},${y} Q${x - r * .18},${y - r * .18} ${x},${y - r} Z" stroke="${c}" stroke-width="${sw}" ${NS}/>`;
const indiceSol = `<g transform="translate(66,82) scale(.5)">${sol(C.ambarP, 9)}</g>`;
const indiceLuna = `<g>${luna(66, 80, 24, C.ambarP, 6)}</g>`;
export const comodinBsol = () => marco(`${titulo(240)}<g transform="translate(300,530) scale(2.9)">${sol(C.tinta, 11 / 2.9)}</g>${carita(300, 528, 1.05, C.tinta, 9)}`, indiceSol);
export const comodinBluna = () => marco(`${titulo(240)}${luna(290, 530, 150, C.tinta, 11)}${carita(222, 522, .8, C.tinta, 9)}${estrella4(450, 410, 26, C.tinta, 7)}${estrella4(470, 620, 18, C.tinta, 7)}${estrella4(420, 700, 12, C.tinta, 6)}`, indiceLuna);

// ---------- C «Los cuatro palos» ----------
const indiceC = `<g>${estrella4(66, 80, 26, C.ambarP, 7)}</g>`;
export const comodinC = () => marco(`${titulo(240)}${estrella4(300, 530, 92, C.tinta, 11)}
  <g transform="translate(300,368) scale(1)">${PALOS.espada(C.tinta, 9)}</g>
  <g transform="translate(462,530) scale(.95)">${PALOS.oro(C.tinta, 9)}</g>
  <g transform="translate(300,700) scale(1)">${PALOS.copa(C.tinta, 9)}</g>
  <g transform="translate(138,530) scale(1)">${PALOS.basto(C.tinta, 9)}</g>`, indiceC);

export const PROPUESTAS = {
  A: { nombre: "Eclipse", cartas: [comodinA, comodinA] },
  B: { nombre: "Sol y Luna", cartas: [comodinBsol, comodinBluna] },
  C: { nombre: "Los cuatro palos", cartas: [comodinC, comodinC] },
};
