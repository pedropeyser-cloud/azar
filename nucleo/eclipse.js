// eclipse.js — Eclipse total de sol para el cielo del inicio de AZAR.
// WebGL2 sin librerías: escena en HDR (half float), bloom por bajadas y subidas, AgX, grano y dithering.
// Uso: const ec = montarEclipse(canvas, { centro: [0.58, 0.28], radio: 0.085 });
//      await ec.cerrar();  // la pantalla queda en #0A0C16
//      await ec.abrir();   // vuelve la luz
//      ec.destello();      // anillo de diamante breve

const TAU = Math.PI * 2;
const CICLO = 30;               // segundos por vuelta con velocidad 1
const K = 1.07;                 // radio de la luna / radio del sol
const KG = K - 1;               // margen de la luna sobre el sol
const P_OFF = 0.032;            // la luna no pasa justo por el centro (en radios de sol)
const A_PERFIL = 0.014;         // relieve del borde lunar
const D_VALLE = 0.028;          // profundidad de los dos valles del anillo de diamante
const LN_RMAX = Math.log(12);   // la textura polar de la corona llega a 12 radios
const T_REABRIR = 0.708;        // fase a la que salta el ciclo cuando la pantalla está tapada
const OSCURO = [10 / 255, 12 / 255, 22 / 255]; // #0A0C16

const NIVELES = [
  { nombre: "alta",   dpr: 2,    escala: 1,    mips: 6, polar: [2048, 384], oct: 3, cada: 1 },
  { nombre: "media",  dpr: 1.5,  escala: 1,    mips: 5, polar: [1536, 320], oct: 3, cada: 1 },
  { nombre: "baja",   dpr: 1.25, escala: 0.85, mips: 5, polar: [1024, 256], oct: 2, cada: 2 },
  { nombre: "minima", dpr: 1,    escala: 0.7,  mips: 4, polar: [1024, 192], oct: 2, cada: 3 },
];

/* ---------------- utilidades ---------------- */
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const angDif = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
function azar(semilla) { let s = semilla >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const aLineal = (c) => c.map((v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));

// Resorte con amortiguación crítica, paso exacto: nunca rebota y se puede retargetear en cualquier momento.
function resorte(x, v, meta, w, dt) {
  const y = x - meta, e = Math.exp(-w * dt), tmp = (v + w * y) * dt;
  return [meta + (y + tmp) * e, (v - w * tmp) * e];
}

// Interpolación cúbica monótona (Fritsch–Carlson): velocidad continua sin pasarse de los puntos.
function monotona(xs, ys) {
  const n = xs.length, d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  // media armónica (Fritsch–Butland): la tangente se pega a la pendiente más lenta, así frena antes de cada punto lento
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i]);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
    if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (x) => {
    let i = 0; while (i < n - 2 && x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = clamp((x - xs[i]) / h, 0, 1), t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

/* ---------------- geometría del eclipse ---------------- */
// La luna avanza por s (en radios de sol) sobre la dirección u, corrida P_OFF sobre la normal.
// En el hemisferio sur, mirando al norte, la luna entra por la izquierda (oeste) y sale por la derecha.
const U_DIR = (() => { const x = 1, y = -0.36, l = Math.hypot(x, y); return [x / l, y / l]; })();
const N_DIR = [-U_DIR[1], U_DIR[0]];
const sDeG = (g, signo) => signo * Math.sqrt(Math.max(0, (g + KG) ** 2 - P_OFF ** 2)); // g: brecha del lado del contacto
const S1 = Math.sqrt((1 + K) ** 2 - P_OFF ** 2); // primer y cuarto contacto
// Puntos del ciclo: la brecha g (en radios de sol) define perlas (0,024 → −0,0125) y diamante (hasta −0,028).
const CLAVES = [
  [0, -3.0], [0.12, -S1], [0.33, -0.55], [0.39, sDeG(0.075, -1)],
  [0.42, sDeG(0.024, -1)], [0.435, sDeG(0.008, -1)], [0.45, sDeG(-0.004, -1)], [0.47, sDeG(-0.0125, -1)], [0.485, sDeG(-0.022, -1)], [0.5, sDeG(-0.031, -1)],
  [0.625, 0],
  [0.75, sDeG(-0.031, 1)], [0.762, sDeG(-0.022, 1)], [0.775, sDeG(-0.0125, 1)], [0.785, sDeG(-0.004, 1)], [0.792, sDeG(0.008, 1)], [0.8, sDeG(0.024, 1)], [0.82, sDeG(0.075, 1)],
  [0.88, 0.75], [0.985, S1], [1, 2.25],
];
const sCiclo = monotona(CLAVES.map((c) => c[0]), CLAVES.map((c) => c[1]));
// Fracción del sol que queda sin tapar (círculos de radio 1 y K a distancia d).
function sinTapar(d) {
  if (d >= 1 + K) return 1;
  if (d <= K - 1) return 0;
  const r1 = 1, r2 = K;
  const a1 = Math.acos(clamp((d * d + r1 * r1 - r2 * r2) / (2 * d * r1), -1, 1));
  const a2 = Math.acos(clamp((d * d + r2 * r2 - r1 * r1) / (2 * d * r2), -1, 1));
  const inter = r1 * r1 * a1 + r2 * r2 * a2 - 0.5 * Math.sqrt(Math.max(0, (-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2)));
  return 1 - inter / Math.PI;
}

// Relieve del borde lunar: armónicos con amplitud 1/f (ruido) más los dos valles del diamante.
function armarPerfil() {
  const r = azar(7), NH = 14, n = [], a = [], p = [];
  for (let i = 0; i < NH; i++) { n.push(Math.round(5 + i * 4.3 + r() * 3)); a.push((0.5 + r()) / Math.pow(n[i], 0.75)); p.push(r() * TAU); }
  const arm = (x) => { let h = 0; for (let i = 0; i < NH; i++) h += a[i] * Math.sin(n[i] * x + p[i]); return h; };
  let mx = 0; for (let i = 0; i < 4096; i++) mx = Math.max(mx, Math.abs(arm((i / 4096) * TAU)));
  for (let i = 0; i < NH; i++) a[i] *= A_PERFIL / mx;
  // Los valles van donde está la última (y la primera) luz en el instante del diamante.
  const dirLuz = (s) => { const mx = s * U_DIR[0] + P_OFF * N_DIR[0], my = s * U_DIR[1] + P_OFF * N_DIR[1]; return Math.atan2(-my, -mx); };
  const va = [dirLuz(sCiclo(0.485)), dirLuz(sCiclo(0.765))];
  const vw = 0.045;
  // El relieve se nota donde ocurren los contactos; en el resto del borde queda al 30 % para que el disco se lea redondo.
  const ven = (x) => 0.3 + 0.7 * Math.max(Math.exp(-((angDif(x, va[0]) / 0.8) ** 2)), Math.exp(-((angDif(x, va[1]) / 0.8) ** 2)));
  const base = (x) => arm(x) * ven(x);
  const vd = va.map((ang) => D_VALLE + base(ang)); // el fondo de cada valle queda justo en -D_VALLE
  const h = (x) => base(x) - vd[0] * Math.exp(-((angDif(x, va[0]) / vw) ** 2)) - vd[1] * Math.exp(-((angDif(x, va[1]) / vw) ** 2));
  return { NH, n, a, p, va, vd, vw, h };
}

// Perlas de Baily: rayos desde el centro de la luna; donde el sol asoma por un valle hay una perla.
// El barrido arranca del lado tapado (opuesto a la luz), así ninguna perla queda partida en dos.
function perlas(mx, my, perfil, kP = 1, N = 720) {
  const corridas = []; let act = null;
  const md2 = mx * mx + my * my, a0 = Math.atan2(my, mx);
  for (let i = 0; i <= N; i++) {
    const psi = a0 + (i / N) * TAU, cx = Math.cos(psi), cy = Math.sin(psi);
    const b = mx * cx + my * cy, disc = b * b - md2 + 1;
    let vis = 0;
    if (disc > 0) { const tf = -b + Math.sqrt(disc); vis = tf - (K + kP * perfil.h(psi)); }
    if (vis > 0 && i < N) {
      if (!act) act = { area: 0, sa: 0, sr: 0 };
      const da = vis * K * (TAU / N);
      act.area += da; act.sa += da * psi; act.sr += da * (K + kP * perfil.h(psi) + vis * 0.5);
    } else if (act) { corridas.push(act); act = null; }
  }
  return corridas.filter((c) => c.area > 0).map((c) => ({ ang: c.sa / c.area, rad: c.sr / c.area, area: c.area }))
    .sort((a, b) => b.area - a.area).slice(0, 8);
}

/* ---------------- AgX (mismo código en JS para calibrar la paleta) ---------------- */
const AGX_M = [0.842479062253094, 0.0423282422610123, 0.0423756549057051, 0.0784335999999992, 0.878468636469772, 0.0784336, 0.0792237451477643, 0.0791661274605434, 0.879142973793104];
const AGX_I = [1.19687900512017, -0.0528968517574562, -0.0529716355144438, -0.0980208811401368, 1.15190312990417, -0.0980434501171241, -0.0990297440797205, -0.0989611768448433, 1.15107367264116];
const mulM = (m, v) => [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]];
function agxJS(c) {
  const MIN = -12.47393, MAX = 4.026069;
  let v = mulM(AGX_M, c).map((x) => (clamp(Math.log2(Math.max(x, 1e-10)), MIN, MAX) - MIN) / (MAX - MIN));
  v = v.map((x) => { const x2 = x * x, x4 = x2 * x2; return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232; });
  return mulM(AGX_I, v);
}
// Valor de escena que, después de AgX, da exactamente el color de la paleta.
function escenaPara(h) {
  const meta = hex(h); let x = aLineal(meta).map((v) => Math.max(v, 1e-4) * 0.6);
  for (let it = 0; it < 80; it++) {
    const y = agxJS(x);
    x = x.map((v, i) => clamp(v * Math.pow(Math.max(meta[i], 1e-4) / Math.max(y[i], 1e-4), 0.7), 1e-6, 50));
  }
  return x;
}

/* ---------------- shaders ---------------- */
const VS = `#version 300 es
const vec2 P[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
out vec2 vUv;
void main(){ vec2 p = P[gl_VertexID]; vUv = p*0.5+0.5; gl_Position = vec4(p,0.0,1.0); }`;

const RUIDO = `
const float PI = 3.14159265359, TAU = 6.28318530718, MEDIOPI = 1.57079632679;
uvec3 pcg3d(uvec3 v){ v = v*1664525u + 1013904223u; v.x += v.y*v.z; v.y += v.z*v.x; v.z += v.x*v.y;
  v ^= v >> 16u; v.x += v.y*v.z; v.y += v.z*v.x; v.z += v.x*v.y; return v; }
vec3 grad3(vec3 i){ uvec3 h = pcg3d(uvec3(ivec3(i) + ivec3(1048576))); return vec3(h & uvec3(0xFFFFu)) / 32767.5 - 1.0; }
float gnoise(vec3 p){
  vec3 i = floor(p), f = p - i, u = f*f*f*(f*(f*6.0-15.0)+10.0);
  float a = dot(grad3(i), f), b = dot(grad3(i+vec3(1,0,0)), f-vec3(1,0,0));
  float c = dot(grad3(i+vec3(0,1,0)), f-vec3(0,1,0)), d = dot(grad3(i+vec3(1,1,0)), f-vec3(1,1,0));
  float e = dot(grad3(i+vec3(0,0,1)), f-vec3(0,0,1)), g = dot(grad3(i+vec3(1,0,1)), f-vec3(1,0,1));
  float h = dot(grad3(i+vec3(0,1,1)), f-vec3(0,1,1)), k = dot(grad3(i+vec3(1,1,1)), f-vec3(1,1,1));
  return mix(mix(mix(a,b,u.x), mix(c,d,u.x), u.y), mix(mix(e,g,u.x), mix(h,k,u.x), u.y), u.z) * 1.6;
}
float angDif(float a, float b){ return mod(a - b + PI, TAU) - PI; }
float hash12(vec2 p, float s){ uvec3 h = pcg3d(uvec3(ivec2(p) + ivec2(65536), int(s))); return float(h.x & 0xFFFFFFu) / 16777215.0; }
`;

// Corona en coordenadas polares (θ, log r). Se calcula a baja frecuencia y la escena la muestrea.
const FS_POLAR = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform float uTiempo, uEje, uLnRmax; uniform int uOct;
uniform vec4 uStr[7];
${RUIDO}
void main(){
  float th = vUv.x*TAU - PI;
  float r = exp(vUv.y*uLnRmax);
  float rel = th - uEje;
  float lat = asin(clamp(cos(rel), -1.0, 1.0));
  float lado = sin(rel) >= 0.0 ? 1.0 : -1.0;
  float lejos = 1.0 - 1.0/r;
  // Líneas de campo: los rayos de latitud media se curvan hacia el ecuador y las serpentinas convergen en su punta.
  float latS = lat + lejos*0.24*sin(2.0*lat);
  float la = lat/0.42;
  latS += lejos*0.85*lat*exp(-la*la);
  latS = clamp(latS, -MEDIOPI, MEDIOPI);
  float thS = uEje + lado*(MEDIOPI - latS);
  vec2 cs = vec2(cos(thS), sin(thS));
  float lr = log(r);
  float ancho = gnoise(vec3(cs*5.0, lr*0.7 - uTiempo*0.015));
  float R = 24.0, Fz = 1.7, amp = 1.0, suma = 0.0, ws = 0.0;
  for (int i = 0; i < 4; i++){
    if (i >= uOct) break;
    float n = gnoise(vec3(cs*R, lr*Fz - uTiempo*(0.035 + 0.015*float(i)) + float(i)*13.7));
    float cresta = max(1.0 - abs(n), 0.0);
    cresta = i == 0 ? cresta*cresta*cresta : pow(cresta, 4.5);
    suma += amp*cresta; ws += amp; amp *= 0.66; R *= 2.15; Fz *= 1.35;
  }
  float rayos = suma/ws;
  float env = 0.0;
  float cr = (r-1.6)/0.55;
  float casco = (1.0 + 1.25*exp(-cr*cr)) / (1.0 + 0.30*(r-1.0));
  for (int i = 0; i < 7; i++){
    vec4 s = uStr[i];
    float w = s.y*casco;
    float d = angDif(th, s.x);
    env += s.z*exp(-d*d/(w*w))*exp(-(r-1.0)/s.w);
  }
  float polo = smoothstep(0.95, 1.4, abs(lat))*exp(-(r-1.0)/0.6);
  float base = 0.30*exp(-(r-1.0)/0.2) + 0.012*exp(-(r-1.0)/2.5);
  float interior = exp(-(r-1.0)/0.10);
  // Arcadas cerca del borde: textura más corta y menos radial.
  float arc = clamp(gnoise(vec3(cs*55.0, lr*28.0 + uTiempo*0.02))*0.5 + 0.5, 0.0, 1.0);
  float haz = clamp(0.55 + 0.9*ancho, 0.15, 1.6);
  float S = base*(0.5 + 0.7*rayos) + env*(0.22 + 1.1*rayos)*haz
          + polo*(0.04 + 0.9*rayos) + interior*(0.55 + 0.35*rayos + 0.25*arc);
  o = vec4(S, 0.0, 0.0, 1.0);
}`;

const FS_ESCENA = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform vec2 uRes; uniform float uDpr, uTiempo;
uniform vec2 uSol; uniform float uRs;            // centro y radio del sol (px)
uniform vec2 uLuna; uniform float uRm;           // centro y radio de la luna (px)
uniform vec2 uCam;                               // corrimiento de cámara (px)
uniform float uHor;                              // línea del horizonte (px desde arriba)
uniform vec3 uCieloAlto, uCieloBajo, uLuzAlto, uLuzBajo, uOscuro;
uniform float uSolGan, uLuz, uHalo, uCorVis, uCorExt, uCorGan, uEstr, uRes0, uZoomF;
uniform sampler2D uCorona; uniform float uLnRmax; uniform vec2 uTexPolar;
uniform float uHa[14], uHn[14], uHp[14];
uniform vec2 uVa, uVd; uniform float uVw, uPerfilK;
uniform vec4 uPerla[8]; uniform int uNP;
uniform vec4 uProm[6];
uniform vec4 uFlash;                             // x,y, intensidad, radio del limbo
uniform float uPlaneta;
${RUIDO}
float perfil(float a){
  float h = 0.0;
  for (int i = 0; i < 14; i++) h += uHa[i]*sin(uHn[i]*a + uHp[i]);
  float e1 = angDif(a, uVa.x)/0.8, e2 = angDif(a, uVa.y)/0.8;
  h *= 0.3 + 0.7*max(exp(-e1*e1), exp(-e2*e2));
  float d1 = angDif(a, uVa.x)/uVw, d2 = angDif(a, uVa.y)/uVw;
  return (h - uVd.x*exp(-d1*d1) - uVd.y*exp(-d2*d2))*uPerfilK;
}
vec3 estrellas(vec2 p, float celda, float dens, float brillo, float semilla){
  vec2 c = floor(p/celda), f = p - c*celda;
  uvec3 h = pcg3d(uvec3(ivec3(int(c.x) + 8192, int(c.y) + 8192, int(semilla))));
  vec3 r = vec3(h & uvec3(0xFFFFu))/65535.0;
  if (r.z > dens) return vec3(0.0);
  vec2 sp = (0.18 + 0.64*r.xy)*celda;
  float d = length(f - sp);
  float mag = pow(fract(r.z*91.7 + r.x*13.1), 4.0);
  float tw = 1.0 + 0.18*sin(uTiempo*(0.9 + r.y*1.7) + r.x*40.0);
  float sz = uDpr*(0.5 + 0.55*mag);
  float I = brillo*(0.08 + 0.92*mag)*tw*exp(-d*d/(2.0*sz*sz));
  vec3 tinte = mix(vec3(0.72, 0.78, 1.0), vec3(1.0, 0.88, 0.74), fract(r.y*7.31));
  return tinte*I;
}
void main(){
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  float aa = 0.85;
  float yN = p.y/uRes.y, hz = uHor/uRes.y;

  /* --- cielo (adelante: la atmósfera está delante de la luna) --- */
  float tAlto = smoothstep(0.0, hz, yN);
  vec3 cieloO = mix(uCieloAlto, uCieloBajo, tAlto*tAlto);
  vec3 cieloL = mix(uLuzAlto, uLuzBajo, tAlto);
  vec3 cielo = mix(cieloO, cieloL, uLuz);
  float bajo = smoothstep(hz - 0.005, hz + 0.09, yN);
  cielo = mix(cielo, uOscuro, bajo);
  // resplandor de atardecer en todo el horizonte durante la totalidad
  float sobre = max(hz - yN, 0.0);
  float franja = smoothstep(hz + 0.025, hz, yN);
  vec3 atard = vec3(0.78, 0.30, 0.10)*0.020*exp(-sobre/0.045) + vec3(0.72, 0.46, 0.20)*0.010*exp(-sobre/0.16)
             + vec3(0.30, 0.30, 0.52)*0.004*exp(-sobre/0.40);
  cielo += atard*uRes0*franja;

  /* --- atrás: estrellas, corona, sol --- */
  vec3 atras = vec3(0.0), solar = vec3(0.0);
  atras += estrellas(p + uCam*0.25, 30.0*uDpr, 0.16, 0.45, 1.0);
  atras += estrellas(p + uCam*0.5 + 911.0, 62.0*uDpr, 0.22, 0.9, 2.0);
  atras += estrellas(p + uCam*0.8 + 377.0, 140.0*uDpr, 0.38, 1.5, 3.0);
  atras *= uEstr*(1.0 - smoothstep(hz - 0.03, hz + 0.01, yN));

  vec2 q = p - uSol;
  float dpx = length(q);
  float r = dpx/uRs;
  float th = atan(q.y, q.x);

  // planeta (Venus) fijo cerca del sol: aparece con la oscuridad
  vec2 pv = uSol + vec2(-3.6, 1.25)*uRs/uZoomF;
  float dv = length(p - pv);
  atras += vec3(1.0, 0.95, 0.86)*uPlaneta*1.6*exp(-dv*dv/(2.2*uDpr*uDpr));

  if (r > 1.0 && uCorVis > 0.001){
    vec2 uv = vec2((th + PI)/TAU, log(r)/uLnRmax);
    vec2 uv2 = vec2(fract(uv.x + 0.5), uv.y);
    vec2 dx1 = dFdx(uv), dy1 = dFdy(uv), dx2 = dFdx(uv2), dy2 = dFdy(uv2);
    vec2 dx = abs(dx1.x) < abs(dx2.x) ? dx1 : dx2, dy = abs(dy1.x) < abs(dy2.x) ? dy1 : dy2;
    float S = textureGrad(uCorona, uv, dx, dy).r;
    // Baumbach (K corona) con compresión de rango tipo ojo; uCorExt estira la caída.
    float re = 1.0 + (r - 1.0)/uCorExt;
    float B = (0.0532*pow(re, -2.5) + 1.425*pow(re, -7.0) + 2.565*pow(re, -17.0))/4.0432;
    float cae = pow(B, 0.5);
    vec3 nacar = vec3(1.0, 0.93, 0.80), plata = vec3(0.60, 0.65, 0.86);
    vec3 col = mix(nacar, plata, smoothstep(1.02, 2.6, r));
    atras += col*S*cae*2.6*uCorGan*uCorVis;
  }
  // cromosfera y protuberancias (brasa rosada), solo por encima del borde del sol
  if (r > 0.99 && r < 1.25){
    float esp = 0.75 + 0.5*clamp(0.5 + 0.5*gnoise(vec3(cos(th)*160.0, sin(th)*160.0, uTiempo*0.05)), 0.0, 1.0);
    float cromo = (exp(-(r - 1.0)/0.008) + 0.35*exp(-(r - 1.0)/0.022))*esp*smoothstep(0.995, 1.002, r);
    vec3 brasa = vec3(1.0, 0.25, 0.20);
    float prom = 0.0;
    for (int i = 0; i < 6; i++){
      vec4 P = uProm[i];
      float d = angDif(th, P.x)/P.z;
      float y = (r - 1.0)/P.y;
      if (abs(d) > 1.6 || y > 1.3 || y < 0.0) continue;
      float n = clamp(gnoise(vec3(d*6.0, y*4.0 - uTiempo*0.03, P.w))*0.5 + 0.5, 0.0, 1.0);
      float forma;
      if (fract(P.w) < 0.5){ // arco
        float ar = length(vec2(d, y*1.25));
        float ad = (ar - 0.78)/0.16;
        forma = exp(-ad*ad)*smoothstep(1.3, 0.9, ar);
      } else {               // seto de filamentos
        forma = exp(-d*d*2.2)*pow(max(1.0 - y, 0.0), 1.3)*(0.6 + 0.8*abs(sin(d*9.0 + P.w*3.0)));
      }
      prom += forma*(0.45 + 0.9*n);
    }
    solar += brasa*(cromo*3.2 + prom*4.0)*step(1.0, r + 0.0005)*uCorVis;
  }
  // fotosfera: oscurecimiento al borde y granulado que hierve lento
  float mSol = clamp((uRs - dpx)/aa + 0.5, 0.0, 1.0);
  if (mSol > 0.0){
    float rho = min(r, 1.0), mu = sqrt(max(1.0 - rho*rho, 0.0));
    float I = 1.0 - 0.6*(1.0 - mu);
    vec2 g = q/uRs*38.0;
    float gr = gnoise(vec3(g, uTiempo*0.12))*0.6 + gnoise(vec3(g*2.1, uTiempo*0.2 + 4.0))*0.4;
    I *= 1.0 + 0.07*gr*mu;
    vec3 col = mix(vec3(1.0, 0.50, 0.22), vec3(1.0, 0.88, 0.72), pow(mu, 0.5));
    atras *= 1.0 - mSol;
    solar = mix(solar, col*I*2.1*uSolGan, mSol);
  }

  /* --- la luna tapa todo lo de atrás --- */
  vec2 m = p - uLuna;
  float dl = length(m);
  float rm = uRm;
  if (abs(dl - uRm) < uRs*0.06) rm = uRm + perfil(atan(m.y, m.x))*uRs;
  // El relieve solo decide qué parte del sol asoma; sobre la corona la luna se ve redonda.
  float mPerfil = clamp((rm - dl)/aa + 0.5, 0.0, 1.0);
  float mLuna = clamp((uRm - dl)/aa + 0.5, 0.0, 1.0);
  atras = atras*(1.0 - mLuna) + solar*(1.0 - mPerfil);
  if (mLuna > 0.0){
    float rho = min(dl/uRm, 1.0);
    vec3 nrm = vec3(m/uRm, sqrt(max(1.0 - rho*rho, 0.0)));
    float lam = max(dot(nrm, normalize(vec3(-0.35, -0.25, 0.9))), 0.0);
    float mares = gnoise(vec3(nrm.xy*2.3, 7.0))*0.5 + gnoise(vec3(nrm.xy*5.0, 3.0))*0.25;
    float albedo = 0.82 + 0.18*mares;
    vec3 ceniza = vec3(0.55, 0.62, 0.85)*0.0028*albedo*lam*(1.0 - uLuz)*clamp(2.0 - uZoomF, 0.0, 1.0);
    atras += ceniza*mLuna;
  }

  /* --- luz que pasa por los valles: perlas y diamante --- */
  vec3 perl = vec3(0.0);
  for (int i = 0; i < 8; i++){
    if (i >= uNP) break;
    vec4 P = uPerla[i];
    float d = length(p - P.xy);
    float s = P.w;
    perl += vec3(1.0, 0.93, 0.80)*P.z*(exp(-d*d/(2.0*s*s))*22.0 + exp(-d/(s*4.0))*1.8 + exp(-d/(s*11.0))*0.32 + exp(-d/(s*30.0))*0.035);
  }
  // destello: un diamante breve sobre el borde
  if (uFlash.z > 0.001){
    float d = length(p - uFlash.xy);
    float s = 1.3*uDpr;
    perl += vec3(1.0, 0.94, 0.82)*uFlash.z*(exp(-d*d/(2.0*s*s))*16.0 + exp(-d/(s*5.0))*1.0 + exp(-d/(s*24.0))*0.14);
    float an = (dpx - uFlash.w)/(1.4*uDpr), ce = angDif(th, atan(uFlash.y - uSol.y, uFlash.x - uSol.x))/0.9;
    float anillo = exp(-an*an), cerca = exp(-ce*ce);
    perl += vec3(1.0, 0.92, 0.78)*uFlash.z*anillo*(0.25 + 1.6*cerca);
  }

  /* --- aureola del sol en la atmósfera --- */
  float dd = max(dpx - uRs, 0.0)/uRs;
  vec3 oro = vec3(0.86, 0.50, 0.12);
  vec3 halo = (oro*0.30*exp(-dd/0.42) + oro*0.03*exp(-dd/2.2) + vec3(0.32, 0.33, 0.48)*0.006*exp(-dd/14.0))*uHalo;

  vec3 col = atras + cielo + halo + perl;
  o = vec4(max(col, vec3(0.0)), 1.0);
}`;

// Bloom: primera bajada con umbral suave y promedio de Karis (sin luciérnagas), después 13 muestras (Jimenez 2014).
const FS_BAJA = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uTex; uniform vec2 uTexel; uniform int uPrimera; uniform float uUmbral;
vec3 t(vec2 d){ return texture(uTex, vUv + d*uTexel).rgb; }
float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 karis(vec3 a, vec3 b, vec3 c, vec3 d){
  float wa = 1.0/(1.0 + luma(a)), wb = 1.0/(1.0 + luma(b)), wc = 1.0/(1.0 + luma(c)), wd = 1.0/(1.0 + luma(d));
  return (a*wa + b*wb + c*wc + d*wd)/(wa + wb + wc + wd);
}
void main(){
  vec3 A = t(vec2(-2,-2)), B = t(vec2(0,-2)), C = t(vec2(2,-2));
  vec3 D = t(vec2(-1,-1)), E = t(vec2(1,-1));
  vec3 F = t(vec2(-2,0)), G = t(vec2(0,0)), H = t(vec2(2,0));
  vec3 I = t(vec2(-1,1)), J = t(vec2(1,1));
  vec3 Kk = t(vec2(-2,2)), L = t(vec2(0,2)), M = t(vec2(2,2));
  vec3 c;
  if (uPrimera == 1){
    c = karis(D,E,I,J)*0.5 + karis(A,B,F,G)*0.125 + karis(B,C,G,H)*0.125 + karis(F,G,Kk,L)*0.125 + karis(G,H,L,M)*0.125;
    float l = luma(c), knee = uUmbral*0.5;
    float soft = clamp(l - uUmbral + knee, 0.0, 2.0*knee); soft = soft*soft/(4.0*knee + 1e-5);
    c *= max(soft, l - uUmbral)/max(l, 1e-5);
  } else {
    c = (D+E+I+J)*0.125 + (A+C+Kk+M)*0.03125 + (B+F+H+L)*0.0625 + G*0.125;
  }
  o = vec4(max(c, 0.0), 1.0);
}`;
const FS_SUBE = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uTex; uniform vec2 uTexel; uniform float uPeso;
void main(){
  vec2 d = uTexel;
  vec3 c = texture(uTex, vUv).rgb*4.0;
  c += (texture(uTex, vUv + vec2(-d.x,0)).rgb + texture(uTex, vUv + vec2(d.x,0)).rgb + texture(uTex, vUv + vec2(0,-d.y)).rgb + texture(uTex, vUv + vec2(0,d.y)).rgb)*2.0;
  c += texture(uTex, vUv + vec2(-d.x,-d.y)).rgb + texture(uTex, vUv + vec2(d.x,-d.y)).rgb + texture(uTex, vUv + vec2(-d.x,d.y)).rgb + texture(uTex, vUv + vec2(d.x,d.y)).rgb;
  o = vec4(c/16.0*uPeso, 1.0);
}`;
const FS_FINAL = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uEscena, uBloom; uniform vec2 uRes, uTexelB;
uniform float uBloomI, uFrame, uGrano, uTapa; uniform vec3 uTapaColor;
${RUIDO}
vec3 agxCurva(vec3 x){ vec3 x2 = x*x, x4 = x2*x2;
  return 15.5*x4*x2 - 40.14*x4*x + 31.96*x4 - 6.868*x2*x + 0.4298*x2 + 0.1191*x - 0.00232; }
vec3 agx(vec3 c){
  const mat3 M = mat3(0.842479062253094, 0.0423282422610123, 0.0423756549057051, 0.0784335999999992, 0.878468636469772, 0.0784336, 0.0792237451477643, 0.0791661274605434, 0.879142973793104);
  const mat3 Mi = mat3(1.19687900512017, -0.0528968517574562, -0.0529716355144438, -0.0980208811401368, 1.15190312990417, -0.0980434501171241, -0.0990297440797205, -0.0989611768448433, 1.15107367264116);
  const float MIN = -12.47393, MAX = 4.026069;
  c = M*c;
  c = clamp(log2(max(c, vec3(1e-10))), MIN, MAX);
  c = (c - MIN)/(MAX - MIN);
  return Mi*agxCurva(c);
}
void main(){
  vec3 c = texture(uEscena, vUv).rgb;
  vec2 d = uTexelB;
  vec3 b = texture(uBloom, vUv).rgb*4.0;
  b += (texture(uBloom, vUv + vec2(-d.x,0)).rgb + texture(uBloom, vUv + vec2(d.x,0)).rgb + texture(uBloom, vUv + vec2(0,-d.y)).rgb + texture(uBloom, vUv + vec2(0,d.y)).rgb)*2.0;
  b += texture(uBloom, vUv + vec2(-d.x,-d.y)).rgb + texture(uBloom, vUv + vec2(d.x,-d.y)).rgb + texture(uBloom, vUv + vec2(-d.x,d.y)).rgb + texture(uBloom, vUv + vec2(d.x,d.y)).rgb;
  c += b/16.0*uBloomI;
  vec3 m = clamp(agx(c), 0.0, 1.0);
  vec2 px = gl_FragCoord.xy;
  // grano fino animado, más visible en los medios tonos
  float l = dot(m, vec3(0.2126, 0.7152, 0.0722));
  float gr = hash12(px, uFrame) + hash12(px + 17.0, uFrame + 7.0) - 1.0;
  m += gr*uGrano*(0.35 + 0.65*smoothstep(0.0, 0.25, l))*(1.0 - smoothstep(0.6, 1.0, l));
  // dithering triangular de ±1 escalón de 8 bits
  float di = hash12(px + 91.0, uFrame*1.37 + 3.0) + hash12(px + 53.0, uFrame*0.71 + 11.0) - 1.0;
  m += di/255.0;
  o = vec4(mix(m, uTapaColor, uTapa), 1.0);
}`;

/* ---------------- WebGL ---------------- */
function compilar(gl, fs) {
  const p = gl.createProgram();
  for (const [tipo, src] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(tipo); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error("shader: " + gl.getShaderInfoLog(s));
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error("programa: " + gl.getProgramInfoLog(p));
  const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); const nom = info.name.replace(/\[0\]$/, ""); u[nom] = gl.getUniformLocation(p, info.name); }
  return { p, u };
}
function objetivo(gl, w, h, interno, formato, mip = false) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, interno, w, h, 0, formato, gl.HALF_FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, mip ? gl.REPEAT : gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fb, w, h, ok };
}
function soportaWebGL2() {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2");
    if (!gl) return false;
    const ext = gl.getExtension("EXT_color_buffer_float") || gl.getExtension("EXT_color_buffer_half_float");
    const ok = !!ext;
    // sin loseContext(): Safari lo anota como error en la consola; el canvas de prueba se libera solo
    return ok;
  } catch { return false; }
}

/* ---------------- cuadro fijo sin WebGL2 (Canvas 2D) ---------------- */
function pintarFijo(ctx, W, H, cx, cy, rm, hz, tapa) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#0A0C16"); sky.addColorStop(Math.max(0.01, hz * 0.9), "#111527"); sky.addColorStop(Math.min(0.99, hz + 0.08), "#0A0C16"); sky.addColorStop(1, "#0A0C16");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  const at = ctx.createLinearGradient(0, H * (hz - 0.22), 0, H * hz);
  at.addColorStop(0, "rgba(224,122,79,0)"); at.addColorStop(0.75, "rgba(233,181,74,0.05)"); at.addColorStop(1, "rgba(224,122,79,0.16)");
  ctx.fillStyle = at; ctx.fillRect(0, H * (hz - 0.22), W, H * 0.22);
  const r = azar(5);
  for (let i = 0; i < 160; i++) { const x = r() * W, y = r() * H * hz, a = 0.15 + r() * 0.55; ctx.fillStyle = `rgba(199,204,228,${a.toFixed(2)})`; ctx.beginPath(); ctx.arc(x, y, (0.4 + r() * 0.9) * (W / 1400 + 0.4), 0, TAU); ctx.fill(); }
  const rs = rm / K;
  const g = ctx.createRadialGradient(cx, cy, rs, cx, cy, rs * 7);
  g.addColorStop(0, "rgba(255,246,226,0.9)"); g.addColorStop(0.05, "rgba(241,235,221,0.45)"); g.addColorStop(0.22, "rgba(199,204,228,0.12)"); g.addColorStop(0.6, "rgba(138,144,174,0.03)"); g.addColorStop(1, "rgba(138,144,174,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, rs * 7, 0, TAU); ctx.fill();
  ctx.save(); ctx.lineCap = "round";
  try { ctx.filter = `blur(${Math.max(1, rs * 0.04).toFixed(1)}px)`; } catch { /* sin filtro */ }
  const r2 = azar(11);
  for (let i = 0; i < 90; i++) {
    const a = (i / 90) * TAU + (r2() - 0.5) * 0.1, ec = Math.pow(Math.abs(Math.cos(a - 0.25)), 2.4);
    const l = rs * (0.4 + ec * 2.6 + r2() * 0.7), cu = (r2() - 0.5) * rs * 0.3, c = Math.cos(a), s = Math.sin(a);
    ctx.strokeStyle = r2() > 0.7 ? "rgba(199,204,228,0.18)" : "rgba(241,235,221,0.2)"; ctx.lineWidth = rs * (0.02 + r2() * 0.05);
    ctx.beginPath(); ctx.moveTo(cx + c * rs, cy + s * rs);
    ctx.quadraticCurveTo(cx + c * (rs + l * 0.5) - s * cu, cy + s * (rs + l * 0.5) + c * cu, cx + c * (rs + l), cy + s * (rs + l)); ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = "#E07A4F"; ctx.lineWidth = Math.max(1.5, rs * 0.03); ctx.lineCap = "round";
  for (const [a, h] of [[-0.7, 0.1], [2.3, 0.07], [3.8, 0.09]]) {
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a - 0.07) * rs, cy + Math.sin(a - 0.07) * rs);
    ctx.quadraticCurveTo(cx + Math.cos(a) * rs * (1 + h * 2), cy + Math.sin(a) * rs * (1 + h * 2), cx + Math.cos(a + 0.07) * rs, cy + Math.sin(a + 0.07) * rs); ctx.stroke();
  }
  const lu = ctx.createRadialGradient(cx - rm * 0.2, cy - rm * 0.25, 0, cx, cy, rm);
  lu.addColorStop(0, "#121729"); lu.addColorStop(1, "#05060C");
  ctx.fillStyle = lu; ctx.beginPath(); ctx.arc(cx, cy, rm, 0, TAU); ctx.fill();
  ctx.strokeStyle = "rgba(255,246,226,0.8)"; ctx.lineWidth = Math.max(1, rs * 0.012); ctx.beginPath(); ctx.arc(cx, cy, rm + 0.5, 0, TAU); ctx.stroke();
  if (tapa > 0) { ctx.fillStyle = `rgba(10,12,22,${tapa})`; ctx.fillRect(0, 0, W, H); }
}

/* ---------------- montaje ---------------- */
export function montarEclipse(canvas, opciones = {}) {
  const reducido = opciones.reducido ?? (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const fino = typeof matchMedia === "function" && matchMedia("(pointer: fine)").matches;
  const movil = () => (opciones.movil ?? (innerWidth < 720 || (typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches && innerWidth < 1024)));
  const centroDe = () => {
    let c = opciones.centro; if (typeof c === "function") { try { c = c(); } catch { c = null; } }
    if (c && Number.isFinite(c[0] ?? c.x) && Number.isFinite(c[1] ?? c.y)) return Array.isArray(c) ? c : [c.x, c.y];
    return movil() ? [0.8, 0.08] : [0.58, 0.28];
  };
  // acotado: en Safari, dentro de un iframe, innerHeight puede valer 0 al arrancar y la cuenta da NaN (rompía el cuadro fijo)
  const horizonteDe = () => {
    const pre = movil() ? 0.6 : 0.76;
    let v; try { v = Number(typeof opciones.horizonte === "function" ? opciones.horizonte() : opciones.horizonte ?? pre); } catch { v = pre; }
    return Number.isFinite(v) ? Math.min(0.95, Math.max(0.15, v)) : pre;
  };
  // En celular el cuadro de la identidad usa una luna más chica en la esquina (0,045 del alto); 0,05 queda más cerca de la compu.
  const radioDe = () => { const r = typeof opciones.radio === "function" ? opciones.radio() : opciones.radio; return Number.isFinite(r) && r > 0 ? r : (movil() ? 0.05 : 0.085); };
  let velocidad = opciones.velocidad ?? 1;
  if (!canvas.style.pointerEvents) canvas.style.pointerEvents = "none";

  const usar3D = !opciones.sin3D && soportaWebGL2();
  return usar3D ? montar3D() : montar2D();

  /* ---------- sin WebGL2: cuadro fijo y fundidos ---------- */
  function montar2D() {
    const ctx = canvas.getContext("2d");
    let tapa = 0, anim = 0, vivo = true;
    const pintar = () => {
      if (!ctx || !vivo) return;
      const dpr = Math.min(devicePixelRatio || 1, 2), W = Math.round(canvas.clientWidth * dpr), H = Math.round(canvas.clientHeight * dpr);
      if (W < 2 || H < 2) return; // todavía sin tamaño (iframe recién montado): lo pinta el ResizeObserver
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      const [fx, fy] = centroDe();
      try { pintarFijo(ctx, W, H, fx * W, fy * H, radioDe() * H, horizonteDe(), tapa); } catch (e) { console.warn("eclipse: cuadro fijo", e); }
    };
    const fundir = (meta) => new Promise((res) => {
      cancelAnimationFrame(anim);
      const desde = tapa, t0 = performance.now(), dur = 350;
      const paso = (now) => { const k = clamp((now - t0) / dur, 0, 1); tapa = desde + (meta - desde) * (k * k * (3 - 2 * k)); pintar(); if (k < 1) anim = requestAnimationFrame(paso); else res(true); };
      anim = requestAnimationFrame(paso);
    });
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(pintar) : null; ro?.observe(canvas);
    pintar();
    return {
      pausar() {}, reanudar() {}, irA() {}, destello() {},
      cerrar: () => fundir(1), abrir: () => fundir(0),
      destruir() { vivo = false; cancelAnimationFrame(anim); ro?.disconnect(); },
      info: () => ({ modo: "2d", fps: 0, nivel: "fijo" }),
      _paso() { pintar(); },
    };
  }

  /* ---------- WebGL2 ---------- */
  function montar3D() {
    const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: "high-performance", preserveDrawingBuffer: !!opciones.conservar });
    gl.getExtension("EXT_color_buffer_float") || gl.getExtension("EXT_color_buffer_half_float");
    const aniso = gl.getExtension("EXT_texture_filter_anisotropic");
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : "webgl2";
    const prog = { polar: compilar(gl, FS_POLAR), escena: compilar(gl, FS_ESCENA), baja: compilar(gl, FS_BAJA), sube: compilar(gl, FS_SUBE), final: compilar(gl, FS_FINAL) };
    const vao = gl.createVertexArray();
    const perfil = armarPerfil();

    // Paleta calibrada a través de AgX: el fondo sale exacto.
    const COL = {
      cieloAlto: escenaPara("#0A0C16"), cieloBajo: escenaPara("#111527"),
      luzAlto: escenaPara("#151A31"), luzBajo: escenaPara("#262C4B"), oscuro: escenaPara("#0A0C16"),
    };
    const EJE = -Math.PI / 2 + 0.26; // polo norte del sol, levemente inclinado
    const E = EJE + Math.PI / 2, O = EJE - Math.PI / 2;
    const STR = [
      [E + 0.05, 0.17, 1.0, 4.8], [E - 0.3, 0.09, 0.5, 2.8], [O - 0.08, 0.18, 0.95, 5.2], [O + 0.34, 0.09, 0.48, 2.6],
      [E + 0.88, 0.07, 0.32, 2.0], [O - 0.95, 0.06, 0.28, 1.8], [EJE + Math.PI + 0.5, 0.08, 0.22, 1.5],
    ].map(([a, w, s, l]) => [Math.atan2(Math.sin(a), Math.cos(a)), w, s, l]).flat();
    const PROM = [[0.55, 0.19, 0.07, 0.2], [2.45, 0.12, 0.05, 1.7], [-2.25, 0.16, 0.055, 2.3], [-0.95, 0.1, 0.04, 3.6], [1.45, 0.09, 0.035, 4.4], [3.05, 0.14, 0.05, 5.15]].flat();

    let nivel = (() => { const q = opciones.calidad ?? "auto"; const i = NIVELES.findIndex((n) => n.nombre === q); if (i >= 0) return i; return movil() ? 1 : 0; })();
    const auto = (opciones.calidad ?? "auto") === "auto";
    let W = 0, H = 0, dprEf = 1, escena = null, polar = null, mips = [], cssW = 0, cssH = 0;

    function liberar() {
      const borrar = (o) => { if (o) { gl.deleteTexture(o.tex); gl.deleteFramebuffer(o.fb); } };
      borrar(escena); borrar(polar); mips.forEach(borrar); mips = []; escena = polar = null;
    }
    function dimensionar() {
      const N = NIVELES[nivel];
      cssW = Math.max(1, canvas.clientWidth || innerWidth); cssH = Math.max(1, canvas.clientHeight || innerHeight);
      dprEf = Math.min(devicePixelRatio || 1, N.dpr) * N.escala;
      const w = Math.max(2, Math.round(cssW * dprEf)), h = Math.max(2, Math.round(cssH * dprEf));
      const cambiaPolar = !polar || polar.w !== N.polar[0] || polar.h !== N.polar[1];
      if (w === W && h === H && escena && !cambiaPolar && mips.length === N.mips) return;
      W = w; H = h;
      canvas.width = W; canvas.height = H;
      const viejaPolar = cambiaPolar ? null : polar;
      const borrar = (o) => { if (o) { gl.deleteTexture(o.tex); gl.deleteFramebuffer(o.fb); } };
      borrar(escena); mips.forEach(borrar); mips = [];
      if (cambiaPolar) { borrar(polar); polar = null; }
      escena = objetivo(gl, W, H, gl.RGBA16F, gl.RGBA);
      let mw = W, mh = H;
      for (let i = 0; i < N.mips; i++) { mw = Math.max(2, mw >> 1); mh = Math.max(2, mh >> 1); mips.push(objetivo(gl, mw, mh, gl.RGBA16F, gl.RGBA)); }
      polar = viejaPolar || objetivo(gl, N.polar[0], N.polar[1], gl.R16F, gl.RED, true);
      if (aniso) { gl.bindTexture(gl.TEXTURE_2D, polar.tex); gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT))); }
      polarSucio = true;
    }

    /* ---- estado ---- */
    let t = clamp(opciones.t ?? 0, 0, 1) % 1, tau = 0, cuadro = 0, congelado = !!opciones.congelar;
    let w = 0, wv = 0, z = 0, zv = 0, fe = 0, fev = 0, tapaR = 0;
    let modo = "ciclo", pend = null; // pend: { tipo, resolver }
    let cam = [0, 0], camV = [0, 0], mouse = [0, 0], polarSucio = true;
    let ema = 1 / 60, lento = 0, tiempoVivo = 0, corriendo = false, raf = 0, ultimo = 0, oculto = false, enVista = true, pausado = false, vivo = true, manual = false;
    if (reducido) { t = 0.62; congelado = true; }

    const resolverPend = (valor) => { if (pend) { const p = pend; pend = null; p.resolver(valor); } };

    function paso(dt) {
      if (!congelado && !(modo === "cerrado")) t = (t + (dt * velocidad) / CICLO) % 1;
      if (!congelado) tau += dt;
      cuadro++;
      if (reducido) {
        const meta = modo === "cerrando" || modo === "cerrado" ? 1 : 0;
        tapaR = clamp(tapaR + Math.sign(meta - tapaR) * dt / 0.35, 0, 1);
        if (modo === "cerrando" && tapaR >= 1) { modo = "cerrado"; resolverPend(true); }
        if (modo === "abriendo" && tapaR <= 0) { modo = "ciclo"; resolverPend(true); }
        return;
      }
      const wMeta = modo === "cerrando" || modo === "cerrado" ? 1 : modo === "abriendo" ? (z < 0.2 ? 0 : 1) : 0;
      const zMeta = modo === "cerrado" ? 1 : modo === "cerrando" ? (w > 0.95 ? 1 : 0) : 0;
      [w, wv] = resorte(w, wv, wMeta, 4.75, dt);
      [z, zv] = resorte(z, zv, zMeta, 6.6, dt);
      if (modo === "cerrando" && z > 0.996) { z = 1; zv = 0; w = 1; wv = 0; modo = "cerrado"; t = T_REABRIR; resolverPend(true); }
      if (modo === "abriendo" && z < 0.002 && w < 0.002 && Math.abs(wv) < 0.01) { z = w = 0; zv = wv = 0; modo = "ciclo"; resolverPend(true); }
      // destello: respuesta al impulso de un sistema críticamente amortiguado (sube suave y se apaga solo)
      const we = 2.3; fev += (-2 * we * fev - we * we * fe) * dt; fe = Math.max(0, fe + fev * dt);
      // cámara: respiración lenta + parallax del mouse (solo con mouse y sin celular)
      const amp = movil() || !fino ? 0 : 5 * dprEf;
      const drift = [Math.sin((tau * TAU) / 23) * amp, Math.sin((tau * TAU) / 29 + 1.3) * amp * 0.7];
      const meta = [drift[0] + mouse[0] * 6 * dprEf, drift[1] + mouse[1] * 6 * dprEf];
      for (let i = 0; i < 2; i++) [cam[i], camV[i]] = resorte(cam[i], camV[i], meta[i], 2.2, dt);
    }

    let UL = {};
    function calcular() {
      const [fx, fy] = centroDe();
      const Rm0 = radioDe() * H, Rs0 = Rm0 / K;
      const sx = fx * W + cam[0] * 0.9, sy = fy * H + cam[1] * 0.9;
      // ciclo con la transición encima: la luna se desliza al centro y la cámara entra en la umbra
      const sC = sCiclo(t);
      const s = sC * (1 - w), pp = P_OFF * (1 - w);
      const mxR = s * U_DIR[0] + pp * N_DIR[0], myR = s * U_DIR[1] + pp * N_DIR[1];
      const d = Math.hypot(mxR, myR), g = d - KG, U = sinTapar(d);
      const esquina = Math.max(Math.hypot(sx, sy), Math.hypot(W - sx, sy), Math.hypot(sx, H - sy), Math.hypot(W - sx, H - sy));
      const zMax = (esquina / Rm0) * 1.35;
      const ze = z * z * (3 - 2 * z);
      const Z = Math.exp(ze * Math.log(zMax));
      const Rs = Rs0 * Z, Rm = Rs * K;
      const luz = ss(0.0, 0.16, U), oscuro = 1 - luz;
      let corVis = ss(0.03, -0.016, g) * (1 - ss(0.0, 0.55, z));
      const corExt = (0.42 + 0.58 * ss(0.006, -0.046, g)) * (1 + 0.32 * w);
      const corGan = 1 + 0.4 * w * (1 - z);
      const estr = (0.05 + 0.95 * ss(0.55, 1.0, oscuro)) * (1 - ss(0.0, 0.5, z));
      const res0 = ss(0.7, 1.0, oscuro) * (1 - ss(0.2, 0.8, z));
      const lunaX = sx + mxR * Rs, lunaY = sy + myR * Rs;
      // perlas
      const kP = ss(0.16, 0.05, g); // el relieve actúa solo cerca del segundo y tercer contacto
      const pe = [];
      if (g > -D_VALLE - 0.003 && g < 0.06 && z < 0.5) {
        for (const b of perlas(mxR, myR, perfil, kP)) {
          let I = (1 - Math.exp(-b.area / 4e-5)) * Math.exp(-b.area / 2.2e-3);
          pe.push([sx + Math.cos(b.ang) * b.rad * Rs, sy + Math.sin(b.ang) * b.rad * Rs, I, 1.15 * dprEf]);
        }
        if (pe.length === 1) { pe[0][2] *= 3.2; pe[0][3] *= 1.7; }
      }
      // destello sobre el borde, arriba a la derecha
      const fa = -0.72, limbo = (oscuro > 0.5 ? Rm : Rs) + dprEf * 0.5;
      const flash = [sx + Math.cos(fa) * limbo, sy + Math.sin(fa) * limbo, Math.min(fe, 1.3), limbo];
      if (reducido) corVis = Math.max(corVis, 1);
      const tapa = reducido ? tapaR : ss(0.8, 1.0, z);
      UL = { sx, sy, Rs, Rm, lunaX, lunaY, luz, U, corVis, corExt, corGan, estr, res0, pe, flash, zMax, Z, tapa, oscuro, g, kP };
      return UL;
    }

    function dibujar() {
      const N = NIVELES[nivel];
      const s = calcular();
      gl.bindVertexArray(vao);
      gl.disable(gl.BLEND);
      // 1) corona polar (solo cuando se ve)
      if (s.corVis > 0.001 && (polarSucio || (!congelado && cuadro % N.cada === 0))) {
        const P = prog.polar; gl.useProgram(P.p);
        gl.bindFramebuffer(gl.FRAMEBUFFER, polar.fb); gl.viewport(0, 0, polar.w, polar.h);
        gl.uniform1f(P.u.uTiempo, tau); gl.uniform1f(P.u.uEje, EJE); gl.uniform1f(P.u.uLnRmax, LN_RMAX); gl.uniform1i(P.u.uOct, N.oct);
        gl.uniform4fv(P.u.uStr, STR);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindTexture(gl.TEXTURE_2D, polar.tex); gl.generateMipmap(gl.TEXTURE_2D);
        polarSucio = false;
      }
      // 2) escena HDR
      { const P = prog.escena, u = P.u; gl.useProgram(P.p);
        gl.bindFramebuffer(gl.FRAMEBUFFER, escena.fb); gl.viewport(0, 0, W, H);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, polar.tex); gl.uniform1i(u.uCorona, 0);
        gl.uniform2f(u.uRes, W, H); gl.uniform1f(u.uDpr, dprEf); gl.uniform1f(u.uTiempo, tau);
        gl.uniform2f(u.uSol, s.sx, s.sy); gl.uniform1f(u.uRs, s.Rs);
        gl.uniform2f(u.uLuna, s.lunaX, s.lunaY); gl.uniform1f(u.uRm, s.Rm);
        gl.uniform2f(u.uCam, cam[0], cam[1]); gl.uniform1f(u.uHor, horizonteDe() * H);
        gl.uniform3fv(u.uCieloAlto, COL.cieloAlto); gl.uniform3fv(u.uCieloBajo, COL.cieloBajo);
        gl.uniform3fv(u.uLuzAlto, COL.luzAlto); gl.uniform3fv(u.uLuzBajo, COL.luzBajo); gl.uniform3fv(u.uOscuro, COL.oscuro);
        gl.uniform1f(u.uLuz, s.luz); gl.uniform1f(u.uSolGan, 1 + 7 * Math.pow(ss(0.22, 0.0, s.U), 1.6)); /* el ojo se adapta: la última medialuna encandila */ gl.uniform1f(u.uHalo, Math.pow(s.U, 0.8) * (1 - z)); gl.uniform1f(u.uCorVis, s.corVis);
        gl.uniform1f(u.uCorExt, s.corExt); gl.uniform1f(u.uCorGan, s.corGan); gl.uniform1f(u.uEstr, s.estr); gl.uniform1f(u.uRes0, s.res0);
        gl.uniform1f(u.uZoomF, s.Z); gl.uniform1f(u.uLnRmax, LN_RMAX); gl.uniform2f(u.uTexPolar, polar.w, polar.h);
        gl.uniform1fv(u.uHa, perfil.a); gl.uniform1fv(u.uHn, perfil.n); gl.uniform1fv(u.uHp, perfil.p);
        gl.uniform2f(u.uVa, perfil.va[0], perfil.va[1]); gl.uniform2f(u.uVd, perfil.vd[0], perfil.vd[1]); gl.uniform1f(u.uVw, perfil.vw); gl.uniform1f(u.uPerfilK, s.kP);
        const pe = new Float32Array(32); s.pe.forEach((b, i) => pe.set(b, i * 4));
        gl.uniform4fv(u.uPerla, pe); gl.uniform1i(u.uNP, s.pe.length);
        gl.uniform4fv(u.uProm, PROM);
        gl.uniform4f(u.uFlash, s.flash[0], s.flash[1], s.flash[2], s.flash[3]);
        gl.uniform1f(u.uPlaneta, ss(0.75, 1.0, s.oscuro) * (1 - z));
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      // 3) bloom: bajadas y subidas progresivas
      { const P = prog.baja; gl.useProgram(P.p); gl.activeTexture(gl.TEXTURE0); gl.uniform1i(P.u.uTex, 0); gl.uniform1f(P.u.uUmbral, 0.9);
        let fuente = escena;
        for (let i = 0; i < mips.length; i++) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, mips[i].fb); gl.viewport(0, 0, mips[i].w, mips[i].h);
          gl.bindTexture(gl.TEXTURE_2D, fuente.tex); gl.uniform2f(P.u.uTexel, 1 / fuente.w, 1 / fuente.h); gl.uniform1i(P.u.uPrimera, i === 0 ? 1 : 0);
          gl.drawArrays(gl.TRIANGLES, 0, 3); fuente = mips[i];
        }
        const S = prog.sube; gl.useProgram(S.p); gl.uniform1i(S.u.uTex, 0);
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
        for (let i = mips.length - 1; i > 0; i--) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, mips[i - 1].fb); gl.viewport(0, 0, mips[i - 1].w, mips[i - 1].h);
          gl.bindTexture(gl.TEXTURE_2D, mips[i].tex); gl.uniform2f(S.u.uTexel, 1 / mips[i].w, 1 / mips[i].h); gl.uniform1f(S.u.uPeso, 0.78);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        }
        gl.disable(gl.BLEND);
      }
      // 4) final: AgX, grano, dithering y la sombra que tapa
      { const P = prog.final, u = P.u; gl.useProgram(P.p);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, escena.tex); gl.uniform1i(u.uEscena, 0);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, mips[0].tex); gl.uniform1i(u.uBloom, 1);
        gl.uniform2f(u.uRes, W, H); gl.uniform2f(u.uTexelB, 1 / mips[0].w, 1 / mips[0].h);
        gl.uniform1f(u.uBloomI, 0.09 / mips.length * 3); gl.uniform1f(u.uFrame, congelado ? 1 : cuadro % 4096);
        gl.uniform1f(u.uGrano, 0.012); gl.uniform1f(u.uTapa, s.tapa); gl.uniform3fv(u.uTapaColor, OSCURO);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.activeTexture(gl.TEXTURE0);
      }
    }

    function medir(dt) {
      ema += (dt - ema) * 0.05; tiempoVivo += dt;
      if (!auto || tiempoVivo < 2 || nivel >= NIVELES.length - 1) return;
      lento = ema > 1 / 50 ? lento + dt : Math.max(0, lento - dt * 0.5);
      if (lento > 2) { nivel++; lento = 0; tiempoVivo = 0; ema = 1 / 60; dimensionar(); }
    }
    function frame(now) {
      raf = 0;
      if (!vivo || !corriendo) return;
      const dt = Math.min(0.1, Math.max(0, (now - ultimo) / 1000)); ultimo = now;
      medir(dt); paso(dt); dibujar();
      // con movimiento reducido solo se dibuja mientras hay un fundido en curso
      if (reducido && modo !== "cerrando" && modo !== "abriendo") { corriendo = false; return; }
      raf = requestAnimationFrame(frame);
    }
    function arrancar() {
      if (corriendo || !vivo || pausado || oculto || !enVista) return;
      corriendo = true; ultimo = performance.now(); raf = requestAnimationFrame(frame);
    }
    function parar() { corriendo = false; if (raf) cancelAnimationFrame(raf); raf = 0; }

    const alVisibilidad = () => { oculto = document.hidden; if (oculto) parar(); else arrancar(); };
    const alMouse = (e) => { mouse = [(e.clientX / innerWidth - 0.5) * 2, (e.clientY / innerHeight - 0.5) * 2]; };
    const alRedim = () => { dimensionar(); if (!corriendo) dibujar(); };
    document.addEventListener("visibilitychange", alVisibilidad);
    if (fino && !reducido) addEventListener("pointermove", alMouse, { passive: true });
    const ro = typeof ResizeObserver === "function" ? new ResizeObserver(alRedim) : null; ro?.observe(canvas);
    if (!ro) addEventListener("resize", alRedim);
    const io = typeof IntersectionObserver === "function" ? new IntersectionObserver((es) => { enVista = es.some((e) => e.isIntersecting); if (enVista) arrancar(); else parar(); }) : null;
    io?.observe(canvas);
    canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); parar(); });
    canvas.addEventListener("webglcontextrestored", () => { location.reload(); });

    dimensionar(); dibujar();
    oculto = document.hidden;
    if (!reducido) arrancar();

    const transicion = (tipo) => new Promise((resolver) => {
      if (tipo === "cerrar" && modo === "cerrado") return resolver(true);
      if (tipo === "abrir" && modo === "ciclo") return resolver(true);
      resolverPend(false);
      modo = tipo === "cerrar" ? "cerrando" : "abriendo";
      pend = { tipo, resolver };
      if (!manual && (pausado || oculto || !enVista)) { // sin cuadros no hay animación: se resuelve al instante
        if (tipo === "cerrar") { w = z = 1; wv = zv = 0; tapaR = 1; modo = "cerrado"; t = T_REABRIR; }
        else { w = z = 0; wv = zv = 0; tapaR = 0; modo = "ciclo"; }
        dibujar(); resolverPend(true); return;
      }
      if (reducido) { corriendo = false; arrancar(); }
    });

    return {
      pausar() { pausado = true; parar(); },
      reanudar() { pausado = false; arrancar(); },
      cerrar: () => transicion("cerrar"),
      abrir: () => transicion("abrir"),
      destello() { if (reducido) return; fev += 6.4 * Math.max(0, 1 - fe); if (!corriendo) dibujar(); },
      irA(x, congelar = congelado) { t = ((Number(x) % 1) + 1) % 1; congelado = !!congelar; polarSucio = true; dibujar(); },
      velocidad(v) { velocidad = v; },
      destruir() {
        vivo = false; parar(); ro?.disconnect(); io?.disconnect();
        document.removeEventListener("visibilitychange", alVisibilidad); removeEventListener("pointermove", alMouse); removeEventListener("resize", alRedim);
        liberar(); resolverPend(false);
      },
      info: () => ({ modo: reducido ? "reducido" : "3d", estado: modo, fps: Math.round(1 / ema), nivel: NIVELES[nivel].nombre, renderer, ancho: W, alto: H, t: +t.toFixed(4), g: UL.g, tapa: UL.tapa }),
      // Solo para pruebas: avanza el reloj a mano con la animación pausada.
      _paso(seg) { manual = true; const n = Math.max(1, Math.round(seg * 60)); for (let i = 0; i < n; i++) paso(seg / n); dibujar(); },
    };
  }
}
