---
title: 'Etapa 2b: los modos de moverse'
description: 'El personaje se mueve ahora en modos (caminar, en el aire), uno por vez, con sus números como datos de cada juego, y aportes que se suman sea cual sea el modo. El control en el aire, que estaba fijo en el código, se cambia desde la consola.'
sidebar:
  order: 15
---

> Informe de la etapa 2b. Sale de una observación sobre el Dojo: el personaje se puede seguir moviendo en el aire, aunque no haya contra qué empujar. Era a propósito, pero estaba fijo en el código. Ahora es un dato de cada juego, y el personaje queda ordenado en **modos**: es lo que la etapa 2c necesita para sumar trepar, agarrarse o planear.

## Qué hicimos

- **El protocolo de composición** que pidió la decisión 0000: un solo modo de moverse por vez, más aportes que se suman, todo resuelto en un mismo lugar. En cada paso del personaje:
  1. se decide **el modo**, en un solo lugar: parado sobre algo, camina; si no, está en el aire. La 2c va a sumar sus capacidades justo ahí;
  2. el modo decide cómo va la velocidad sobre el piso hacia lo que pide el jugador. Caminando, rápido, porque los pies empujan contra el piso. En el aire, con lo que el juego permita corregir;
  3. el salto lo manda al aire;
  4. **los aportes**, sea cual sea el modo: la gravedad, que cambia la velocidad, y lo que **arrastra** al personaje (`carry`). Eso último lo pone el juego en cada paso que corresponda: un viento, una cinta, y en la 2d la plataforma en la que está parado. Lo mueve ese paso, y no queda en su velocidad;
  5. el controlador dice cuánto se puede mover de verdad.
- **Los números de cada modo son datos** (`movement`):
  - caminar: la velocidad, la de correr y la aceleración;
  - en el aire: el control;
  - el salto: su velocidad, el tiempo de coyote y cuántos pasos se guarda;
  - el giro.

  Un juego los decide al crear su personaje, y como son datos, entran en la huella, en las instantáneas y en las repeticiones. Los de siempre (`DEFAULT_MOVEMENT`) son los de un juego de plataformas.

- **`dojo.air` en la consola:** cuánto se puede corregir un salto en el aire, para todos los personajes, desde un paso. Con 14, el de siempre; con 0, nada, como en la física real (el arco del salto queda fijo); con 50, tanto como en el piso. Quien entra a la partida se mueve igual que el primero.
- **`inspect` muestra el modo** y los números de cada personaje.

## Hallazgos

| Hallazgo                                     | Qué pasaba                                                                                                                                                          | Qué hicimos                                                                                                                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ordenar sin cambiar nada**                 | Reorganizar el personaje en modos podía cambiar cómo se mueve, y con eso cada salto del recorrido                                                                   | Con los números de siempre, las 108 pruebas que ya existían pasaron sin tocarlas: el personaje se mueve exactamente igual. Lo nuevo es dónde está cada cosa, y que los números son datos |
| **Arrastrar no es empujar**                  | Un viento o una plataforma que mueve al personaje no tienen que quedar en su velocidad: al salir del viento, se detendría de a poco, como si hubiera tomado impulso | Lo que arrastra se suma solo al movimiento de ese paso. Una prueba lo comprueba: medio segundo a 2 m/s lo mueve un metro, y su velocidad sigue en 0                                      |
| **Física real contra lo que se siente bien** | Sin control en el aire (`dojo.air 0`), el salto es el de la física, y se siente rígido. Con mucho, el personaje "vuela"                                             | Es una elección de cada juego, no del motor: el de plataformas, generoso; el shooter, poco. El motor solo cuida que sea un dato                                                          |

## Medido

- **Las pruebas:**
  - sin pantalla, 124 (5 nuevas: los modos en cada paso, el control en el aire como dato (0, 14 y 50), lo que arrastra, el movimiento pedido a medias, y `dojo.air` con quien entra y su repetición);
  - en el navegador, 79, sin cambios.
- **Las comprobaciones de mutación:** falla la prueba que corresponde si el aire ignora su control, si lo que arrastra no se vacía después del paso, si el personaje siempre camina, o si quien entra no copia el movimiento del primero.

## Lo que sigue

La etapa 2c: **las capacidades**. Trepar, agarrarse de un borde, planear… como piezas que entran en ese mismo lugar donde se decide el modo, y que se prenden y apagan en vivo.
