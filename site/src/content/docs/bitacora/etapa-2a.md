---
title: 'Etapa 2a: niveles como datos, y zonas'
description: 'La fase 2 empieza: el recorrido del Dojo deja de estar escrito en el código y pasa a ser un archivo de nivel, con zonas que notan quién entra. Un punto de control, el vacío que te devuelve y una meta con su tiempo. Y un seno y un coseno propios.'
sidebar:
  order: 14
---

> Informe de la etapa 2a, la primera de la fase 2. La regla 4 de la decisión 0000 dice "los niveles son datos" desde el día 0, y el recorrido de la etapa 1b estaba escrito en TypeScript. Ahora es texto, y tiene lo que hace que un nivel sea un nivel: dónde volvés si te caés, y dónde termina.

## Qué hicimos

- **Un formato de nivel propio**, de texto, una cosa por línea, con su versión en la primera:

  ```
  # Manifold level 1
  title The course
  spawn 0 1 6
  box -4 0.62 1.5  1 0.1 2.2  rotate x 18  color #6f6a62
  sensor goal  -3 4.4 -7  1 0.8 1
  ```

  Se lee, se compara y se escribe a mano. Elegimos un formato propio y no Blender: más adelante, un importador de Blender o un editor van a escribir este mismo texto, y el motor no va a depender de la herramienta. Un error dice en qué línea está y por qué.

- **El recorrido es ahora un archivo** (`games/dojo/levels/course.level`). `dojo.level` ofrece los niveles que haya en esa carpeta: sumar uno es sumar un archivo.
- **Zonas** (_sensors_): cajas que no empujan, solo notan quién entra y quién sale. En cada paso, el mundo mira qué cuerpos que se mueven tienen su centro adentro, y lo avisa como eventos. Son cuentas simples, sin Rapier, en los ejes de la propia zona, así que una zona girada también funciona. Qué significa cada zona lo decide el juego: el motor ni lee su nombre.
- **El ciclo de un nivel, en el Dojo:**
  - un **punto de control** en la primera plataforma;
  - el **vacío** debajo del piso, que te devuelve al último punto de control. Un cubo o una pelota que cae ahí desaparece;
  - la **meta** en la plataforma más alta, que dice el tiempo y cuántas veces te caíste.

  Todo eso se guarda como datos del juego en el personaje (un componente nuevo, `game`), así que entra en la huella, en las instantáneas y en las repeticiones.

- **Avisos en pantalla:** el juego avisa ("checkpoint", "the goal: 23.45 s, 1 fall") y la página lo muestra unos segundos arriba, y en la consola. A cada jugador, los suyos.
- **`show.sensors`** dibuja las zonas como cajas de alambre: los puntos de control en verde, la meta en dorado y el vacío en rojo.
- **Un seno y un coseno propios**, en grados (`sinCosDegrees`), hechos solo con sumas, productos y divisiones. Los usa el nivel para que "rotate x 18" dé el mismo cuaternión en todos los navegadores. Antes, la rampa tenía los números escritos a mano justamente para no usar `Math.sin`.

## Hallazgos

| Hallazgo                                         | Qué pasaba                                                                                                                                                                                                         | Qué hicimos                                                                                                                                      |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **El color no es un comentario**                 | La primera versión borraba todo lo que venía después de un `#`, como hacen muchos formatos. Pero los colores se escriben `#6f6a62`: se los iba a comer. Lo vi antes de probarlo                                    | Un comentario es una línea entera que empieza con `#`, como en las recetas                                                                       |
| **El seno propio, más exacto que la referencia** | La prueba comparaba con `Math.sin` y daba una diferencia de 2,5e-15 en los ángulos grandes. La culpa era de la referencia: calcular `d · π / 180` con un `d` grande ya pierde un poco antes de llamar a `Math.sin` | El nuestro saca primero los cuartos de vuelta, en grados, donde es exacto. La prueba lo explica, y acepta 4e-15                                  |
| **Los cuartos de vuelta, exactos y sin −0**      | `cos 90°` tiene que dar 0, y no un número chiquito ni −0, que tiene otros bits                                                                                                                                     | Para cambiar de signo usa `0 − x`, que deja el 0 como +0. Una prueba revisa 0°, 90°, 180°, 270°, −90° y 360°, bit por bit                        |
| **Un título de prueba que prometía de más**      | La prueba del ciclo del nivel decía "y su repetición da igual", pero no lo comprobaba: mueve al personaje a mano, y eso no queda en ninguna historia                                                               | El título dice lo que hace, y otra prueba maneja al personaje con sus entradas hasta caerse del piso, vuelve, y su repetición da la misma huella |

Y tres más, que encontraron las pruebas de navegador:

- **Una tecla rápida se perdía, desde la etapa 1b.** Si apretabas y soltabas Espacio dentro de un mismo cuadro en el que el mundo no avanzaba un paso, la suelta reemplazaba a la apretada antes de que entrara, y el salto no pasaba. Las pruebas casi nunca lo veían, porque sin placa de video casi todos los cuadros tienen al menos un paso. Ahora, si reemplazar haría perder una apretada que todavía no entró, la suelta espera su turno: un paso con la tecla apretada, y el siguiente sin ella. Los cambios sin botones en el medio se siguen juntando en uno solo, para que no se forme una fila. Una prueba lo comprueba, y sin el arreglo falla.
- **`show.sensors` en un enlace rompía la página.** Una receta se aplica antes de que exista el mundo, y lo que usa esa vista estaba declarado más abajo en el código. Es la misma trampa que tuvo `view.camera` en la etapa 1c. Lo encontró la prueba nueva, que abre el recorrido con `#recipe=show.sensors+on`.
- **Los niveles, en Node.** La lista de niveles se arma con `import.meta.glob`, que es de Vite. Las pruebas de navegador cargan las reglas del Dojo en Node, para reproducir ahí las partidas, y en Node eso no existe. Ahora las reglas reciben sus niveles: la página y las pruebas sin pantalla se los dan con Vite, y las pruebas de navegador los leen del disco, como algún día lo hará un servidor.

## Medido

- **Las pruebas:**
  - sin pantalla, 119 (12 nuevas: la tecla rápida que no se pierde, el seno y el coseno, el formato de nivel y sus errores, el nivel construido, las zonas, una zona girada, poner un cuerpo en otro lugar, el ciclo del recorrido y una caída manejada que se repite igual);
  - en el navegador, 79: 67 en Chromium (una nueva: caerse del piso y volver, con el aviso, y las zonas vistas desde un enlace) y las 6 de física en Firefox y en WebKit.
- **Las comprobaciones de mutación:** falla la prueba que corresponde con una zona que ignora su giro, con una caída que no devuelve al personaje, con un nivel que no aplica sus giros, con un cuarto de vuelta mal cambiado en el seno, o si una suelta reemplaza a una apretada que no entró.

## Lo que sigue

La etapa 2b: el protocolo de composición. Los modos de moverse (caminar, en el aire, trepar…), cada uno con sus números. El control en el aire, que hoy está fijo en el código, pasa a ser un dato de cada juego.
