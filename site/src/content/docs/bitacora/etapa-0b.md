---
title: 'Etapa 0b: el tutorial ejecutable'
description: 'Un editor en la página que ejecuta TypeScript de verdad, aislado, con las librerías del motor. Cómo se armó y qué encontramos.'
sidebar:
  order: 1
---

> Informe de la etapa 0b. La decisión completa, con sus alternativas, está en la [decisión 0007](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisiones/0007-tutorial-ejecutable.md).

## Qué hicimos

El tutorial pasó de "capítulos largos" a **lecciones cortas con código que corre en la página**, y los informes como este pasaron a la Bitácora. Para eso hizo falta un **ejecutor**: el componente `<CodigoVivo>`.

```
la lección (archivos .ts reales)
   │  Astro los lee como texto
   ▼
editor (CodeMirror, una pestaña por archivo)
   │  ▶ Ejecutar: Sucrase le saca los tipos; './vista' pasa a llamarse 'leccion/vista'
   ▼
iframe aislado (otro origen)  ◄── las librerías, armadas al compilar (three, lil-gui...)
   │  cada módulo, un blob:; un mapa de importaciones dice cuál es cuál
   ▼
lo que dibuja, arriba;  la consola y los errores (con archivo y línea), abajo
```

Y cinco lecciones de la etapa 0: el primer cubo, cuaterniones contra ángulos, el paso fijo, el azar con semilla, y simulación y dibujo separados.

## Hallazgos

| Hallazgo                                        | Qué pasaba                                                                                                                                                                                                    | Arreglo                                                                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Los iframes fuera de la pantalla no dibujan** | Las lecciones con 3D no reportaban ningún cuadro. Medido: con el resultado a la vista, dibuja; fuera de la vista, **0 cuadros**. Chrome no le da cuadros a un iframe de otro origen que no se ve (ahorra GPU) | El resultado va **arriba** del editor: es lo primero que ve el lector. Las pruebas lo traen a la vista antes de medir           |
| **Dos lecciones "pasaban" por la consola**      | La prueba aceptaba "dibujó o escribió en la consola": las que escriben al empezar pasaban aunque no dibujaran                                                                                                 | Al ver el fallo de las otras se encontró la causa común. La prueba sigue aceptando la consola, para las lecciones sin animación |
| **Una prueba que no probaba lo que decía**      | "Solo uno corre a la vez" cambiaba de página entre los dos ejemplos, y una página nueva empieza de cero                                                                                                       | Se borró. Mejor sin prueba que con una que engaña                                                                               |
| **Un `blob:` no tiene carpeta**                 | Un módulo cargado como `blob:` no puede importar `./vista`: no hay contra qué resolver la ruta                                                                                                                | Antes de ejecutar, `./vista` se reescribe como `leccion/vista`, un nombre del mapa de importaciones                             |
| **Las librerías, con importaciones adentro**    | Three.js por npm importa sus propios archivos (`./three.core.js`), que en el iframe no existen                                                                                                                | Un archivo por librería, armado con Vite al compilar (y OrbitControls deja a `three` afuera, para usar la misma copia)          |
| **Astro revisaba las librerías armadas**        | `astro check` revisaba los 900 KB de Three.js minificado y mostraba cientos de avisos                                                                                                                         | `public/vendor` fuera de la revisión, del linter y de Prettier                                                                  |
| **Dos puntos en el inicio**                     | Una frase con "dos puntos y espacio" en el encabezado de una página rompía el YAML                                                                                                                            | Entre comillas                                                                                                                  |

## Medido

- Las librerías armadas: Three.js, **892 KB**; OrbitControls, 23 KB; lil-gui, 33 KB. Se piden una sola vez por página, la primera vez que algo se ejecuta.
- En la lección 5, la simulación sin pantalla corre **dos mundos de 600 pasos en 4,3 ms**, con el mismo resumen hasta el noveno decimal.
- En la integración continua, sin GPU, Chromium dibuja las lecciones a unos 13 cuadros por segundo: alcanza para probarlas.
