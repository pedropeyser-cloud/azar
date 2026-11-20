// Catálogo de juegos de AZAR. Sumar un juego = agregar su carpeta en juegos/<id>/ y una fila acá (todo juego nuevo de
// AZAR vive dentro de la plataforma: decisión de Pedro, 2026-11-17).
// estado: "listo" (se juega en esta página) | "enlace" (tiene su propia página dentro de AZAR, como el truco) | "pronto".
// `abrir` trae las pantallas del juego recién cuando se lo toca (import dinámico): { menu(app, ctx), entrar(app, codigo, ctx), cerrar() }.
// `palo` es el signo de su baraja en el inicio; `lema` va debajo del nombre.
export const JUEGOS = [
  {
    id: "truco", nombre: "Truco", jugadores: [2, 6], cuantos: "de 2, 4 o 6", estado: "enlace", palo: "espada", lema: "con gloria y Tienda",
    descripcion: "El truco argentino con amigos: 1 contra 1 y mesas de 4 y 6 con señas.",
    url: "juegos/truco/",
  },
  {
    id: "chin", nombre: "Chin", jugadores: [2, 2], cuantos: "de 2", estado: "listo", palo: "oro", lema: "velocidad pura",
    descripcion: "Dos pilas, dos mazos, un solo grito. Gana el que más rápido canta.",
    abrir: () => import("../juegos/chin/flujo.js"),
  },
  {
    id: "escoba", nombre: "Escoba", jugadores: [2, 4], cuantos: "de 2 o 4", estado: "listo", palo: "copa", lema: "de 15, con soplo",
    descripcion: "Levantá cartas que sumen 15 con la tuya. Si dejás la mesa vacía, escoba.",
    abrir: () => import("../juegos/escoba/flujo.js"),
  },
  {
    id: "canasta", nombre: "Canasta", jugadores: [2, 2], cuantos: "de 2", estado: "listo", palo: "basto", lema: "a 5000 puntos",
    descripcion: "Juntá siete iguales y armá canastas. Con dos, te vas.",
    abrir: () => import("../juegos/canasta/flujo.js"),
  },
  {
    id: "siete", nombre: "Siete y medio", jugadores: [2, 6], cuantos: "de 2 a 6", estado: "listo", palo: "medio", lema: "con porotos",
    descripcion: "Pedí cartas hasta acercarte a siete y medio sin pasarte, contra la banca.",
    abrir: () => import("../juegos/siete/flujo.js"),
  },
  {
    id: "culo", nombre: "Culo sucio", jugadores: [2, 6], cuantos: "de 2 a 6", estado: "listo", palo: "culo", lema: "¡desconfío!",
    descripcion: "Tirá cartas boca abajo diciendo qué son. Si te mienten, desconfiá. El último con cartas pierde.",
    abrir: () => import("../juegos/culo/flujo.js"),
  },
  {
    id: "desconfio", nombre: "Desconfío", jugadores: [2, 6], cuantos: "de 2 a 6", estado: "listo", palo: "dado", lema: "cubilete y faroles",
    descripcion: "Cinco dados tapados por cabeza y una apuesta que sube. Los ases valen por cualquiera. Si no le creés, desconfiá.",
    abrir: () => import("../juegos/desconfio/flujo.js"),
  },
  {
    id: "generala", nombre: "Generala", jugadores: [2, 6], cuantos: "de 2 a 6", estado: "listo", palo: "planilla", lema: "tres tiros por turno",
    descripcion: "Cinco dados y tres tiros: escalera, full, póker y generala. La servida gana en el acto.",
    abrir: () => import("../juegos/generala/flujo.js"),
  },
  {
    id: "chinchon", nombre: "Chinchón", jugadores: [2, 6], cuantos: "de 2 a 6", estado: "listo", palo: "chinchon", lema: "cortá con 5",
    descripcion: "Levantá, tirá y armá juegos. Cortá con 5 o menos; siete seguidas del mismo palo ganan en el acto.",
    abrir: () => import("../juegos/chinchon/flujo.js"),
  },
];
export const juegoPorId = (id) => JUEGOS.find((j) => j.id === id) || null;
