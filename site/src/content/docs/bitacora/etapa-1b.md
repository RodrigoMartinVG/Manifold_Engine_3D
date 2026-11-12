---
title: 'Etapa 1b: el personaje'
description: 'Un personaje que camina, corre, salta y sube escalones, manejado con el teclado o un mando, con una cámara que lo sigue. Su "arriba" sale de la gravedad, y lo que pide el jugador entra al mundo paso a paso.'
sidebar:
  order: 8
---

> Informe de la etapa 1b. Es la semilla del juego de plataformas, el primero de los tres clásicos ([decisión 0012](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0012-the-games.md), en inglés).

## Qué hicimos

- **El personaje es datos, como todo:** un componente `character` con sus velocidades, si está en el suelo, cuántos pasos lleva en el aire, el salto pendiente y hacia dónde mira. Su cuerpo es una cápsula que mueve el **controlador de personaje** de Rapier:
  - se desliza por las paredes;
  - sube caminando escalones de hasta 35 cm;
  - sube pendientes de hasta 50°;
  - se queda pegado al piso al bajar;
  - empuja los cubos que encuentra.
- **En cada paso**, el personaje acerca su velocidad horizontal a la que pide el jugador: rápido en el suelo y de a poco en el aire, para que un salto se pueda corregir un poco. Después salta si corresponde, aplica la gravedad, y el controlador dice cuánto de ese movimiento se puede hacer de verdad.
- **Saltar se siente como en un juego de plataformas:**
  - el salto empieza al apretar, no mientras se mantiene apretado;
  - todavía vale unos pasos después de dejar un borde ("tiempo de coyote", _coyote time_);
  - y si se pide un poco antes de tocar el piso, se guarda y se hace al tocarlo (_jump buffering_).
- **Su "arriba" sale de la gravedad**, como se preparó en la [decisión 0012](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0012-the-games.md). Hoy siempre es +Y, pero una prueba ya lo hace caminar sobre una pared, con la gravedad apuntando a −Z.
- **Lo que pide el jugador entra al mundo por la sesión, en un paso concreto:** hacia dónde ir (una dirección en el mundo), saltar y correr. Se guarda solo cuando cambia, con su paso y su jugador: es la mitad de una repetición, para la etapa 1c. Lo que pide cada jugador también es parte del estado y entra en la huella.
- **La presentación traduce el teclado y el mando:**
  - **teclado:** WASD o las flechas, Espacio y Shift;
  - **mando:** el stick, A y B;
  - lo traduce a una dirección en el mundo según hacia dónde mira la cámara. La cámara es de la vista, no del mundo, así que la simulación nunca sabe dónde está; solo recibe la dirección.
- **La cámara sigue al personaje** desde atrás, y el mouse la sigue girando alrededor. `view.camera free` la suelta, y `camera.reset` la pone de nuevo detrás.
- **Un nivel clásico en el Dojo:** `dojo.level course`, con su sala `course`. Tiene escalones, una rampa, plataformas que se alcanzan saltando, una pared que no se trepa y el cubo grande que gira en el medio.

## Hallazgos

| Hallazgo                                                     | Qué pasaba                                                                                                                                                                                                                                                                                                     | Qué hicimos                                                                                                                                                                                                                          |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`Math.hypot` puede no dar igual en todos los navegadores** | El estándar de JavaScript deja que cada motor calcule `hypot`, `sin`, `cos` o `atan2` a su manera. La matemática del motor usaba `hypot` para los largos, y el personaje los usa en cada paso                                                                                                                  | Los largos se calculan con la raíz cuadrada de la suma de cuadrados, que todos los procesadores redondean igual. Hacia dónde mira el personaje se arma con vectores y raíces, sin trigonometría                                      |
| **Un salto pegado a una pared se cortaba**                   | Lo encontró la prueba en el navegador: el personaje, arrastrado por el cubo que gira, no saltaba. Reproducido en Node: el salto empezaba y su velocidad hacia arriba se anulaba enseguida. Para detectar un techo, se miraba si había subido menos de lo pedido, y rozando una pared siempre sube apenas menos | Un techo es lo que dice el controlador: un choque cuya normal, del lado del personaje, apunta hacia su "arriba". Una prueba salta pegado a una pared, arrastrado por el cubo y bajo un techo de verdad; con el detector viejo, falla |
| **Un toque rápido de Espacio se perdía**                     | Las teclas se leían una vez por cuadro. Una tecla apretada y soltada entre dos cuadros no se veía nunca, algo que pasa con un toque rápido en una máquina lenta                                                                                                                                                | Cada pulsación se guarda hasta la próxima lectura. La prueba aprieta y suelta Espacio de golpe; sin el arreglo, falla                                                                                                                |
| **Sin placa de video, el mundo va más lento que el reloj**   | En las pruebas, que dibujan con la CPU, había pocos cuadros por segundo. El paso fijo corre como mucho 5 pasos por cuadro (es la protección contra la "espiral de la muerte"), así que el personaje avanzaba menos de lo esperado en un segundo                                                                | Era la protección funcionando bien. Las pruebas mantienen la tecla apretada hasta que el personaje avanza, en vez de esperar un tiempo fijo                                                                                          |
| **Una receta puede traer `view.camera`**                     | Las recetas se aplican antes de crear el mundo. La variable de la cámara se había declarado después, y una receta con `view.camera free` iba a fallar: el mismo error de la etapa 0d. Se vio al releer el código                                                                                               | La variable se declara con el resto de la vista, antes de las recetas. Una prueba abre la sala con `view.camera free` en el enlace                                                                                                   |
| **Una cápsula no se puede estirar**                          | Las cajas y las esferas se dibujan con una sola forma, estirada al tamaño de cada una. Una cápsula estirada aplasta sus puntas redondas                                                                                                                                                                        | Cada cápsula se arma a su medida, con un visor que muestra hacia dónde mira                                                                                                                                                          |

## Medido

- **Las pruebas:**
  - sin pantalla, 79 (12 nuevas: 9 del personaje, 2 de la matemática y 1 del Dojo);
  - en el navegador, 49: 45 en Chromium (3 nuevas: las teclas manejan al personaje y la cámara lo sigue; un enlace suelta la cámara; la sala `course`) y la física también en Firefox y WebKit.
- **Lo que prueban las del personaje:** cae y queda parado; camina a su velocidad y mira hacia donde va; corre más rápido; salta unos 2,15 m (lo que da v²/2g con 6,5 m/s) y una sola vez aunque se mantenga apretado; el tiempo de coyote y el salto guardado; sube un escalón de 30 cm pero no una pared de 60 cm; empuja un cubo; camina sobre una pared con la gravedad hacia −Z; y dos sesiones con las mismas entradas dan la misma huella, paso por paso.
- **Rotas a propósito:** el detector viejo de techos y la lectura de teclas sin guardar las pulsaciones. Cada una hizo fallar su prueba.

## Lo que sigue

La etapa 1c: las repeticiones. La semilla y lo que pidió cada jugador, en un enlace; y un fantasma que corre el mismo nivel al lado.
