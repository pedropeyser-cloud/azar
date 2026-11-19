// Pantallas de la GENERALA: menú (con la planilla), sala de espera y entrada por link, con el flujo común de a varios.
import { crearFlujo } from "../../nucleo/flujo-n.js";
import { generala } from "./index.js";
import { montarMesa } from "./mesa.js";

const f = crearFlujo({
  A: generala, montarMesa, clase: "generala",
  titulo: "Generala",
  lema: "Cinco dados, tres tiros por turno. Apartá los que te sirven y volvé a tirar el resto. La generala servida gana en el acto.",
  notaBot: { tranquilo: "junta el número que más tiene", rapido: "calcula a ojo y se apura", implacable: "hace la cuenta de cada tiro" },
  elecciones: [{
    clave: "planilla", etiqueta: "planilla", def: "auto",
    valores: [["auto", "Según la mesa", "completa de a 2 o 3, corta de a 4 o más"], ["completa", "Completa", "11 casilleros"], ["corta", "Corta", "7 casilleros: 4, 5, 6 y los juegos"]],
  }],
  // pruebas: ?planilla=corta|completa fuerza la planilla
  opciones: () => { const p = new URLSearchParams(location.search).get("planilla"); return ["corta", "completa"].includes(p) ? { planilla: p } : {}; },
  reglas: `<ul>
    <li>En tu turno tocás el cubilete para tirar los 5 dados. Podés tirar hasta 3 veces: tocá los dados que querés guardar y volvé a tocar el cubilete para tirar el resto.</li>
    <li>Cuando terminás, anotás en un casillero libre de tu planilla. Si no te da nada, lo tachás (vale 0). Todos los casilleros se llenan una sola vez.</li>
    <li><b>Al 1 … al 6:</b> la suma de los dados de ese número.</li>
    <li><b>Escalera</b> (1-2-3-4-5, 2-3-4-5-6 o 3-4-5-6-1) 20 · <b>full</b> (tres y dos iguales) 30 · <b>póker</b> (cuatro iguales) 40. Si salen en el primer tiro son <b>servidos</b> y valen 5 más.</li>
    <li><b>Generala</b> (cinco iguales) 50. <b>Doble generala</b> 100, solo si ya anotaste la generala.</li>
    <li><b>Generala servida</b> (cinco iguales en el primer tiro): ganás la partida en el acto.</li>
    <li>Planilla <b>corta</b> (para mesas grandes, que no se haga eterna): solo 4, 5, 6, escalera, full, póker y generala.</li>
    <li>Cuando todos llenaron la planilla, gana el que más sumó.</li>
  </ul>`,
});
export const { menu, entrar, cerrar, contraBots } = f;
