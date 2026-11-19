// Dados y cubilete «Eclipse» del Desconfío (dirección B de htmls/dados-direcciones.html, elegida por Pedro el 2026-11-18):
// dados azul esmaltado con puntos de oro; el as es un sol eclipsado (el anillo de los bots), por eso se lee como comodín.
// El cubilete es negro con la boca encendida, como un eclipse visto de costado.
const PIPS = { 2: [[28, 28], [72, 72]], 3: [[28, 28], [50, 50], [72, 72]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]], 5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]], 6: [[28, 26], [72, 26], [28, 50], [72, 50], [28, 74], [72, 74]] };
const NOM = { 1: "as", 2: "dos", 3: "tres", 4: "cuatro", 5: "cinco", 6: "seis" };

// los degradados van una sola vez en la página (un <svg> oculto con los <defs>), así cada dado es liviano
export const DEFS = `<svg class="dados-defs" width="0" height="0" aria-hidden="true" focusable="false" style="position:absolute"><defs>
  <linearGradient id="dc-cara" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2d3770"/><stop offset=".55" stop-color="#18204a"/><stop offset="1" stop-color="#0d1230"/></linearGradient>
  <linearGradient id="dc-vaso" x1="0" x2="1"><stop offset="0" stop-color="#05060d"/><stop offset=".5" stop-color="#1b2040"/><stop offset="1" stop-color="#05060d"/></linearGradient>
  <radialGradient id="dc-boca"><stop offset=".6" stop-color="#E9B54A" stop-opacity="0"/><stop offset=".8" stop-color="#F4CE76" stop-opacity=".9"/><stop offset="1" stop-color="#E9B54A" stop-opacity="0"/></radialGradient>
</defs></svg>`;

/** Un dado. `cls` suma clases (cuenta, apagado, mini…). */
export function dado(n, cls = "") {
  const cara = n === 1
    ? `<circle cx="50" cy="50" r="22" fill="#E9B54A" opacity=".22"/><circle cx="50" cy="50" r="17" fill="none" stroke="#F4CE76" stroke-width="5"/><circle cx="50" cy="50" r="12.5" fill="#0b0e1d"/><circle cx="62" cy="40" r="3.4" fill="#fff6dc"/>`
    : (PIPS[n] || []).map(([x, y]) => `<circle cx="${x}" cy="${y}" r="10" fill="#E9B54A" opacity=".16"/><circle cx="${x}" cy="${y}" r="7" fill="#F1C75F"/>`).join("");
  return `<svg class="dado ${cls}" viewBox="0 0 100 100" role="img" aria-label="${n === 1 ? "as" : NOM[n] || "?"}"><rect x="5" y="8" width="92" height="92" rx="22" fill="#000" opacity=".45"/><rect x="3" y="3" width="92" height="92" rx="22" fill="url(#dc-cara)" stroke="#3d4889" stroke-width="1.5"/><path d="M14 12 Q48 6 84 12" stroke="#C7CCE4" stroke-width="2.5" fill="none" opacity=".35" stroke-linecap="round"/>${cara}</svg>`;
}

/** El cubilete (tapado). */
export function cubilete(cls = "") {
  return `<svg class="cubilete ${cls}" viewBox="0 0 100 110" aria-hidden="true">
    <ellipse cx="50" cy="104" rx="40" ry="5" fill="#E9B54A" opacity=".18"/>
    <path d="M18 20 Q16 62 22 100 L78 100 Q84 62 82 20 Z" fill="url(#dc-vaso)"/>
    <ellipse cx="50" cy="20" rx="40" ry="11" fill="url(#dc-boca)"/>
    <ellipse cx="50" cy="20" rx="33" ry="8" fill="#03040a"/>
    <path d="M22 100 L78 100" stroke="#C7CCE4" stroke-width="1.5" opacity=".5"/></svg>`;
}
