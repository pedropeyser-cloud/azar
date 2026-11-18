// Sonido de ambiente de AZAR (etapa 4, 2026-11-18): espacial, turbio y esperanzador a la vez, entre ansiedad y calma.
// Todo sintetizado con WebAudio (sin archivos). Cuatro capas:
//   colchón  — re menor grave (re, la, fa) con osciladores desafinados y un filtro que respira: lo turbio.
//   latido   — un grave de 55 Hz que pulsa lento; crece con la intensidad: la ansiedad.
//   viento   — ruido filtrado que barre despacio: el espacio.
//   brillo   — campanitas sueltas en re mayor pentatónico (el fa# choca con el fa del colchón) con eco: la esperanza.
// La intensidad (0 a 1) sube al pasar el mouse o el dedo sobre los juegos y el eclipse y baja sola. En las mesas queda
// muy bajo para no tapar el juego. Arranca con el primer toque (los navegadores lo exigen) y se apaga con el botón.
import { contextoAudio } from "./sonido.js";

const CLAVE = "azar.ambiente";
let apagado = false;
try { apagado = localStorage.getItem(CLAVE) === "0"; } catch { /* sin almacenamiento */ }

let c = null, n = null;                 // contexto y nodos
let intensidad = 0.25, base = 0.25, enMesa = false, oculto = false, timerBrillo = 0, oyentes = [];

function impulso(ctx, seg = 3.8) {
  const largo = Math.floor(ctx.sampleRate * seg), b = ctx.createBuffer(2, largo, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < largo; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / largo, 2.6); }
  return b;
}

function armar() {
  c = contextoAudio();
  if (!c) return false;
  const maestro = c.createGain(); maestro.gain.value = 0;
  const comp = c.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 3;
  const sala = c.createConvolver(); sala.buffer = impulso(c);
  const humedo = c.createGain(); humedo.gain.value = 0.55;
  maestro.connect(comp).connect(c.destination);
  sala.connect(humedo).connect(comp);

  // colchón
  const filtro = c.createBiquadFilter(); filtro.type = "lowpass"; filtro.frequency.value = 320; filtro.Q.value = 0.7;
  const colchon = c.createGain(); colchon.gain.value = 0.5;
  filtro.connect(colchon); colchon.connect(maestro); colchon.connect(sala);
  for (const [f, v] of [[73.42, 0.22], [110, 0.16], [174.61, 0.1], [146.83, 0.08]]) {
    for (const det of [-7, 6]) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = det < 0 ? "sawtooth" : "triangle"; o.frequency.value = f; o.detune.value = det;
      g.gain.value = v * (det < 0 ? 0.55 : 1);
      o.connect(g).connect(filtro); o.start();
    }
  }
  const lfo = c.createOscillator(), lfoG = c.createGain(); lfo.frequency.value = 0.045; lfoG.gain.value = 140;
  lfo.connect(lfoG).connect(filtro.frequency); lfo.start();

  // latido: grave modulado en amplitud a ~0,8 Hz
  const sub = c.createOscillator(); sub.frequency.value = 55;
  const subG = c.createGain(); subG.gain.value = 0;
  const pulso = c.createOscillator(), pulsoG = c.createGain(); pulso.frequency.value = 0.8; pulsoG.gain.value = 0.5;
  const subAM = c.createGain(); subAM.gain.value = 0.5;
  pulso.connect(pulsoG).connect(subAM.gain);
  sub.connect(subAM).connect(subG).connect(maestro); sub.start(); pulso.start();

  // viento
  const nb = c.createBuffer(1, c.sampleRate * 4, c.sampleRate), nd = nb.getChannelData(0);
  let ult = 0; for (let i = 0; i < nd.length; i++) { ult = ult * 0.985 + (Math.random() * 2 - 1) * 0.15; nd[i] = ult; }
  const ruido = c.createBufferSource(); ruido.buffer = nb; ruido.loop = true;
  const banda = c.createBiquadFilter(); banda.type = "bandpass"; banda.frequency.value = 600; banda.Q.value = 0.8;
  const viento = c.createGain(); viento.gain.value = 0.25;
  const lfo2 = c.createOscillator(), lfo2G = c.createGain(); lfo2.frequency.value = 0.031; lfo2G.gain.value = 260;
  lfo2.connect(lfo2G).connect(banda.frequency); lfo2.start();
  ruido.connect(banda).connect(viento); viento.connect(maestro); viento.connect(sala); ruido.start();

  // brillo: eco largo
  const eco = c.createDelay(2); eco.delayTime.value = 0.62;
  const ecoG = c.createGain(); ecoG.gain.value = 0.38;
  const brillo = c.createGain(); brillo.gain.value = 0.5;
  brillo.connect(maestro); brillo.connect(sala); brillo.connect(eco); eco.connect(ecoG).connect(eco); ecoG.connect(sala);

  n = { maestro, filtro, subG, viento, brillo };
  aplicar(true);
  programarBrillo();
  return true;
}

const PENTA = [587.33, 659.25, 739.99, 880, 987.77, 1174.66];
function campana() {
  if (!c || !n) return;
  const t = c.currentTime, f = PENTA[Math.floor(Math.random() * PENTA.length)];
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06 + intensidad * 0.05, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
  for (const [m, v] of [[1, 1], [2.76, 0.18], [5.4, 0.06]]) {
    const o = c.createOscillator(), og = c.createGain(); o.frequency.value = f * m; og.gain.value = v; o.connect(og).connect(g); o.start(t); o.stop(t + 3.3);
  }
  const pan = c.createStereoPanner ? c.createStereoPanner() : null;
  if (pan) { pan.pan.value = Math.random() * 1.4 - 0.7; g.connect(pan).connect(n.brillo); } else g.connect(n.brillo);
}
function programarBrillo() {
  clearTimeout(timerBrillo);
  const espera = 7000 - intensidad * 5200 + Math.random() * 3000;  // tranquilo: cada 7-10 s; encendido: cada 2-5 s
  timerBrillo = setTimeout(() => { if (!apagado && !oculto && !enMesa) campana(); programarBrillo(); }, espera);
}

function nivel() { return apagado || oculto ? 0 : enMesa ? 0.05 : 0.11 + intensidad * 0.13; }
function aplicar(rapido = false) {
  if (!c || !n) return;
  const t = c.currentTime, tau = rapido ? 0.05 : 0.7;
  n.maestro.gain.setTargetAtTime(nivel(), t, apagado || oculto ? 0.25 : tau);
  n.filtro.frequency.setTargetAtTime(280 + intensidad * 1100, t, tau);
  n.subG.gain.setTargetAtTime(0.02 + intensidad * 0.16, t, tau);
  n.viento.gain.setTargetAtTime(0.18 + intensidad * 0.35, t, tau);
}

export const ambiente = {
  get encendido() { return !apagado; },
  /** Desde el primer toque de la persona. */
  despertar() { if (!c) armar(); else { if (c.state === "suspended") c.resume(); aplicar(); } },
  alternar() {
    apagado = !apagado;
    try { localStorage.setItem(CLAVE, apagado ? "0" : "1"); } catch { /* ok */ }
    if (!apagado) this.despertar(); else aplicar();
    oyentes.forEach((f) => f(!apagado));
    return !apagado;
  },
  alCambiar(f) { oyentes.push(f); },
  /** 0 a 1. Se suaviza solo; `base` es el reposo al que vuelve. */
  intensidad(x) { intensidad = Math.max(0, Math.min(1, x)); aplicar(); },
  reposo() { intensidad = base; aplicar(); },
  /** En una mesa queda casi mudo; en el inicio y los menús, normal. */
  mesa(si) { enMesa = !!si; if (!si) intensidad = base; aplicar(); },
  _estado: () => ({ armado: !!n, apagado, intensidad, enMesa, nivel: nivel() }),
};

document.addEventListener("visibilitychange", () => { oculto = document.hidden; aplicar(); });
const primerToque = () => { if (!apagado) ambiente.despertar(); };
addEventListener("pointerdown", primerToque, { once: true, capture: true });
addEventListener("keydown", primerToque, { once: true, capture: true });
globalThis.__ambiente = ambiente; // solo para las pruebas (scripts/): leer _estado()
