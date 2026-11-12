---
title: 'Etapa 0d: la consola y las recetas'
description: 'El Dojo deja de configurarse con la dirección: un registro de variables y comandos, una consola como la de Quake, y recetas en texto plano. Cómo se armó y qué encontramos.'
sidebar:
  order: 3
---

> Informe de la etapa 0d. El diseño completo, con sus alternativas, está en la [decisión 0010](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisiones/0010-la-consola-y-las-recetas.md).

## Qué hicimos

Hasta aquí, el Dojo se configuraba con parámetros en la dirección (`?cubos=20&semilla=3`). No se descubría qué se podía cambiar, no había ayuda y había que recargar. Un panel con todas las opciones tampoco escala. Así que ahora cada parte **declara** lo que se puede tocar, y una **consola** lo muestra, lo completa y lo ejecuta.

```
el núcleo, la presentación, cada juego
   │  declaran variables (con tipo, rango, valor por defecto y alcance) y comandos
   ▼
el registro  (paquetes/comandos: sin pantalla, con pruebas)
   │  interpreta una línea: "dojo.cubos 20", "ver.triangulos si", "dojo.crear 0 2 0"
   ├─► de arranque  → el mundo vuelve a empezar
   ├─► del mundo    → entra en el paso siguiente, por la partida, y queda en su historia
   └─► de la vista  → enseguida
   ▲
   │  lo usan todos de la misma manera:
la consola · las salas guardadas · los enlaces con receta · la receta de inicio · las pruebas
```

- **El paquete `comandos`:**
  - el registro y el intérprete;
  - los tipos de valores: número, entero, si o no, vector, opción y texto;
  - los errores con "¿quisiste decir…?" y el autocompletado;
  - las recetas y su formato para enlaces.

  Todo sin pantalla, con 19 pruebas.

- **El canal de los cambios del mundo, en la partida.** Un cambio que llega de la consola no toca el mundo enseguida: se aplica al empezar el paso siguiente, siempre en el mismo orden, y queda en `historial` con su paso. Es la base de las repeticiones, y el mismo canal que van a usar el personaje y la red.
- **El contrato de los juegos (el cartucho) recibe el registro, y no la dirección.** Cada juego declara lo suyo. El Dojo declara tres cosas:
  - `dojo.cubos`, de arranque;
  - `dojo.giro`, del mundo: el giro del cubo grande;
  - `dojo.crear x y z`, una acción del mundo.
- **La presentación deja de leer la dirección.**
  - Declara `ver.triangulos`, `ver.ejes`, `ver.estadisticas`, `vista.lento` y `vista.pausa`.
  - Suma los comandos `reiniciar`, `pausa`, `paso` y `huella`.
  - Trae la consola como una pieza que el juego monta si quiere. Se abre con la **º** o con un botón.
- **Las salas guardadas** son archivos de texto en `juegos/dojo/recetas/`, y cada una tiene su página: `…/jugar/dojo/lluvia/`. La página "Jugar" las lista. Agregar una sala es agregar un archivo.
- **Las preferencias de cada persona,** guardadas en su navegador y aparte para cada juego: la receta de inicio (`inicio guardar`), los atajos (`atajo t alternar ver.ejes`) y el historial de la consola.

## Hallazgos

| Hallazgo                                            | Qué pasaba                                                                                                                                                                                                   | Arreglo                                                                                                                                                                              |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **La V1 tenía la configuración desparramada**       | La dirección se leía en una decena de lugares y las teclas de depuración vivían en `main.ts`. F1 no servía (en el MacBook es el brillo)                                                                      | Todo se declara en un registro. Las teclas vuelven como atajos que cada persona elige                                                                                                |
| **Una receta podía llegar antes que las mallas**    | Al montar el Dojo, las recetas se aplican antes de crear el mundo. Si una trae `ver.triangulos si`, la vista recorre las mallas… que todavía no existían. Se encontró releyendo el código, antes de probarlo | El estado de las mallas se crea antes de declarar las variables de la vista                                                                                                          |
| **El botón para volver tapaba la consola**          | La consola baja desde arriba, y el enlace "← Manifold Gaming" estaba arriba a la izquierda                                                                                                                   | El enlace pasó abajo a la derecha. Abajo a la izquierda va el botón de la consola                                                                                                    |
| **Un enlace ajeno no puede tocar tus preferencias** | Un enlace con `inicio guardar` adentro podría cambiar cómo arranca el Dojo para siempre, en tu navegador                                                                                                     | Una receta solo fija variables y ejecuta los comandos declarados seguros. Lo demás se rechaza, con aviso. Lo comprueban las pruebas, y con una mutación que quita el control, fallan |
| **El orden de un cambio del mundo importa**         | Si un cambio se aplicara "a mitad" de un paso, dos partidas con los mismos cambios podrían separarse                                                                                                         | Se aplica siempre al empezar el paso siguiente, y la historia guarda el paso. Si la consola se saltea la partida, las pruebas fallan                                                 |

## Medido

- **Las pruebas:** 55 sin pantalla (23 nuevas: 19 del registro y las recetas, 4 del Dojo) y 21 en Chromium (6 nuevas). Las nuevas en Chromium son:
  - la consola cambia el mundo;
  - cada sala guardada nace con su receta;
  - un enlace aplica lo que entiende y avisa lo demás;
  - la receta de inicio y los atajos se recuerdan.
- **Dos partidas del Dojo que reciben los mismos cambios en los mismos pasos** dan la misma huella, paso por paso, durante 120 pasos. Sin los cambios, la huella se separa desde el paso en que entran.
- **Un enlace con receta** es corto y se lee: `…/jugar/dojo/#receta=dojo.cubos+20;dojo.giro+0+3+0;ver.triangulos+si`.
