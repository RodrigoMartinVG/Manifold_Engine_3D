---
title: 'Etapa 1a: el motor de física'
description: 'Rapier entra al motor, en su variante determinista y detrás de una frontera chica. El Dojo tiene física, y tres navegadores distintos dan la misma huella que Node.'
sidebar:
  order: 6
---

> Informe de la etapa 1a, la primera de la etapa 1. Antes de arrancarla se decidió qué juegos se van a hacer: primero tres clásicos que comparten un personaje, y después los raros ([decisión 0012](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0012-the-games.md), en inglés). Eso definió qué preparar desde ahora.

## Qué hicimos

- **Rapier entra al motor detrás de una frontera chica.** Un solo archivo del núcleo, `physics.ts`, importa Rapier; el resto del motor habla con él en sus propios tipos. Cada mundo tiene su física, como tiene su azar.
- **Se usa la variante determinista de Rapier** (`rapier3d-deterministic-compat`). Hace sus cuentas igual en cualquier máquina. Es lo que piden las repeticiones, los fantasmas por enlace y la red.
- **Una entidad tiene ahora un cuerpo (`body`), como datos:**
  - su tipo: dinámico (lo mueve la física), cinemático (lo mueve el juego, y empuja lo que toca) o fijo, como el piso;
  - su forma, su rebote, su rozamiento y su amortiguación;
  - sus velocidades, que se leen de Rapier después de cada paso y entran en la huella;
  - y el identificador de su cuerpo en Rapier, nunca el cuerpo ([decisión 0004](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0004-state-as-data.md)).
- **La gravedad es un campo, guardado como datos** (`{ kind: 'uniform', vector }`). Todo lo que necesite saber dónde es "abajo" va a preguntarle al campo, nunca va a suponer −y. Hoy hay un solo tipo de campo, el uniforme; los planetas de la etapa 7 van a sumar otros. Se cambia desde la consola con `physics.gravity`, y como cambia el mundo, entra en el paso siguiente y queda en la historia.
- **El orden de un paso:** primero lo que gira sin cuerpo; después Rapier avanza un paso (gravedad, choques, rebotes); al final, la pose y las velocidades de cada cuerpo pasan a sus componentes.
- **El Dojo tiene física:**
  - un piso fijo (sin malla: lo que se ve es la grilla);
  - el cubo grande, que ahora es cinemático y empuja lo que toca;
  - los cubos chicos de `dojo.cubes`, que caen y se apilan;
  - `dojo.spawn x y z`, que tira una pelota desde ese lugar;
  - una sala nueva, `moon`, con la gravedad de la Luna.
- **La consola suma `show.physics`:** dibuja lo que ve Rapier, los colisionadores de cada cuerpo, como líneas.
- **Rapier carga de manera asíncrona** (es WebAssembly): el Dojo espera a que esté listo antes de crear el mundo, y las pruebas lo cargan antes de empezar.

## Hallazgos

| Hallazgo                                                 | Qué pasaba                                                                                                                                                                                                                                               | Qué hicimos                                                                                                                                                                         |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Rapier cuenta con números de 32 bits**                 | Una prueba corría un cuerpo una milmillonésima de metro y esperaba que el mundo se separara. No se separó: cerca de los 3 m, un número de 32 bits no distingue posiciones a menos de unos 0,24 micrómetros. La diferencia desapareció al entrar a Rapier | La prueba quedó como documentación: una milmillonésima no existe para Rapier, y una centésima de milímetro separa los mundos desde el primer paso, y la huella lo detecta ahí mismo |
| **Una pelota rueda para siempre**                        | Rapier no tiene resistencia a la rodadura: una pelota en el piso seguía rodando hasta caerse por el borde                                                                                                                                                | Cada cuerpo tiene amortiguación (_damping_) como dato. Las pelotas del Dojo pierden su giro de a poco                                                                               |
| **Una pelota sobre el cubo que gira no se queda quieta** | La prueba de "todo termina quieto" tiraba la pelota justo encima del cubo grande, que la seguía arrastrando                                                                                                                                              | Era la física correcta: un cuerpo cinemático empuja. La prueba tira la pelota al costado                                                                                            |
| **La huella costaba más que la física**                  | Con 200 cubos, un paso de física tarda unos 0,6 ms, y la huella tardaba 5,5 ms: leía cada byte con una llamada y recorría cada nombre letra por letra                                                                                                    | Ahora lee los bytes de una vez y guarda el resultado de cada texto: 1,8 ms. Todavía es tres veces un paso; si las repeticiones necesitan la huella en cada paso, se revisa ahí      |
| **El giro del cubo grande pasó a Rapier**                | En la etapa 0, el motor giraba el cubo con su propia matemática (`Math.sin` y `Math.cos`), que no está garantizada igual en todos los navegadores                                                                                                        | Un cuerpo cinemático se mueve por velocidad: lo integra Rapier, con su matemática determinista. Y además empuja lo que toca                                                         |

## Medido

- **El mismo mundo en tres motores de JavaScript, la misma huella.** El Dojo con 40 cubos que caen sobre el piso y sobre el cubo que gira, en Chromium (V8), Firefox (SpiderMonkey) y WebKit (JavaScriptCore, el de Safari). Se pausa, se pide `hash` y se compara con el mismo mundo simulado en Node la misma cantidad de pasos. Dan igual en los tres.
  - Con otra semilla del lado de Node, la prueba falla: la comparación es real.
  - La integración continua la corre en Chromium. En Firefox y WebKit se corre en la computadora antes de subir, hasta comprobar que su WebGL anda en el Linux de GitHub.
  - No se midió si la variante común de Rapier también daría igual. Se eligió la determinista para no depender de eso.
- **Lo que cuesta, en la Mac de desarrollo** (la de la Iris Plus), con la sala de la lluvia de cubos:

| Cubos | Un paso, en promedio | Un paso, el 95 % más rápido | La huella |
| ----- | -------------------- | --------------------------- | --------- |
| 40    | 0,47 ms              | 0,85 ms                     | 0,4 ms    |
| 120   | 0,40 a 0,47 ms       | 1,1 ms                      | 1,2 ms    |
| 200   | 0,60 a 0,65 ms       | 1,8 ms                      | 1,8 ms    |

Un cuadro de pantalla dura 16,7 ms: sobra lugar. El primer mundo que se crea tiene un paso de unos 100 ms, mientras el navegador prepara el WebAssembly.

- **Las pruebas:**
  - sin pantalla, 64 (10 nuevas: 8 de la física y 2 del Dojo);
  - en el navegador, 43: 39 en Chromium (3 nuevas: las dos de física y la de la sala de la Luna) y las dos de física también en Firefox y WebKit.
  - Cinco protecciones se rompieron a propósito: que no se lea la física después del paso, que la gravedad quede fuera de la huella, que una entidad quitada deje su cuerpo, que el giro cinemático se ignore y que `physics.gravity` no haga nada. Cada una hizo fallar su prueba.

## Lo que sigue

La etapa 1b: el personaje. Uno que corre y salta en un nivel clásico, con su cámara; su "arriba" llega como dato, aunque por ahora sea siempre el mismo. Y la lección del tutorial sobre los motores de física, con Rapier en los ejemplos que se ejecutan en la página.
