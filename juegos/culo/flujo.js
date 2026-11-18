// Pantallas del CULO SUCIO: menú, sala de espera y entrada por link, con el flujo común de a varios.
import { crearFlujo } from "../../nucleo/flujo-n.js";
import { culo } from "./index.js";
import { montarMesa } from "./mesa.js";

const f = crearFlujo({
  A: culo, montarMesa, clase: "culo",
  titulo: "Culo sucio",
  lema: "Tirá cartas boca abajo diciendo qué son. Si te mienten, gritá «¡Desconfío!». El último con cartas es el culo sucio.",
  notaBot: { tranquilo: "casi no miente", rapido: "miente y desconfía a lo loco", implacable: "cuenta todas las cartas" },
  reglas: `<ul>
    <li>Mazo español de 40, todo repartido.</li>
    <li>El que abre elige un número y tira de 1 a 4 cartas boca abajo diciendo, por ejemplo, «dos sietes». Puede mentir: lo único seguro es cuántas tira.</li>
    <li>El que sigue <b>confía</b> y tira de 1 a 4 diciendo el mismo número (de verdad o mintiendo), o <b>desconfía</b>.</li>
    <li>Cualquiera puede gritar <b>¡Desconfío!</b> hasta que el siguiente tire. Se dan vuelta las últimas cartas: si alguna no era del número, el que mintió se lleva toda la pila; si eran todas, se la lleva el que desconfió. Abre la ronda nueva el que tenía razón.</li>
    <li>Si tirás tus últimas cartas, salís cuando el siguiente tira. Si te desconfían y mentías, te llevás la pila y seguís.</li>
    <li>El último que queda con cartas es el <b>culo sucio</b>.</li>
  </ul>`,
});
export const { menu, entrar, cerrar, contraBots } = f;
