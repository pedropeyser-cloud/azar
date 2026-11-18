// El cielo de AZAR: el eclipse 3D (nucleo/eclipse.js) de fondo, fijo detrás de todo, montado una sola vez.
// El inicio le dice dónde va (un elemento «ancla» marca el centro y el tamaño de la luna) y dónde está el horizonte
// (la franja de luz del mostrador). Al abrir un juego, la luna cierra la totalidad y la oscuridad se vuelve la mesa;
// al volver, se abre. Si el 3D no arranca (sin WebGL2, Safari en un iframe, error), queda el cuadro fijo o nada:
// nunca rompe el inicio. `?fps=1` muestra los cuadros por segundo arriba a la izquierda (para medir en un celular).
import { montarEclipse } from "./eclipse.js";

let ec = null, canvas = null, ancla = null, horizonte = null, medidor = null;

function rectDe(el) { const r = el?.getBoundingClientRect?.(); return r && r.width > 0 && innerHeight > 0 ? r : null; }

export function montarCielo() {
  if (canvas) return;
  canvas = document.createElement("canvas");
  canvas.className = "cielo";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);
  try {
    ec = montarEclipse(canvas, {
      centro: () => { const r = rectDe(ancla); return r ? [(r.left + r.width / 2) / innerWidth, (r.top + r.height / 2) / innerHeight] : null; },
      radio: () => { const r = rectDe(ancla); return r ? (r.width / 2) / innerHeight : null; },
      horizonte: () => { const r = rectDe(horizonte); return r ? r.top / innerHeight : null; },
    });
  } catch (e) { console.warn("eclipse: no arrancó", e); ec = null; }
  if (new URLSearchParams(location.search).get("fps")) {
    medidor = document.createElement("div");
    medidor.className = "medidor-fps";
    document.body.append(medidor);
    setInterval(() => { const i = ec?.info?.() || {}; medidor.textContent = `${i.modo || "sin eclipse"} · ${Math.round(i.fps || 0)} fps · ${i.nivel ?? ""} · ${i.renderer || ""}`.slice(0, 120); }, 1000);
  }
}

/** El inicio marca dónde va la luna y la línea del horizonte. */
export function anclar(elAncla, elHorizonte) { ancla = elAncla; horizonte = elHorizonte; }

const conTope = (p, ms) => Promise.race([Promise.resolve(p).catch(() => false), new Promise((r) => setTimeout(() => r(false), ms))]);

/** La luna cierra y la pantalla queda en el azul de la mesa. Nunca espera más de 2,6 s. */
export async function cerrarCielo() { if (!ec) return; await conTope(ec.cerrar(), 2600); ec.pausar?.(); }
/** Vuelve la luz (al volver al inicio). */
export function abrirCielo() { if (!ec) return; ec.reanudar?.(); ec.abrir?.(); }
/** Anillo de diamante breve (se conectó un amigo). */
export function destello() { try { ec?.destello?.(); } catch { /* ok */ } }
export const infoCielo = () => ec?.info?.() || null;
