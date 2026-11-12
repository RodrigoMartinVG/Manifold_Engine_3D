---
title: 'Etapa 0e: el código, en inglés'
description: 'Todo el proyecto pasa al inglés, salvo los textos del sitio: el código, la consola, las pruebas, las decisiones y los commits. Qué cambió de nombre, qué encontramos y cómo se comprobó que nada se rompió.'
sidebar:
  order: 4
---

> Informe de la etapa 0e. La regla, con su porqué y sus alternativas, está en la [decisión 0011](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0011-languages.md) (como todas las decisiones, ahora en inglés).

## Qué hicimos

Hasta aquí todo estaba en español: el código, los nombres de los archivos, la consola del Dojo, las pruebas, las decisiones y los commits. Funcionaba, pero las librerías hablan inglés, así que cada línea quedaba mitad y mitad (`escena.add(sol)`, `crearEscena()`, `renderer.setSize(...)`), y compartir el proyecto obligaba a leer español. La consola tenía además un problema propio: traducir sus nombres es como traducir `if` por `si`.

Como todavía nadie usa nada de esto, se cambió **todo de una vez, sin dejar nada viejo andando**:

| Queda en español                                                                                     | Pasa al inglés                                                                           |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| El tutorial, la Bitácora y las páginas del sitio                                                     | El código y sus comentarios: el motor, el Dojo, el sitio y las lecciones                 |
| Lo que el sitio le dice al lector: "Ejecutar", "Ocultar", "Pantalla completa", "(main.ts, línea 12)" | Los nombres de carpetas, archivos y paquetes                                             |
| Las direcciones del sitio: `/tutorial/etapa-0/…`, `/jugar/dojo/`                                     | La consola: sus nombres, su ayuda y sus mensajes. Las recetas y las salas                |
|                                                                                                      | Las lecciones: los nombres, los comentarios, los paneles y lo que escriben en la consola |
|                                                                                                      | Las pruebas, las decisiones, el README, los commits y las etiquetas                      |

Y para que el inglés no sea una barrera en el tutorial:

- **La primera vez que aparece un término, va con su nombre en inglés al lado:** una malla (_mesh_), un cuadro (_frame_), una semilla (_seed_). Las seis lecciones se repasaron con esa regla, y sus referencias al código usan los nombres nuevos.
- **Un [glosario](../../tutorial/glosario/)** junta cada término con su nombre en inglés y con el que se usa en el código y en la consola, más la lista completa de los nombres de la consola.
- **La introducción del tutorial** explica por qué el código está en inglés, y la página del [proyecto](../../proyecto/) cuenta la regla de los idiomas.

### Los nombres que cambiaron

Lo principal (el resto sigue la misma idea):

| Antes                                                  | Ahora                                                   |
| ------------------------------------------------------ | ------------------------------------------------------- |
| `paquetes/comun`, `nucleo`, `comandos`, `presentacion` | `packages/common`, `core`, `commands`, `presentation`   |
| `juegos/dojo`, sus `recetas/` (`lluvia.txt`…)          | `games/dojo`, sus `recipes/` (`rain.txt`…)              |
| `sitio`, `sitio/src/lecciones/etapa-0`                 | `site`, `site/src/lessons/stage-0`                      |
| `docs/decisiones`                                      | `docs/decisions`                                        |
| `*.prueba.ts`                                          | `*.test.ts`                                             |
| `Mundo`, `Partida`, `Cartucho`, `Reloj`, `huella()`    | `World`, `Session`, `Cartridge`, `Clock`, `stateHash()` |
| `<CodigoVivo leccion="…" autoejecutar />`              | `<LiveCode lesson="…" autorun />`                       |
| `npm run verificar`, `pruebas`, `dibujar`              | `npm run verify`, `test`, `draw`                        |
| la etiqueta `paso-00`                                  | `stage-00`                                              |

Y la consola del Dojo:

| Antes                                                   | Ahora                                                            |
| ------------------------------------------------------- | ---------------------------------------------------------------- |
| `semilla`, `dojo.cubos`, `dojo.giro`, `dojo.crear`      | `seed`, `dojo.cubes`, `dojo.spin`, `dojo.spawn`                  |
| `ver.triangulos`, `ver.ejes`, `ver.estadisticas`        | `show.wireframe`, `show.axes`, `show.stats`                      |
| `vista.lento`, `vista.pausa`                            | `view.timescale`, `view.paused`                                  |
| `reiniciar`, `pausa`, `paso`, `huella`                  | `restart`, `pause`, `step`, `hash`                               |
| `ayuda`, `buscar`, `variables`, `cambiadas`, `alternar` | `help`, `find`, `vars`, `changed`, `toggle`                      |
| `exportar`, `cargar`, `inicio guardar`, `atajo`         | `export`, `load`, `startup save`, `bind`                         |
| `si` / `no`                                             | `on` / `off` (también valen `1`/`0`, `yes`/`no`, `true`/`false`) |
| `#receta=dojo.cubos+20`                                 | `#recipe=dojo.cubes+20`                                          |
| las salas `lluvia`, `en-alambre`, `camara-lenta`        | `rain`, `wireframe`, `slow-motion`                               |

**Lo que se fue, sin reemplazo:** la dirección vieja del Dojo (`?cubos=20&semilla=3`), que se traducía a receta, y los alias de la consola. Las salas tienen un solo título, en inglés, como todo lo de la consola.

**Lo que no cambió:** la historia. Los informes anteriores de esta Bitácora cuentan el código con los nombres de su momento, y la etiqueta `paso-00` sigue apuntando al código en español. Las lecciones enlazan a `stage-00`, la misma etapa ya en inglés.

## Hallazgos

| Hallazgo                                                        | Qué pasaba                                                                                                                                                         | Arreglo                                                                                                                                                            |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Una lección todavía usaba la dirección vieja del Dojo**       | "Azar con semilla" proponía probar `?cubos=30&semilla=2`, que ya no hacía nada desde la etapa 0d. Apareció al repasar cada referencia al código                    | Ahora enlaza a un Dojo con una receta adentro, y propone escribir `seed 2` en la consola                                                                           |
| **Un nombre en inglés tapaba otro del navegador**               | En la consola, la lista de lo escrito pasó a llamarse `history`, el mismo nombre que `window.history`, que la consola usa para limpiar la dirección                | Se llama `typed`, y la dirección se limpia con `window.history`, explícito                                                                                         |
| **Letras con tilde escritas tal cual en una expresión regular** | `find` ignora las tildes quitando sus marcas (el rango Unicode de las tildes sueltas). Escritas como caracteres, eran invisibles en el editor y frágiles al copiar | Se escriben con su código (`̀-ͯ`)                                                                                                                                    |
| **El glosario no es una lección**                               | La prueba del tutorial exige que cada página tenga al menos un ejemplo ("una lección sin código no es una lección"). El glosario no tiene, a propósito             | Una lista explícita de las páginas que no son lecciones, y una prueba que comprueba que el glosario sigue sin ejemplos. Con un ejemplo agregado a propósito, falla |
| **Los dibujos se regeneraron con el script en inglés**          | `draw.mjs` cambió todos sus nombres. Si una cuenta hubiera cambiado sin querer, el fondo o los engranajes se verían distintos                                      | Se compararon los SVG nuevos con los viejos: solo cambian los comentarios y los nombres internos de los filtros. La geometría es idéntica                          |
| **Mover carpetas con el servidor de desarrollo prendido**       | El servidor de `npm run dev` seguía mirando `sitio/`, que ya no existía, y volvía a crear ahí sus cachés                                                           | Hay que reiniciarlo después de un cambio así, y borrar la carpeta `sitio/` que queda (solo tiene cachés)                                                           |

## Medido

- **Las pruebas:** 54 sin pantalla y 22 en Chromium, todas en verde con los nombres nuevos.
  - Sin pantalla hay una menos: la de los alias de la consola, que ya no existen.
  - En Chromium hay una más: la del glosario. La prueba de la dirección vieja del Dojo se convirtió en la de un enlace con receta (`#recipe=dojo.cubes+20;seed+3`, 21 mallas).
- **Las pruebas nuevas se rompieron a propósito una vez:** el título de una receta, el nombre de una sala (en mayúsculas, falla), una sala sin título y el glosario con un ejemplo. Las cuatro fallan como tienen que fallar.
- **El tamaño del cambio:** 117 archivos movidos o renombrados, y casi todo su contenido traducido. Van en dos commits: primero solo los cambios de nombre, sin tocar el contenido, para que git siga reconociendo cada archivo y su historia (`git log --follow`); después, el contenido.
