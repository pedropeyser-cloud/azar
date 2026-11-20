// Pantallas del DESCONFÍO: menú, sala de espera y entrada por link, con el flujo común de a varios.
import { crearFlujo } from "../../nucleo/flujo-n.js";
import { desconfio } from "./index.js";
import { montarMesa } from "./mesa.js";

const f = crearFlujo({
  A: desconfio, montarMesa, clase: "desconfio",
  titulo: "Desconfío",
  lema: "Un cubilete que pasa de mano en mano. Cantá tu mano de póker, o mentí. Si no le creés al de al lado, «¡Desconfío!».",
  notaBot: { tranquilo: "cree lo que sale seguido y miente lo justo", rapido: "farolea y desconfía de olfato", implacable: "cuenta cada dado que volviste a tirar" },
  // pruebas: ?vidas=1 acorta la partida y ?abre=0 hace que abra el primero (vos, contra los bots)
  opciones: () => {
    const q = new URLSearchParams(location.search), k = Number(q.get("vidas")), a = q.get("abre");
    return { ...(k >= 1 && k <= 3 ? { vidas: k } : {}), ...(a !== null && /^[0-5]$/.test(a) ? { abre: Number(a) } : {}) };
  },
  reglas: `<ul>
    <li>Hay un solo cubilete con cinco dados. El que lo tiene tira tapado, mira y <b>canta una mano</b>: la que tiene o una mentira. Se dice lo repetido y lo que sobra: «full de 3 con 2», «par de 6 con 543».</li>
    <li>Manos, de menor a mayor: número suelto, par, par doble, pierna, full, póker y generala. Sin escalera. El 1 es el más bajo y el 6 el más alto.</li>
    <li>El siguiente <b>le cree</b>: recibe el cubilete, mira los dados, puede volver a tirar los que quiera una vez y tiene que cantar algo más alto. O canta <b>¡Desconfío!</b> y se levanta el cubilete.</li>
    <li>Es verdad si lo que hay vale lo mismo o más que lo cantado. Si desconfiaste de una verdad, perdés una vida y tenés que superarla con esos dados.</li>
    <li>Si era mentira, el que mintió pierde una vida y queda afuera de la ronda; el que desconfió tira de cero.</li>
    <li>Cuando queda uno solo en la ronda, gana un punto y abre la siguiente. Cada uno tiene 3 vidas para toda la partida: gana el último con vidas.</li>
  </ul>`,
});
export const { menu, entrar, cerrar, contraBots } = f;
