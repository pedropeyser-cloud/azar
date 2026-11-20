// Pantallas del CHINCHÓN: menú, sala de espera y entrada por link, con el flujo común de a varios.
import { crearFlujo } from "../../nucleo/flujo-n.js";
import { chinchon } from "./index.js";
import { montarMesa } from "./mesa.js";

const f = crearFlujo({
  A: chinchon, montarMesa, clase: "chinchon",
  titulo: "Chinchón",
  lema: "Siete cartas, levantar y tirar. Armá juegos y cortá con 5 o menos sueltas. El que pasa de 100 se va; siete seguidas del mismo palo ganan en el acto.",
  notaBot: { tranquilo: "mira solo lo suyo y se distrae", rapido: "corta apenas puede", implacable: "cuenta las cartas del pozo y espera el menos diez" },
  // pruebas: ?pausa=ms acorta la espera del recuento y ?ritmo=0.2 apura a los bots
  opciones: () => {
    const q = new URLSearchParams(location.search), x = Number(q.get("pausa")), r = Number(q.get("ritmo"));
    return { ...(x > 0 ? { pausaRecuento: x, pausaReenganche: x * 2 } : {}), ...(r > 0 && r < 1 ? { ritmo: r } : {}) };
  },
  reglas: `<ul>
    <li>Mazo español de 48 con 2 comodines. Siete cartas a cada uno; una boca arriba empieza el pozo.</li>
    <li>En tu turno levantás una (del mazo o la de arriba del pozo) y tirás una al pozo. La que levantaste del pozo no la podés tirar en la misma vuelta.</li>
    <li><b>Juegos:</b> tres o cuatro del mismo número, o tres o más seguidas del mismo palo. El comodín reemplaza a cualquiera (uno por juego).</li>
    <li><b>Cortar:</b> en vez de tirar, cortás si lo que te queda suelto suma 5 o menos. Si no te queda nada suelto, <b>menos diez</b>.</li>
    <li>Al cortar, cada uno suma sus sueltas (el comodín suelto vale 25) y puede pegar cartas en los juegos del que cortó.</li>
    <li>El que pasa de <b>100</b> queda afuera. Una vez por partida se puede <b>reenganchar</b>: vuelve con los puntos del que más tiene.</li>
    <li><b>Chinchón:</b> siete seguidas del mismo palo, sin comodín, gana la partida en el acto.</li>
    <li>Gana el último que queda debajo de 100.</li>
  </ul>`,
});
export const { menu, entrar, cerrar, contraBots } = f;
