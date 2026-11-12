---
title: 'Etapa 1a, segunda parte: la consola y la cámara'
description: 'Antes del personaje, el Dojo se usó como alguien que llega por primera vez. Ahora tiene una cámara que se mueve, y una consola que muestra qué probar, se puede tocar y deja mirar adentro de la física.'
sidebar:
  order: 7
---

> Un paso corto entre la etapa 1a y la 1b. El personaje de la 1b se va a probar desde la consola y va a necesitar una cámara: convenía que las dos fueran cómodas antes.

## Qué hicimos

Se usó la consola del Dojo como alguien que llega por primera vez: `help`, `vars`, `find`, comandos sin sus argumentos, un error de tipeo, Tab. Andaba, pero tenía huecos: la cámara no se podía mover, `help` no daba ni un ejemplo para probar, y no había manera de mirar qué pasaba adentro de la física. Lo que cambió:

- **Una cámara libre.** Arrastrar gira alrededor de la escena, y la rueda (o pellizcar) acerca y aleja. `camera.reset` la devuelve a donde empezó. Es una opción de la presentación (`camera: 'orbit'`), propia de un laboratorio: cada juego va a traer la suya.
- **Un clic sobre un objeto lo inspecciona.** Abre la consola con `inspect <id>`: cada componente de la entidad, con sus números (dónde está, cómo se mueve, su cuerpo, su color). Se muestran todos los componentes que tenga, así que los que se sumen en el futuro aparecen solos. Sin número, `inspect` cuenta las entidades por tipo de cuerpo.
- **La consola se puede tocar.** Lo que escribe entre comillas invertidas (\`así\`) se dibuja como un botón, y un clic lo pone en la línea, listo para ejecutar con Enter o para cambiarlo. Así aparecen:
  - los ejemplos de `help`;
  - las salas de `load`;
  - las opciones de Tab, como líneas enteras;
  - las sugerencias, con la línea completa corregida: `shw.physics on` sugiere `show.physics on`.
- **`help` tiene ejemplos, y los da cada juego.** La ayuda es parte del motor y no sabe de ningún juego. Antes nombraba `dojo.cubes`, un nombre del Dojo dentro del paquete genérico. Ahora el Dojo pasa sus ejemplos al montar la consola.
- **`reset`** vuelve una variable a su valor de siempre (`reset dojo.cubes`), o todas, si se escribe solo. Cada valor entra como si se lo hubiera escrito: lo del mundo, en el paso siguiente, y si vuelven varios valores de arranque, el mundo reinicia una sola vez.
- **`vars` agrupa por alcance:** arranque, mundo y vista, que es la idea central de la consola, y marca lo cambiado con su valor de siempre.
- **Mensajes más claros:** `dojo.spawn x y z` en vez de `dojo.spawn place`, y sin paréntesis dentro de paréntesis.
- **`show.stats`** suma cuántos cuerpos hay y cuánto tarda el paso de física, en promedio, cada segundo.

## Hallazgos

| Hallazgo                                             | Qué pasaba                                                                                                                                                                                                                                                     | Qué hicimos                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`camera.reset` no volvía a donde empezó**          | La cámara frena de a poco al soltarla: le queda un resto de giro que se sigue aplicando. `reset()` de OrbitControls restaura la posición, pero no borra ese resto, y la cámara se volvía a ir. Lo encontró la prueba, que reinicia apenas termina de arrastrar | Antes de reiniciar, el resto se aplica de una vez y se descarta (sin amortiguación por un instante), y recién después se vuelve al principio. Primero se probó apagar la amortiguación durante el reinicio: no alcanzaba, porque así el resto se aplicaba entero justo después de volver |
| **Un clic para enfocar la página ahora inspecciona** | La prueba de los atajos hacía clic en el centro de la pantalla para que la página tuviera el foco. Ahí está el cubo grande: el clic abría la consola, y la tecla del atajo se escribía en ella                                                                 | La prueba hace clic en una esquina vacía. Un clic en el vacío no hace nada                                                                                                                                                                                                               |
| **La ayuda genérica nombraba un juego**              | El ejemplo de `help` (`dojo.cubes 20`) estaba escrito en el paquete de la consola, que no debería conocer ningún juego                                                                                                                                         | Los ejemplos los da el juego al montar la consola                                                                                                                                                                                                                                        |
| **Un argumento llamado "place"**                     | `dojo.spawn` pedía `place`, y el error decía "three numbers (x y z)" entre paréntesis                                                                                                                                                                          | El argumento se llama `x y z`, y el tipo dice "three numbers"                                                                                                                                                                                                                            |

## Medido

- **Las pruebas:** 67 sin pantalla (3 nuevas: los ejemplos de `help`, `vars` por alcance y `reset`) y 3 nuevas en Chromium:
  - un clic en un ejemplo de `help` lo pone en la línea, y Enter lo ejecuta; una sugerencia es un botón con la línea corregida;
  - la cámara gira al arrastrar y `camera.reset` la devuelve; un clic sobre el cubo lo inspecciona; `show.stats` muestra la física;
  - `reset` vuelve todo a su valor de siempre, y `vars` lo muestra por alcance.
- **Seis protecciones rotas a propósito**, y cada una hizo fallar su prueba: `reset` de a una línea por vez (el mundo reiniciaba dos veces), `vars` sin alcances, `help` sin los ejemplos, la sugerencia sin el resto de la línea, el texto de la consola sin botones y el clic que nunca inspecciona. La falla real de `camera.reset` sirvió de la séptima.

## Lo que sigue

La etapa 1b: el personaje y su cámara.
