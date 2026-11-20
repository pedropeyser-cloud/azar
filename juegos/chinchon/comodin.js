// El comodín del chinchón: «Eclipse» (Pedro eligió la A el 2026-11-20 entre tres propuestas; la página con las tres
// queda en htmls/chinchon-comodines.html). La baraja española de AZAR (nucleo/cartas.js) no tiene comodín: acá se dibuja
// con el mismo trazo (papel, tinta, índice ámbar, título en Cormorant como las figuras). El sol tapado de AZAR: disco
// negro con la corona de oro, la única luz del frente. `cartaSVG(id)` dibuja cualquier carta del chinchón.
import { C, frente } from "../../nucleo/cartas.js";
import { esComodin } from "./motor.js";

const W = 600, H = 860;
const NS = 'stroke-linecap="round" stroke-linejoin="round" fill="none"';

function eclipse(cx, cy, r, tinta, oro, sw) {
  let rayos = "";
  for (let k = 0; k < 12; k++) {
    const a = k * Math.PI / 6 + Math.PI / 12, x = Math.cos(a), y = Math.sin(a);
    rayos += `<line x1="${(cx + r * 1.42 * x).toFixed(1)}" y1="${(cy + r * 1.42 * y).toFixed(1)}" x2="${(cx + r * 1.82 * x).toFixed(1)}" y2="${(cy + r * 1.82 * y).toFixed(1)}" stroke="${tinta}" stroke-width="${sw}" ${NS}/>`;
  }
  return `<circle cx="${cx}" cy="${cy}" r="${r * 1.18}" stroke="${oro}" stroke-width="${sw * 1.5}" ${NS}/><circle cx="${cx}" cy="${cy}" r="${r}" fill="${tinta}"/>${rayos}`;
}
const INDICE = `<g>${eclipse(66, 78, 17, C.ambarP, C.ambarP, 5)}</g>`;
const TITULO = `<text x="300" y="240" text-anchor="middle" font-family="Cormorant Garamond, Georgia, serif" font-weight="600" font-size="118" fill="${C.tinta}">comodín</text>`;
const SVG = `<svg class="svg-carta" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="${W}" height="${H}" rx="30" fill="${C.papel}"/>${TITULO}${eclipse(300, 520, 104, C.tinta, C.ambar, 11)}${INDICE}<g transform="rotate(180 300 430)">${INDICE}</g></svg>`;

export const comodin = () => SVG;
export const cartaSVG = (id) => (esComodin(id) ? SVG : frente(id));
