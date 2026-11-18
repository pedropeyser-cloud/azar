// Pantalla completa (etapa 4): los juegos la piden al empezar y tienen un botón para entrar y salir.
// En iPhone el navegador no deja (solo los videos): ahí el botón no aparece y no se pide nada.
const doc = document, raiz = doc.documentElement;
export const sePuede = () => !!(raiz.requestFullscreen || raiz.webkitRequestFullscreen) && !/iPhone|iPod/.test(navigator.userAgent);
export const enCompleta = () => !!(doc.fullscreenElement || doc.webkitFullscreenElement);

export async function entrar() {
  if (!sePuede() || enCompleta()) return;
  try { await (raiz.requestFullscreen ? raiz.requestFullscreen({ navigationUI: "hide" }) : raiz.webkitRequestFullscreen()); } catch { /* lo negó o no fue un toque */ }
}
export async function salir() {
  if (!enCompleta()) return;
  try { await (doc.exitFullscreen ? doc.exitFullscreen() : doc.webkitExitFullscreen()); } catch { /* ok */ }
}
export const alternar = () => (enCompleta() ? salir() : entrar());

const ICONO_ENTRAR = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>`;
const ICONO_SALIR = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>`;
export const iconoPantalla = () => (enCompleta() ? ICONO_SALIR : ICONO_ENTRAR);

/** Botón flotante para las pantallas de juego (abajo a la izquierda, chico). `mostrar(false)` lo esconde (en el inicio). */
let boton = null;
export function botonFlotante() {
  if (boton || !sePuede()) return { mostrar() {} };
  boton = doc.createElement("button");
  boton.className = "btn-pantalla";
  const pintar = () => { boton.innerHTML = iconoPantalla(); boton.setAttribute("aria-label", enCompleta() ? "Salir de pantalla completa" : "Pantalla completa"); boton.title = boton.getAttribute("aria-label"); };
  pintar();
  boton.addEventListener("click", () => alternar());
  doc.addEventListener("fullscreenchange", pintar); doc.addEventListener("webkitfullscreenchange", pintar);
  boton.hidden = true;
  doc.body.append(boton);
  return { mostrar(si) { boton.hidden = !si; } };
}
