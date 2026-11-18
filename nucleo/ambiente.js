// Sonido de ambiente de AZAR (etapa 4, 2026-11-18): espacial, turbio y esperanzador a la vez, entre ansiedad y calma.
// Todo sintetizado con WebAudio (sin archivos). Capas:
//   colchón  — re menor grave (re, la, fa) con osciladores desafinados y un filtro que respira: lo turbio.
//   latido   — un grave de 55 Hz que pulsa; con la intensidad late más fuerte y más rápido: la ansiedad.
//   viento   — ruido filtrado que barre despacio: el espacio.
//   brillo   — campanitas sueltas en re mayor pentatónico (el fa# choca con el fa del colchón) con eco: la esperanza.
//   focos    — un acorde propio por cada juego y otro para el eclipse, que aparece al pasar por encima.
// Al pasar el mouse o el dedo por un juego o cerca del eclipse, todo crece: sube el volumen, se abre el filtro, el
// latido se acelera y entra el acorde de ese foco. Al salir, vuelve despacio al reposo. En las mesas queda casi mudo.
// Todo (también la reverberación y el eco) pasa por un solo volumen general: el botón lo apaga del todo.
// (2026-11-18: antes la sala iba directo a la salida y el botón no la apagaba.)
import { contextoAudio } from "./sonido.js";

const CLAVE = "azar.ambiente";
let apagado = false;
try { apagado = localStorage.getItem(CLAVE) === "0"; } catch { /* sin almacenamiento */ }

let c = null, n = null;                 // contexto y nodos
let intensidad = 0, enMesa = false, oculto = false, timerBrillo = 0, oyentes = [];
let foco = null, fuerzaFoco = 0;        // qué está debajo del puntero ("juego:chin", "eclipse") y cuánto (0 a 1)
const focos = new Map();                // clave → GainNode del acorde

// Acordes de cada foco (Hz). Sobre el re menor del colchón: los mayores abren, el si menor queda en penumbra.
const ACORDES = {
  "juego:truco":   [220, 329.63, 554.37],          // la mayor
  "juego:chin":    [293.66, 440, 739.99],          // re mayor, el más luminoso
  "juego:escoba":  [246.94, 369.99, 587.33],       // si menor
  "juego:canasta": [196, 293.66, 493.88],          // sol mayor
  eclipse:         [146.83, 220, 1174.66, 1318.51], // re y la graves con un brillo alto que titila
};
const ACORDE_OTRO = [261.63, 392, 659.25];          // juegos nuevos que todavía no tienen el suyo

function impulso(ctx, seg = 3.8) {
  const largo = Math.floor(ctx.sampleRate * seg), b = ctx.createBuffer(2, largo, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < largo; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / largo, 2.6); }
  return b;
}

function armar() {
  c = contextoAudio();
  if (!c) return false;
  const maestro = c.createGain(); maestro.gain.value = 0;
  const comp = c.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
  const sala = c.createConvolver(); sala.buffer = impulso(c);
  const humedo = c.createGain(); humedo.gain.value = 0.5;
  // cadena única: todo entra al bus «mezcla» o a la sala; los dos salen por el maestro.
  const mezcla = c.createGain(); mezcla.gain.value = 1;
  mezcla.connect(maestro);
  sala.connect(humedo).connect(maestro);
  maestro.connect(comp).connect(c.destination);

  // colchón
  const filtro = c.createBiquadFilter(); filtro.type = "lowpass"; filtro.frequency.value = 300; filtro.Q.value = 0.9;
  const colchon = c.createGain(); colchon.gain.value = 0.5;
  filtro.connect(colchon); colchon.connect(mezcla); colchon.connect(sala);
  for (const [f, v] of [[73.42, 0.22], [110, 0.16], [174.61, 0.1], [146.83, 0.08]]) {
    for (const det of [-7, 6]) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = det < 0 ? "sawtooth" : "triangle"; o.frequency.value = f; o.detune.value = det;
      g.gain.value = v * (det < 0 ? 0.55 : 1);
      o.connect(g).connect(filtro); o.start();
    }
  }
  const lfo = c.createOscillator(), lfoG = c.createGain(); lfo.frequency.value = 0.045; lfoG.gain.value = 120;
  lfo.connect(lfoG).connect(filtro.frequency); lfo.start();

  // latido: grave modulado en amplitud; la intensidad sube su volumen y su velocidad
  const sub = c.createOscillator(); sub.frequency.value = 55;
  const subG = c.createGain(); subG.gain.value = 0;
  const pulso = c.createOscillator(), pulsoG = c.createGain(); pulso.frequency.value = 0.7; pulsoG.gain.value = 0.5;
  const subAM = c.createGain(); subAM.gain.value = 0.5;
  pulso.connect(pulsoG).connect(subAM.gain);
  sub.connect(subAM).connect(subG).connect(mezcla); sub.start(); pulso.start();

  // viento
  const nb = c.createBuffer(1, c.sampleRate * 4, c.sampleRate), nd = nb.getChannelData(0);
  let ult = 0; for (let i = 0; i < nd.length; i++) { ult = ult * 0.985 + (Math.random() * 2 - 1) * 0.15; nd[i] = ult; }
  const ruido = c.createBufferSource(); ruido.buffer = nb; ruido.loop = true;
  const banda = c.createBiquadFilter(); banda.type = "bandpass"; banda.frequency.value = 600; banda.Q.value = 0.8;
  const viento = c.createGain(); viento.gain.value = 0.2;
  const lfo2 = c.createOscillator(), lfo2G = c.createGain(); lfo2.frequency.value = 0.031; lfo2G.gain.value = 260;
  lfo2.connect(lfo2G).connect(banda.frequency); lfo2.start();
  ruido.connect(banda).connect(viento); viento.connect(mezcla); viento.connect(sala); ruido.start();

  // brillo: eco largo (el eco también sale por la sala, que pasa por el maestro)
  const eco = c.createDelay(2); eco.delayTime.value = 0.62;
  const ecoG = c.createGain(); ecoG.gain.value = 0.38;
  const brillo = c.createGain(); brillo.gain.value = 0.5;
  brillo.connect(mezcla); brillo.connect(sala); brillo.connect(eco); eco.connect(ecoG).connect(eco); ecoG.connect(sala);

  // focos: un bus con un filtro propio para que los acordes entren suaves
  const focoBus = c.createBiquadFilter(); focoBus.type = "lowpass"; focoBus.frequency.value = 2600; focoBus.Q.value = 0.5;
  focoBus.connect(mezcla); focoBus.connect(sala);

  n = { maestro, filtro, subG, pulso, viento, brillo, focoBus, sala };
  aplicar(true);
  programarBrillo();
  return true;
}

/** El acorde de un foco: se arma la primera vez y queda sonando con volumen 0 hasta que lo llaman. */
function acordeDe(clave) {
  if (focos.has(clave)) return focos.get(clave);
  const g = c.createGain(); g.gain.value = 0;
  const notas = ACORDES[clave] || ACORDE_OTRO;
  notas.forEach((f, k) => {
    const alto = f > 1000;
    for (const det of alto ? [0] : [-5, 5]) {
      const o = c.createOscillator(), og = c.createGain();
      o.type = alto ? "sine" : k === 0 ? "triangle" : "sine";
      o.frequency.value = f; o.detune.value = det;
      og.gain.value = (alto ? 0.05 : 0.16 / (k + 1)) * (alto ? 1 : 0.6);
      if (alto) {   // el brillo del eclipse titila
        const tr = c.createOscillator(), trG = c.createGain(); tr.frequency.value = 3.2 + k; trG.gain.value = 0.04;
        tr.connect(trG).connect(og.gain); tr.start();
      }
      o.connect(og).connect(g); o.start();
    }
  });
  g.connect(n.focoBus);
  focos.set(clave, g);
  return g;
}

const PENTA = [587.33, 659.25, 739.99, 880, 987.77, 1174.66];
function campana(vol = 1) {
  if (!c || !n) return;
  const t = c.currentTime, f = PENTA[Math.floor(Math.random() * PENTA.length)];
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime((0.06 + intensidad * 0.06) * vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
  for (const [m, v] of [[1, 1], [2.76, 0.18], [5.4, 0.06]]) {
    const o = c.createOscillator(), og = c.createGain(); o.frequency.value = f * m; og.gain.value = v; o.connect(og).connect(g); o.start(t); o.stop(t + 3.3);
  }
  const pan = c.createStereoPanner ? c.createStereoPanner() : null;
  if (pan) { pan.pan.value = Math.random() * 1.4 - 0.7; g.connect(pan).connect(n.brillo); } else g.connect(n.brillo);
}
function programarBrillo() {
  clearTimeout(timerBrillo);
  const espera = 7000 - intensidad * 5600 + Math.random() * 2500;  // tranquilo: cada 7-9,5 s; encendido: cada 1,4-4 s
  timerBrillo = setTimeout(() => { if (!apagado && !oculto && !enMesa) campana(); programarBrillo(); }, espera);
}

const silencio = () => apagado || oculto;
function nivel() { return silencio() ? 0 : enMesa ? 0.04 : 0.07 + intensidad * 0.23; }
function aplicar(rapido = false) {
  if (!c || !n) return;
  const t = c.currentTime;
  const sube = intensidad > 0.05;   // sube rápido, baja despacio; un número fija el tiempo (al volver a prender)
  const tau = typeof rapido === "number" ? rapido : rapido ? 0.05 : sube ? 0.22 : 0.9;
  n.maestro.gain.cancelScheduledValues(t);
  n.maestro.gain.setTargetAtTime(nivel(), t, silencio() ? 0.06 : tau);
  n.filtro.frequency.setTargetAtTime(260 + intensidad * 2200, t, tau);
  n.subG.gain.setTargetAtTime(0.03 + intensidad * 0.32, t, tau);
  n.pulso.frequency.setTargetAtTime(0.7 + intensidad * 1.3, t, tau);
  n.viento.gain.setTargetAtTime(0.16 + intensidad * 0.4, t, tau);
  for (const [clave, g] of focos) g.gain.setTargetAtTime(clave === foco && !enMesa ? 0.9 * fuerzaFoco : 0, t, clave === foco ? 0.25 : 0.8);
}

export const ambiente = {
  get encendido() { return !apagado; },
  /** Desde el primer toque de la persona. */
  despertar() { if (!c) armar(); else { if (c.state === "suspended") c.resume(); aplicar(); } },
  alternar() {
    apagado = !apagado;
    try { localStorage.setItem(CLAVE, apagado ? "0" : "1"); } catch { /* ok */ }
    if (!apagado) { this.despertar(); aplicar(0.25); } else aplicar(true);
    oyentes.forEach((f) => f(!apagado));
    return !apagado;
  },
  alCambiar(f) { oyentes.push(f); },
  /** Qué hay debajo del puntero: "juego:<id>", "eclipse" o null; `fuerza` de 0 a 1 (cerca del eclipse, cuánto). */
  foco(clave, fuerza = 1) {
    fuerza = Math.max(0, Math.min(1, fuerza));
    const nuevo = clave && fuerza > 0.02 ? clave : null;
    const entra = nuevo && nuevo !== foco;
    foco = nuevo; fuerzaFoco = nuevo ? fuerza : 0;
    intensidad = nuevo ? (nuevo === "eclipse" ? 0.25 + fuerza * 0.65 : 1) : 0;
    if (c && n && nuevo) acordeDe(nuevo);
    aplicar();
    if (entra && !silencio() && !enMesa) { campana(1.3); programarBrillo(); }   // al entrar a un foco, una campanita enseguida
  },
  /** 0 a 1, sin foco (compatibilidad). */
  intensidad(x) { this.foco(x > 0.02 ? "eclipse" : null, x); },
  reposo() { this.foco(null); },
  /** En una mesa queda casi mudo; en el inicio y los menús, normal. */
  mesa(si) { enMesa = !!si; if (si) { foco = null; intensidad = 0; } aplicar(); },
  _estado: () => ({ armado: !!n, apagado, intensidad, foco, fuerzaFoco, enMesa, nivel: nivel(), ganancia: n ? n.maestro.gain.value : null }),
};

document.addEventListener("visibilitychange", () => { oculto = document.hidden; aplicar(true); });
const primerToque = () => { if (!apagado) ambiente.despertar(); };
addEventListener("pointerdown", primerToque, { once: true, capture: true });
addEventListener("keydown", primerToque, { once: true, capture: true });
globalThis.__ambiente = ambiente; // solo para las pruebas (scripts/): leer _estado()
