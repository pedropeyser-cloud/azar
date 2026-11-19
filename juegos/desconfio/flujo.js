// Pantallas del DESCONFÍO: menú, sala de espera y entrada por link, con el flujo común de a varios.
import { crearFlujo } from "../../nucleo/flujo-n.js";
import { desconfio } from "./index.js";
import { montarMesa } from "./mesa.js";

const f = crearFlujo({
  A: desconfio, montarMesa, clase: "desconfio",
  titulo: "Desconfío",
  lema: "Cinco dados bajo el cubilete. Apostá cuántos hay de un número entre todos; los ases valen por cualquiera. Si no le creés al de al lado, «¡Desconfío!».",
  notaBot: { tranquilo: "cuenta a ojo y apuesta despacio", rapido: "farolea y salta de más", implacable: "hace la cuenta de cada dado" },
  // pruebas: ?dados=2 acorta la partida
  opciones: () => { const d = Number(new URLSearchParams(location.search).get("dados")); return d >= 1 && d <= 5 ? { dados: d } : {}; },
  reglas: `<ul>
    <li>Cada uno arranca con 5 dados. En cada ronda todos sacuden el cubilete y miran solo los suyos.</li>
    <li>Se apuesta cuántos dados hay de un número entre <b>todos</b> los de la mesa: «cuatro cincos». Los <b>ases son comodines</b>: cuentan como cualquier número.</li>
    <li>El que sigue tiene que subir: más cantidad, o la misma cantidad con un número más alto. Para pasar a ases alcanza la mitad (redondeando para arriba); para salir de ases hace falta el doble más uno. No se abre con ases.</li>
    <li>En vez de subir podés cantar <b>¡Desconfío!</b>: se levantan los cubiletes. Si hay menos de lo apostado, pierde un dado el que apostó; si hay al menos eso, el que desconfió.</li>
    <li>O <b>¡Confío!</b>: decís que hay justo eso. Si acertás, recuperás un dado (hasta 5); si no, lo perdés vos.</li>
    <li>Abre la ronda siguiente el que perdió el dado (o el que acertó el «¡Confío!»).</li>
    <li><b>Obligada:</b> la primera vez que alguien queda con un solo dado, abre él, los ases no son comodines y nadie puede cambiar el número, solo subir la cantidad.</li>
    <li>El que se queda sin dados sale. Gana el último con dados.</li>
  </ul>`,
});
export const { menu, entrar, cerrar, contraBots } = f;
