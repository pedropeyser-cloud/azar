// Mesa de la GENERALA, dirección A «Horizonte» con los dados sueltos de la C (Pedro, 2026-11-19), sobre el esqueleto
// común de a varios (nucleo/mesa-n.js) y con los dados «Eclipse» del Desconfío.
// Arriba, el cielo: la planilla de todos como constelaciones (cada jugador una fila de estrellas; lo anotado se enciende
// y se une con el anterior; el total con su barra de luz). En el celular la planilla se da vuelta: un jugador por columna.
// Abajo, el mostrador con la franja de luz: el paño donde caen los dados, que todos ven caer. En tu turno los movés
// libres y quedan donde los soltás; los que querés volver a tirar los arrastrás al cubilete (una vez adentro no salen)
// y tocás el cubilete para tirarlos. Se anota tocando tu estrella, que muestra cuánto daría. Tachar pide confirmación.
// Lo que mueve cada uno es solo de su pantalla: a los demás les llega el tiro (los guardados se apartan solos y el resto
// vuelve al cubilete, se sacude y cae en los mismos lugares para todos).
import { montarMesaN, esc } from "../../nucleo/mesa-n.js";
import { sonido } from "../../nucleo/sonido.js";
import { cara, formaDeJugador } from "../../nucleo/caras.js";
import { puntaje, NOMBRES, TIROS, DADOS, servible } from "./motor.js";
import { dado, cubilete, DEFS } from "../desconfio/dados.js";

const QUIETO = matchMedia("(prefers-reduced-motion: reduce)").matches;
const ORD = ["", "1º", "2º", "3º"];
const LARGO = { E: "Escalera", F: "Full", P: "Póker", G: "Generala", DG: "Doble" };
const CORTO = { E: "Esc", F: "Full", P: "Pók", G: "Gen", DG: "Dob" };
const A_CAT = { 1: "al 1", 2: "al 2", 3: "al 3", 4: "al 4", 5: "al 5", 6: "al 6", E: "a la escalera", F: "al full", P: "al póker", G: "a la generala", DG: "a la doble generala" };
const CON_ART = { 1: "el 1", 2: "el 2", 3: "el 3", 4: "el 4", 5: "el 5", 6: "el 6", E: "la escalera", F: "el full", P: "el póker", G: "la generala", DG: "la doble generala" };
const NOM_DADO = { 1: "as", 2: "dos", 3: "tres", 4: "cuatro", 5: "cinco", 6: "seis" };
const esNum = (c) => /^\d$/.test(c);

// el cielo de la mesa: estrellas fijas (siempre las mismas)
const ESTRELLAS = (() => {
  let s = 11; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return `<svg class="gx-estrellas" viewBox="0 0 1000 620" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${Array.from({ length: 150 }, () => {
    const rad = r() < 0.08 ? 1.6 : 0.5 + r() * 0.8;
    return `<circle cx="${(r() * 1000).toFixed(1)}" cy="${(r() * 620).toFixed(1)}" r="${rad.toFixed(2)}" fill="#F1EBDD" opacity="${(0.12 + r() * 0.5).toFixed(2)}"/>`;
  }).join("")}</svg>`;
})();
const DESTELLO = `<svg class="gx-destello" viewBox="-10 -10 20 20" aria-hidden="true"><path d="M0-10Q1-1 10 0Q1 1 0 10Q-1 1-10 0Q-1-1 0-10Z" fill="#F4CE76"/></svg>`;

// azar con semilla: los dados caen en el mismo lugar en todas las pantallas
function semillaDe(txt) { let h = 2166136261; for (const ch of txt) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function azarDe(txt) { let a = semillaDe(txt) || 1; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function montarMesa(cont, { fuente, salir, otraMesa }) {
  let tachar = null;          // el casillero que estás por tachar (pide confirmación)
  let recien = null, tRecien = 0;
  let vActual = fuente.vista(), pActual = null;
  const globos = new Map();   // j → texto del globo del bot (se copia del esqueleto, que lo pinta en el arco escondido)

  // ---------- los dados: dónde está cada uno (fracciones del paño) y si está en el cubilete ----------
  const D = { pos: Array.from({ length: DADOS }, () => null), cubo: Array(DADOS).fill(true), val: Array(DADOS).fill(0) };
  let tJuntar = 0, tok = 0, tiroN = 0, ocupado = false;   // ocupado: hay un tiro animándose
  const anims = new Set();
  let el = null;              // { mesa, astral, estado, pano, cubo, dados[] } una vez montado

  function armar(p) {
    p.centro.innerHTML = `<div class="gx-mesa">${ESTRELLAS}
      <div class="gx-cielo"><div class="gx-astral" aria-label="Planilla"></div></div>
      <div class="gx-mostrador">
        <div class="gx-estado" aria-live="polite"></div>
        <div class="gx-pano">
          <i class="gx-eclipse" aria-hidden="true"></i><i class="gx-horizonte" aria-hidden="true"></i>
          <button type="button" class="gx-cubo" aria-label="Cubilete">${cubilete("grande")}<span class="gx-cuenta"></span></button>
          ${Array.from({ length: DADOS }, (_, i) => `<button type="button" class="gx-dado en-cubo" data-i="${i}" disabled></button>`).join("")}
        </div>
      </div></div>`;
    const m = p.centro.querySelector(".gx-mesa");
    el = { mesa: m, astral: m.querySelector(".gx-astral"), estado: m.querySelector(".gx-estado"), pano: m.querySelector(".gx-pano"),
      cubo: m.querySelector(".gx-cubo"), dados: [...m.querySelectorAll(".gx-dado")] };
  }

  // geometría del paño, en píxeles
  function geo() {
    const r = el.pano.getBoundingClientRect(), c = el.cubo.getBoundingClientRect();
    const t = el.dados[0].offsetWidth || 60;
    return { W: Math.max(1, r.width), H: Math.max(1, r.height), t, r,
      cubo: { x: c.left - r.left + c.width / 2, y: c.top - r.top + c.height * 0.2, izq: c.left - r.left, der: c.right - r.left, arr: c.top - r.top, aba: c.bottom - r.top } };
  }
  const limitar = (g, x, y) => [Math.min(1 - g.t * 0.55 / g.W, Math.max(g.t * 0.55 / g.W, x)), Math.min(1 - g.t * 0.55 / g.H, Math.max(g.t * 0.55 / g.H, y))];
  // dónde cae un dado: al azar con semilla, a la derecha del cubilete y sin pisar a los que ya están
  function caida(g, sem, ocupados) {
    const rnd = azarDe(sem), m = g.t * 0.62;
    const x0 = Math.min(g.W - m, g.cubo.der + g.t * 0.9), x1 = g.W - m, y0 = m, y1 = g.H - m;
    let mejor = null, lejos = -1;
    for (let k = 0; k < 40; k++) {
      const x = x0 + rnd() * Math.max(1, x1 - x0), y = y0 + rnd() * Math.max(1, y1 - y0);
      const d = ocupados.reduce((a, o) => Math.min(a, Math.hypot(o[0] - x, o[1] - y)), Infinity);
      if (d > g.t * 1.25) { mejor = [x, y]; break; }
      if (d > lejos) { lejos = d; mejor = [x, y]; }
    }
    return { x: mejor[0] / g.W, y: mejor[1] / g.H, r: Math.round(rnd() * 70 - 35) };
  }
  // los guardados de otro jugador se apartan en fila arriba a la derecha
  function apartado(g, k) {
    const [x, y] = limitar(g, 1 - (g.t * 0.72 + k * g.t * 1.18) / g.W, (g.t * 0.62) / g.H);
    return { x, y, r: [-4, 3, -2, 5, -3][k % 5] };
  }
  const ocupadosPx = (g, salvo) => D.pos.map((p, i) => (!D.cubo[i] && p && !salvo.includes(i) ? [p.x * g.W, p.y * g.H] : null)).filter(Boolean);

  function caraDado(i) {
    const b = el.dados[i], v = D.val[i];
    if (b.dataset.v !== String(v)) { b.innerHTML = v ? dado(v) : ""; b.dataset.v = String(v); }
  }
  function colocar() {
    if (!el) return;
    D.pos.forEach((p, i) => {
      const b = el.dados[i];
      caraDado(i);
      b.classList.toggle("en-cubo", D.cubo[i] || !p);
      if (p) { b.style.left = `${p.x * 100}%`; b.style.top = `${p.y * 100}%`; b.style.setProperty("--r", `${p.r}deg`); }
    });
  }
  function animar(b, kf, ms, extra = {}) {
    if (QUIETO || !b.animate) return Promise.resolve();
    const a = b.animate(kf, { duration: ms, easing: "cubic-bezier(.2,.75,.25,1)", ...extra });
    anims.add(a);
    return a.finished.catch(() => {}).finally(() => anims.delete(a));
  }
  const dormir = (ms) => new Promise((r) => setTimeout(r, QUIETO ? 0 : ms));
  function cortar() {
    tok++; ocupado = false;
    for (const a of [...anims]) { try { a.finish(); } catch { /* ya terminó */ } }
    anims.clear();
    el?.dados.forEach((b) => b.classList.remove("rueda", "agarrado"));
    el?.cubo.classList.remove("sacude");
    colocar();
  }
  const pct = (x) => `${x * 100}%`;
  const tr = (r, s = 1) => `translate(-50%, -50%) rotate(${r}deg) scale(${s})`;

  // un dado vuelve al cubilete (anima hasta la boca y desaparece)
  async function alCubo(i, g = geo()) {
    const p = D.pos[i], b = el.dados[i];
    D.cubo[i] = true;
    if (p && !b.classList.contains("en-cubo")) {
      await animar(b, [{ left: pct(p.x), top: pct(p.y), transform: tr(p.r), opacity: 1 }, { left: pct(g.cubo.x / g.W), top: pct(g.cubo.y / g.H), transform: tr(p.r + 90, 0.35), opacity: 0 }], 300);
    }
    b.classList.add("en-cubo");
  }
  function juntarTodos(conAnim = true) {
    clearTimeout(tJuntar); tJuntar = 0;
    if (!el) return;
    const g = geo();
    for (let i = 0; i < DADOS; i++) { if (conAnim && !D.cubo[i]) alCubo(i, g); else { D.cubo[i] = true; el.dados[i].classList.add("en-cubo"); } }
    pintarCubo();
  }

  // un tiro (de cualquiera): los guardados se quedan (o se apartan si son de otro), el resto vuelve al cubilete,
  // se sacude y cae en lugares con semilla (los mismos para todos)
  const tirados0 = (e) => Array.from({ length: DADOS }, (_, i) => i).filter((i) => !e.guardados.includes(i));
  async function tirada(e, mio) {
    cortar();
    clearTimeout(tJuntar); tJuntar = 0;
    const mi = ++tok, g = geo();
    ocupado = true;
    for (const i of tirados0(e)) el.dados[i].classList.add("rueda");
    const tirados = Array.from({ length: DADOS }, (_, i) => i).filter((i) => !e.guardados.includes(i));
    // 1. los que se quedan: los míos donde los dejé; los de otro, apartados
    const movidas = [];
    e.guardados.forEach((i, k) => {
      if (mio && D.pos[i] && !D.cubo[i]) return;
      const desde = !D.cubo[i] && D.pos[i] ? D.pos[i] : null, hasta = apartado(g, k);
      D.pos[i] = hasta; D.cubo[i] = false; D.val[i] = e.dados[i];
      const b = el.dados[i]; caraDado(i); b.classList.remove("en-cubo");
      b.style.left = pct(hasta.x); b.style.top = pct(hasta.y); b.style.setProperty("--r", `${hasta.r}deg`);
      if (desde) movidas.push(animar(b, [{ left: pct(desde.x), top: pct(desde.y), transform: tr(desde.r) }, { left: pct(hasta.x), top: pct(hasta.y), transform: tr(hasta.r) }], 380));
    });
    // los que se tiran y estaban afuera vuelven al cubilete
    for (const i of tirados) if (!D.cubo[i]) movidas.push(alCubo(i, g));
    pintarCubo();
    if (movidas.length) await Promise.all(movidas);
    if (mi !== tok) return;
    // 2. se sacude
    el.cubo.classList.add("sacude");
    await dormir(mio ? 380 : 520);
    el.cubo.classList.remove("sacude");
    if (mi !== tok) return;
    // 3. caen
    sonido.play("carta");
    const ocup = ocupadosPx(g, tirados);
    const vuelos = tirados.map((i, k) => {
      const c = caida(g, `${e.jugador}|${tiroN}|${e.tiro}|${i}|${e.dados.join("")}`, ocup);
      ocup.push([c.x * g.W, c.y * g.H]);
      D.pos[i] = c; D.cubo[i] = false; D.val[i] = e.dados[i];
      const b = el.dados[i]; caraDado(i); b.classList.remove("en-cubo"); b.classList.add("rueda");
      b.style.left = pct(c.x); b.style.top = pct(c.y); b.style.setProperty("--r", `${c.r}deg`);
      const sx = g.cubo.x / g.W, sy = g.cubo.y / g.H;
      const mx = sx + (c.x - sx) * 0.62, my = Math.min(sy, c.y) - 0.12;
      return animar(b, [
        { left: pct(sx), top: pct(sy), transform: tr(c.r - 420, 0.4), opacity: 0 },
        { left: pct(mx), top: pct(my), transform: tr(c.r - 140, 1.06), opacity: 1, offset: 0.55 },
        { left: pct(c.x + 0.012), top: pct(c.y), transform: tr(c.r + 8, 1), offset: 0.85 },
        { left: pct(c.x), top: pct(c.y), transform: tr(c.r, 1) },
      ], 640 + k * 70, { delay: k * 40 });
    });
    pintarCubo();
    await Promise.all(vuelos);
    if (mi !== tok) return;
    ocupado = false;
    el.dados.forEach((b) => b.classList.remove("rueda"));
    pintarCubo();
  }

  // si la pantalla quedó distinta de la vista (al entrar, al reconectar), acomodar sin animar
  function sincronizar(v) {
    if (!el || anims.size || ocupado) return;
    if (v.tiro === 0) { if (!tJuntar) { for (let i = 0; i < DADOS; i++) D.cubo[i] = true; } }
    else {
      const g = geo();
      v.dados.forEach((d, i) => { D.val[i] = d; });
      const faltan = D.cubo.every(Boolean) || D.pos.some((p, i) => !D.cubo[i] && !p);
      if (faltan && v.turno !== v.yo) {
        v.guardados.forEach((i, k) => { D.pos[i] = apartado(g, k); D.cubo[i] = false; });
        const ocup = ocupadosPx(g, []);
        v.dados.forEach((_, i) => {
          if (v.guardados.includes(i)) return;
          const c = caida(g, `${v.turno}|${tiroN}|${v.tiro}|${i}|${v.dados.join("")}`, ocup); ocup.push([c.x * g.W, c.y * g.H]);
          D.pos[i] = c; D.cubo[i] = false;
        });
      } else if (faltan) {
        const ocup = ocupadosPx(g, []);
        v.dados.forEach((_, i) => { if (!D.pos[i]) { const c = caida(g, `${v.turno}|${v.tiro}|${i}`, ocup); ocup.push([c.x * g.W, c.y * g.H]); D.pos[i] = c; } D.cubo[i] = false; });
      }
    }
    colocar();
  }

  // ---------- planilla ----------
  const caras = new Map();
  function caraDe(j, p) {
    const jj = fuente.jugadores()[j], forma = formaDeJugador(jj, [2, 4, 1, 5, 0, 3][j % 6]), nom = p.nombre(j);
    const k = `${forma}|${nom}`;
    if (caras.get(j)?.k !== k) caras.set(j, { k, html: cara(forma, nom) });
    return caras.get(j).html;
  }
  function planilla(v, p) {
    const { yo, n } = p;
    const orden = Array.from({ length: n }, (_, k) => (yo + k) % n);
    const max = Math.max(1, ...v.totales), hayPuntos = v.totales.some((t) => t > 0);
    const cab = v.cats.map((c, k) => `<span class="gx-cab${esNum(c) ? " es-num" : ""}" style="--c:${k}"><i class="largo">${esNum(c) ? c : LARGO[c]}</i><i class="corto">${esNum(c) ? c : CORTO[c]}</i></span>`).join("");
    const kTurno = v.fase === "jugar" ? orden.indexOf(v.turno) : -1;
    const filas = orden.map((j, k) => {
      const pl = v.planillas[j], mia = j === yo;
      let previo = -1;
      const celdas = v.cats.map((cat, c) => {
        const x = pl[cat], st = `--p:${k};--c:${c}`;
        const marca = recien && recien.jugador === j && recien.cat === cat ? " recien" : "";
        if (x === null && mia && v.puedoAnotar) {
          const pts = puntaje(v.dados, cat, v.tiro === 1, pl);
          const nombre = esNum(cat) ? `al ${cat}` : `a ${NOMBRES[cat].toLowerCase()}`;
          return `<span class="gx-celda" style="${st}"><button type="button" class="gx-anotar${pts ? "" : " cero"}${tachar === cat ? " por-tachar" : ""}" data-cat="${cat}" aria-label="${pts ? `Anotar ${pts} ${nombre}` : `Tachar ${NOMBRES[cat].toLowerCase()}`}">${pts || "✕"}</button></span>`;
        }
        if (x === null) return `<span class="gx-celda vacio${marca}" style="${st}"></span>`;
        if (x === 0) return `<span class="gx-celda cruz${marca}" style="${st}"><span class="n" aria-label="tachado">✕</span></span>`;
        const gap = previo >= 0 ? c - previo : 0; previo = c;
        return `<span class="gx-celda lleno${marca}" style="${st}${gap ? `;--g:${gap}` : ""}">${gap ? `<i class="gx-linea"></i>` : ""}${DESTELLO}<span class="n">${x}</span></span>`;
      }).join("");
      const lider = hayPuntos && v.totales[j] === max;
      const tirando = v.fase === "jugar" && v.turno === j && !mia ? `<small>tirando</small>` : "";
      return `<span class="gx-quien${mia ? " yo" : ""}" style="--p:${k}" data-j="${j}">${caraDe(j, p)}<span class="gx-nom"><b>${esc(mia ? "Vos" : p.nombre(j))}</b>${tirando}</span><span class="gx-globo"></span></span>${celdas}
        <span class="gx-tot${lider ? " lider" : ""}" style="--p:${k};--t:${(v.totales[j] / max).toFixed(3)}"><b>${v.totales[j]}</b><i class="gx-barra"></i></span>`;
    }).join("");
    el.astral.style.setProperty("--nc", v.cats.length);
    el.astral.style.setProperty("--nj", n);
    el.astral.dataset.n = n;
    el.astral.innerHTML = `${kTurno >= 0 ? `<i class="gx-banda" style="--p:${kTurno}"></i>` : ""}<span class="gx-esquina">${v.tipo === "corta" ? "Corta" : "Planilla"}</span>${cab}${filas}`;
    for (const [j, txt] of globos) { const g = el.astral.querySelector(`.gx-quien[data-j="${j}"] .gx-globo`); if (g) { g.textContent = txt; g.classList.add("ver"); } }
  }

  function estado(v, p) {
    const nom = (j) => (j === p.yo ? "Vos" : p.nombre(j));
    const mio = v.fase === "jugar" && v.turno === p.yo;
    const u = v.ultima;
    const antes = u && v.tiro === 0 ? (() => {
      const yoFui = u.jugador === p.yo, quien = yoFui ? "" : `${esc(nom(u.jugador))} `;
      if (!u.puntos) return `${quien}${yoFui ? "Tachaste" : "tachó"} ${CON_ART[u.cat]}`;
      return `${quien}${yoFui ? "Anotaste" : "anotó"} <b>${u.puntos}</b> ${A_CAT[u.cat]}${u.servida ? (u.cat === "E" ? " (servida)" : " (servido)") : ""}`;
    })() : "";
    let titulo, ayuda;
    if (v.fase === "fin") { titulo = v.servida !== null ? `${esc(nom(v.servida))}: generala servida` : "Terminó la partida"; ayuda = antes; }
    else if (mio) {
      const adentro = D.cubo.filter(Boolean).length;
      if (v.tiro === 0) { titulo = "Te toca"; ayuda = `${antes ? `${antes}. ` : ""}Tocá el cubilete para tirar.`; }
      else if (v.tiro < TIROS) { titulo = `Tu ${ORD[v.tiro]} tiro de ${TIROS}`; ayuda = adentro ? `Tocá el cubilete para tirar ${adentro === 1 ? "el dado" : `los ${adentro}`} de adentro, o anotá en tu fila.` : "Arrastrá al cubilete los que querés volver a tirar. Los que quedan afuera se guardan. O anotá en tu fila."; }
      else { titulo = "Último tiro"; ayuda = "Anotá en una estrella de tu fila."; }
    } else if (v.turno !== null) { titulo = `Tira ${esc(p.nombre(v.turno))}${v.tiro ? ` · ${ORD[v.tiro]} tiro` : ""}`; ayuda = antes; }
    const acc = tachar ? `<div class="gx-tachar"><span>¿Tachás ${esc(NOMBRES[tachar].toLowerCase())}? Vale 0 y no se usa más.</span><button type="button" class="boton suave no-tachar">No</button><button type="button" class="boton primario si-tachar">Tachar</button></div>` : "";
    el.estado.innerHTML = `<div class="gx-texto"><b>${titulo || ""}</b>${ayuda ? `<small>${ayuda}</small>` : ""}</div>${acc}`;
    el.estado.classList.toggle("con-tachar", !!tachar);
  }

  function pintarCubo() {
    if (!el) return;
    const v = vActual, mio = v.fase === "jugar" && v.turno === v.yo;
    const adentro = D.cubo.filter(Boolean).length;
    const puede = mio && v.puedoTirar && (v.tiro === 0 || adentro > 0);
    el.cubo.disabled = !mio || !v.puedoTirar;
    el.cubo.classList.toggle("llama", puede);
    el.cubo.classList.toggle("ajeno", !mio);
    el.cubo.setAttribute("aria-label", !mio ? "Cubilete" : v.tiro === 0 ? "Tirar los dados" : adentro ? `Tirar ${adentro === 1 ? "el dado" : `los ${adentro} dados`} del cubilete (${TIROS - v.tiro} ${TIROS - v.tiro === 1 ? "tiro queda" : "tiros quedan"})` : "Cubilete vacío: arrastrá un dado para volver a tirarlo");
    el.cubo.querySelector(".gx-cuenta").textContent = mio && v.tiro > 0 && v.tiro < TIROS && adentro && adentro < DADOS ? String(adentro) : "";
    const mover = mio && v.tiro > 0;
    el.dados.forEach((b, i) => {
      b.disabled = !mover || D.cubo[i];
      b.setAttribute("aria-label", `${NOM_DADO[D.val[i]] || "dado"}${mover && v.puedoTirar && !D.cubo[i] ? ". Arrastralo al cubilete para volver a tirarlo" : ""}`);
    });
    el.pano.classList.toggle("viejo", v.tiro === 0 && v.fase === "jugar");
    el.pano.classList.toggle("mio", mio);
  }

  function pintar(v, ev, p) {
    if (!el) armar(p);
    if (!v.puedoAnotar) tachar = null;
    p.estado(v.fase === "fin" ? "Terminó la partida" : `Planilla ${v.tipo} · ${v.cats.length} casilleros`);
    if (v.fase === "jugar" && v.turno === v.yo && v.tiro === 0 && tJuntar === 0) for (let i = 0; i < DADOS; i++) D.cubo[i] = true;
    sincronizar(v);
    planilla(v, p);
    estado(v, p);
    pintarCubo();
  }

  function alEventos(v, ev, p) {
    for (const e of ev) {
      if (e.t === "revancha") { tachar = null; cortar(); juntarTodos(false); tiroN = 0; }
      else if (e.t === "turno") {
        tachar = null; tiroN++;
        if (e.jugador === p.yo) sonido.play("tic");
        // lo último queda a la vista un rato y después los dados vuelven al cubilete
        clearTimeout(tJuntar);
        tJuntar = setTimeout(() => { tJuntar = 0; juntarTodos(true); if (pActual) estado(vActual, pActual); }, 1500);
      } else if (e.t === "tiro") { tirada(e, e.jugador === p.yo); }
      else if (e.t === "servida") { sonido.play("coincidencia"); p.grito("¡Generala servida!", 2200); }
      else if (e.t === "anota") {
        recien = { jugador: e.jugador, cat: e.cat };
        clearTimeout(tRecien); tRecien = setTimeout(() => { recien = null; repintar(); }, 2600);
        if ((e.cat === "G" || e.cat === "DG") && e.puntos > 0) { sonido.play("coincidencia"); p.grito(e.cat === "DG" ? "¡Doble generala!" : "¡Generala!"); }
        else if (e.servida) {
          // servido: grito grande (Pedro, 2026-11-19); la escalera es «servida»
          sonido.play("ya"); p.grito(`¡${NOMBRES[e.cat]} ${e.cat === "E" ? "servida" : "servido"}!`, 1800);
        }
        else if (e.puntos > 0 && servible(e.cat)) sonido.play("ya");
        else sonido.play("poner");
      }
    }
  }

  const final = (v) => {
    const gane = v.ganadores.includes(v.yo);
    const nom = (j) => (j === v.yo ? "Vos" : v.nombres[j] || "otro");
    const titulo = v.servida !== null ? (gane ? "¡Generala servida!" : `${nom(v.servida)}: servida`) : v.ganadores.length > 1 ? (gane ? "¡Empate arriba!" : "Empate") : gane ? "¡Ganaste!" : `Ganó ${nom(v.ganador)}`;
    return {
      gane, titulo,
      html: `<p>${v.servida !== null ? (gane ? "Cinco iguales en el primer tiro: partida ganada." : "Cinco iguales en el primer tiro y se terminó.") : v.ganadores.length > 1 ? `Empataron ${v.ganadores.map((j) => esc(nom(j))).join(" y ")} con ${v.totales[v.ganador]}.` : `Con ${v.totales[v.ganador]} puntos.`}</p>
        <ol class="tabla-porotos">${v.orden.map((j) => `<li class="${j === v.yo ? "yo" : ""}"><b>${esc(nom(j))}</b><span>${v.totales[j]}</span></li>`).join("")}</ol>`,
    };
  };

  const desmontar = montarMesaN(cont, {
    fuente, salir, otraMesa, clase: "generala", titulo: "Generala",
    pintar: (v, ev, p) => { vActual = v; pActual = p; pintar(v, ev, p); }, alEventos, final,
  });
  cont.querySelector(".mesa-n").insertAdjacentHTML("afterbegin", DEFS);
  function repintar() { if (pActual) pintar(vActual, [], pActual); }

  // los globos de los bots: el esqueleto los pinta en el arco (escondido en esta mesa); se copian al lado del nombre
  const obs = new MutationObserver(() => {
    globos.clear();
    cont.querySelectorAll(".rivales-n .silla-n").forEach((s) => { const b = s.querySelector(".burbuja"); if (b?.classList.contains("ver") && b.textContent) globos.set(Number(s.dataset.j), b.textContent); });
    el?.astral.querySelectorAll(".gx-quien").forEach((q) => { const g = q.querySelector(".gx-globo"), t = globos.get(Number(q.dataset.j)); g.textContent = t || ""; g.classList.toggle("ver", !!t); });
  });
  const rivales = cont.querySelector(".rivales-n");
  if (rivales) obs.observe(rivales, { subtree: true, attributes: true, attributeFilter: ["class"], childList: true, characterData: true });

  async function mandar(accion, b) {
    if (b) b.disabled = true;
    const r = await fuente.enviar(accion);
    if (r) { sonido.play("rechazo"); pActual?.aviso(r.mensaje); if (b) b.disabled = false; }
  }

  // ---------- arrastrar los dados (libres: quedan donde los soltás) ----------
  let arr = null;   // { i, id, dx, dy, x0, y0, movio }
  function sobreCubo(px, py, g) {
    const m = g.t * 0.35;
    return px > g.cubo.izq - m && px < g.cubo.der + m && py > g.cubo.arr - m && py < g.cubo.aba + m;
  }
  function onDown(e) {
    const b = e.target.closest(".gx-dado");
    if (!b || b.disabled || e.button > 0) return;
    const v = vActual;
    if (!(v.fase === "jugar" && v.turno === v.yo && v.tiro > 0)) return;
    if (anims.size) cortar();
    const i = Number(b.dataset.i), g = geo(), p = D.pos[i];
    if (!p || D.cubo[i]) return;
    e.preventDefault();
    b.setPointerCapture?.(e.pointerId);
    arr = { i, id: e.pointerId, dx: e.clientX - (g.r.left + p.x * g.W), dy: e.clientY - (g.r.top + p.y * g.H), x0: e.clientX, y0: e.clientY, movio: false, g };
    b.classList.add("agarrado");
  }
  function onMove(e) {
    if (!arr || e.pointerId !== arr.id) return;
    const { g, i } = arr;
    if (Math.hypot(e.clientX - arr.x0, e.clientY - arr.y0) > 5) arr.movio = true;
    if (!arr.movio) return;
    const [x, y] = limitar(g, (e.clientX - arr.dx - g.r.left) / g.W, (e.clientY - arr.dy - g.r.top) / g.H);
    D.pos[i] = { ...D.pos[i], x, y };
    const b = el.dados[i]; b.style.left = pct(x); b.style.top = pct(y);
    el.cubo.classList.toggle("abierto", vActual.puedoTirar && sobreCubo(x * g.W, y * g.H, g));
  }
  function onUp(e) {
    if (!arr || e.pointerId !== arr.id) return;
    const { g, i, movio } = arr; arr = null;
    const b = el.dados[i]; b.classList.remove("agarrado"); el.cubo.classList.remove("abierto");
    if (!movio) { b.classList.remove("mueve"); void b.offsetWidth; b.classList.add("mueve"); if (vActual.puedoTirar) pActual?.aviso("Arrastralo al cubilete para volver a tirarlo"); return; }
    const p = D.pos[i];
    if (vActual.puedoTirar && sobreCubo(p.x * g.W, p.y * g.H, g)) meter(i);
  }
  async function meter(i) {
    sonido.play("tic");
    await alCubo(i);
    pintarCubo(); if (pActual) estado(vActual, pActual);
  }
  function onClick(e) {
    const v = vActual;
    if (e.target.closest(".no-tachar")) { tachar = null; repintar(); return; }
    if (e.target.closest(".si-tachar")) { const cat = tachar; tachar = null; mandar({ t: "anotar", cat }, e.target.closest("button")); return; }
    const dd = e.target.closest(".gx-dado");
    if (dd) { if (e.detail === 0 && !dd.disabled && v.puedoTirar) meter(Number(dd.dataset.i)); return; }   // con el teclado: Enter lo mete al cubilete
    const cubo = e.target.closest(".gx-cubo");
    if (cubo) {
      if (cubo.disabled || !v.puedoTirar) return;
      if (v.tiro === 0) { cortar(); juntarTodos(false); }
      const guardar = D.cubo.map((x, i) => (x ? -1 : i)).filter((i) => i >= 0);
      if (guardar.length === DADOS) { pActual?.aviso("Arrastrá al cubilete los dados que querés volver a tirar"); return; }
      tachar = null; mandar({ t: "tirar", guardar }, null);
      return;
    }
    const a = e.target.closest(".gx-anotar");
    if (a && v.puedoAnotar) {
      const cat = a.dataset.cat;
      if (a.classList.contains("cero")) { tachar = cat; repintar(); return; }
      tachar = null; mandar({ t: "anotar", cat }, a);
    }
  }
  const onResize = () => colocar();
  cont.addEventListener("pointerdown", onDown);
  cont.addEventListener("pointermove", onMove);
  cont.addEventListener("pointerup", onUp);
  cont.addEventListener("pointercancel", onUp);
  cont.addEventListener("click", onClick);
  addEventListener("resize", onResize);
  // solo para las pruebas: dónde está cada dado
  window.__dadosGenerala = () => ({ cubo: [...D.cubo], pos: D.pos.map((p) => (p ? { ...p } : null)), val: [...D.val], animando: anims.size + (ocupado ? 1 : 0) });
  return () => {
    cont.removeEventListener("pointerdown", onDown); cont.removeEventListener("pointermove", onMove); cont.removeEventListener("pointerup", onUp);
    cont.removeEventListener("pointercancel", onUp); cont.removeEventListener("click", onClick); removeEventListener("resize", onResize);
    obs.disconnect(); clearTimeout(tRecien); clearTimeout(tJuntar); cortar(); delete window.__dadosGenerala; desmontar();
  };
}
