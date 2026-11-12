---
title: 'Etapa 1e: el esqueleto de la red'
description: 'Todos los juegos juegan ahora a través de un servidor, aunque se juegue solo: cada página simula su propia copia y la compara con la del servidor cada segundo. Y dos pestañas pueden jugar la misma partida, cada una con su personaje.'
sidebar:
  order: 12
---

> Informe de la etapa 1e. La decisión 0000 pidió la red temprano, en la fase 1, "aunque la red completa venga después": en V1 la red llegó en el paso 8 y obligó a rehacer casi todo. Esta etapa no trae todavía partidas por internet. Trae algo previo: que todo pase por el camino de la red desde ahora.

## Cómo funciona

- **El servidor guarda LA partida.** Recibe lo que pide cada jugador y los cambios que se escriben en las consolas, decide en qué paso entra cada cosa, y en cada paso le dice a todos qué entró (un _tick_). Cada 60 pasos, un segundo, agrega la huella de su mundo.
- **Cada página simula su propia copia** con exactamente eso. Como el mundo es determinista, la copia es el mismo mundo. Cada segundo, la página compara su huella con la del servidor: si no coincide, es una **desincronización** (_desync_), y la consola dice en qué paso. Una diferencia así es un error, no demora: la demora hace que algo llegue tarde, no que dé otra cosa.
- **Aunque juegues solo, hay servidor:** vive en la misma página. Lo que pide tu personaje viaja hasta él como un mensaje, y vuelve en un tick. Así, cualquier partida, también la de una sola persona, comprueba el determinismo mientras se juega.
- **Quién entra y quién sale es un dato del mundo:** el servidor lo dice con `players.join` y `players.leave`, en un paso concreto, y queda en la repetición. El juego decide qué significa. En la sala `course`, cada jugador que entra recibe un personaje propio, al lado del primero.
- **Quién puede cambiar el mundo lo decide el juego** (`mayChange`). Sin decirlo, solo el jugador 1, el que abrió la partida. El Dojo, que es un laboratorio, deja a todos. Y al servidor solo llegan cambios del mundo: los de la vista nunca salen de la página.
- **Entrar a una partida empezada:** el que entra recibe la instantánea de la 1d y además la historia desde el nacimiento. Así, su repetición también empieza en el nacimiento.
- **Volver a una instantánea, reiniciar o reproducir una repetición** son ahora cosas del servidor: todos los que están en la partida vuelven, reinician o miran.
- **Dos pestañas, una partida.** Para probarlo sin un servidor propio, las pestañas del mismo navegador se hablan con un `BroadcastChannel`. Una abre su partida (`net open`) y la otra se une (`net join`). Lo que viaja entre ellas es exactamente lo que va a viajar después por internet.

## Hallazgos

| Hallazgo                                            | Qué pasaba                                                                                                                                                                                                                                               | Qué hicimos                                                                                                                                                          |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Las pruebas viejas no lo notaron, y era la idea** | Cambió por dentro cómo juega cada página, y de las 53 pruebas de navegador falló una sola: la que compara la huella del navegador con la de Node. En el navegador, ahora el servidor anuncia al jugador en el primer paso                                | La prueba de Node hace lo mismo que el servidor: `players.join 1` en el primer paso. Las demás (repeticiones, fantasmas, instantáneas, cámaras) pasaron sin tocarlas |
| **Una repetición no tiene que recibir jugadores**   | Cuando el servidor reproduce una repetición, los que están conectados no tienen que entrar a ese mundo: le agregarían un `players.join` que la repetición no tiene, y daría otra huella. La primera versión del servidor lo hacía en el orden equivocado | Primero se marca que se está reproduciendo, y después se da la bienvenida. Una prueba lo cuida, y falla si se invierte el orden                                      |
| **Forzar una desincronización tiene su truco**      | Para probar que se detecta, la prueba movía una caja en una sola copia. No pasaba nada: la posición de una caja se vuelve a leer de la física en cada paso, y el cambio se perdía                                                                        | La prueba le hace sacar un número de azar de más a una copia: eso sí queda, y la desincronización aparece en la comprobación siguiente, en el paso justo             |
| **El número de jugador llega con la bienvenida**    | La pestaña que se unía decía "sos el jugador 1": lo escribía antes de que llegara la respuesta del servidor, que entre pestañas tarda un poco                                                                                                            | Lo dice cuando llega la bienvenida                                                                                                                                   |

## Medido

- **El costo de jugar a través del servidor** (en Node, en la Mac de desarrollo, `course` con 12 cubos): 0,72 ms por paso, contra 0,45 ms con un solo mundo. Son dos mundos, el del servidor y la copia de la página, por unas 1,6 veces el costo. Sobra margen: un paso dura 16,7 ms.
- **Lo que viaja:**
  - un tick pesa entre 51 y 72 caracteres, unos 3 KB por segundo;
  - la bienvenida a una partida empezada (en el paso 800) pesa unos 96 KB como texto. Como bytes, la parte de la física sería menos de la mitad.
- **Las pruebas:**
  - sin pantalla, 105 (8 nuevas: jugar solo a través del servidor, dos jugadores con demora, entrar a una partida empezada, quién puede cambiar el mundo, una desincronización detectada, salir de la partida, instantáneas y repeticiones a través del servidor, y los personajes de quienes entran al Dojo);
  - en el navegador, 64: 54 en Chromium (una nueva: dos pestañas, una partida) y las 5 de física en Firefox y en WebKit.
- **Las comprobaciones de mutación:** falla la prueba que corresponde si el cliente pierde una entrada (lo detecta la comparación de huellas), si al salir no hay `players.leave`, si cualquiera puede cambiar el mundo, si cualquier línea llega al servidor, o si una repetición recibe jugadores.

## Lo que falta, a propósito

- **Internet.** Entre pestañas no hace falta un servidor propio; entre dos casas, sí. Dónde va a vivir sigue abierto.
- **La predicción.** Hoy tu personaje espera la vuelta del servidor: en la misma página es instantáneo, pero con demora real se notaría. En la fase 6, el personaje propio se va a mover sin esperar, y se corrige cuando llega lo que dice el servidor (lo explicamos en el análisis de la hoja de ruta).
- **Suavizar lo que llega a saltos.** La pestaña que se une dibuja el último paso que recibió, sin interpolar: con demora real, eso también va en la fase 6.

## Lo que sigue

La etapa 1f, el cierre de la fase 1:

- una regla del linter contra la trigonometría en el núcleo;
- las vistas de física que faltan;
- las lecciones de la fase.
