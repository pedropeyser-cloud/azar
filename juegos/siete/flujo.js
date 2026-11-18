// Pantallas del SIETE Y MEDIO: menú, sala de espera y entrada por link, con el flujo común de a varios.
import { crearFlujo } from "../../nucleo/flujo-n.js";
import { siete } from "./index.js";
import { montarMesa } from "./mesa.js";

const f = crearFlujo({
  A: siete, montarMesa, clase: "siete",
  titulo: "Siete y medio",
  lema: "Pedí cartas hasta acercarte a siete y medio sin pasarte. Con porotos, contra la banca.",
  notaBot: { tranquilo: "apuesta poco, se planta temprano", rapido: "apuesta fuerte y pide de más", implacable: "cuenta las cartas" },
  // pruebas: ?porotos=4 acorta la partida
  opciones: () => { const p = Number(new URLSearchParams(location.search).get("porotos")); return p >= 2 && p <= 40 ? { porotos: p } : {}; },
  reglas: `<ul>
    <li>Mazo español de 40, sin 8 ni 9. Del 1 al 7 valen lo que dicen; la sota, el caballo y el rey, medio punto.</li>
    <li>Cada uno arranca con 20 porotos. La banca va rotando en cada mano.</li>
    <li>Te dan una carta tapada que solo ves vos. Mirándola, apostás de 1 a 5 porotos.</li>
    <li>En tu turno pedís <b>Carta</b> (boca arriba) o <b>Me planto</b>. Si pasás de siete y medio, te pasaste: mostrás la tapada y le pagás a la banca en el acto.</li>
    <li>Al final juega la banca. Si se pasa, les paga a todos los que siguen en pie.</li>
    <li>Si no, cada uno contra la banca: con más que ella, cobrás lo que apostaste; con lo mismo o menos, pagás. Los empates los gana la banca.</li>
    <li>Siete y medio de mano (un siete y una figura de entrada) cobra doble.</li>
    <li>Cuando alguien se queda sin porotos, termina la partida: gana el que más tiene.</li>
  </ul>`,
});
export const { menu, entrar, cerrar, contraBots } = f;
