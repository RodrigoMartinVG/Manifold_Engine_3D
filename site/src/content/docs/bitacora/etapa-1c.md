---
title: 'Etapa 1c: las repeticiones'
description: 'Todo lo que pasa queda grabado: un enlace con una corrida la vuelve a mostrar igual y lo comprueba con la huella, en cualquier navegador. Y un fantasma para correr contra uno mismo. Con esto se cumple la demostración de la etapa 1.'
sidebar:
  order: 9
---

> Informe de la etapa 1c. Con ella se cumple la demostración de la etapa 1: un personaje corre y salta en un nivel clásico, y su repetición da la misma huella. Y no solo en la misma máquina: en otro navegador también.

## Qué hicimos

- **Una repetición es poco:**
  - cómo nació el mundo (una receta con sus valores de arranque y de mundo);
  - lo que pidió cada jugador, con su paso, solo cuando cambió;
  - los cambios del mundo hechos desde la consola, con su paso;
  - el último paso y su huella.

  No hace falta guardar el mundo: como es determinista, el mismo comienzo y las mismas entradas alcanzan. Es texto, una cosa por línea, que se puede leer:

  ```
  # Manifold replay
  game dojo
  birth dojo.level course
  input 41 1 0 0 -1 0 0 0 -
  input 96 1 0 0 -1 0 0 0 j
  change 120 dojo.spawn 0 5 0
  end 300 1a2b3c4d
  ```

- **El mundo graba siempre**, desde que nace. `replay` dice cuánto lleva grabado, `replay export` arma un enlace con la corrida (`#replay=…`), `replay play` la vuelve a mostrar desde el principio y `replay stop` devuelve el control.
- **Un enlace con una repetición la reproduce y la comprueba.** El mundo nace como el grabado, recibe las mismas entradas en los mismos pasos, y al final la consola dice si la huella dio igual: "the same hash, the same world". En el enlace va comprimida (con `deflate`, que ya trae el navegador) y escrita con letras que una dirección acepta.
- **Fantasmas.** `ghost` vuelve a empezar el mundo con un fantasma que repite lo que acabás de hacer, para correr contra vos mismo. El fantasma es otro mundo que avanza a la par, así que lo que empuja no se mueve en el tuyo. `ghost export` arma el enlace (`#ghost=…`) para que otra persona corra contra él.
- **Antes de fijar el formato, un dato más en lo que pide el jugador:** hacia dónde mirar (`face`). Sirve para un modo nuevo de cámara, `view.camera aim`: un clic toma el mouse, el mouse gira la cámara, y el personaje mira hacia donde mira ella y se mueve de costado sin girar, como en un shooter. Si ese dato se hubiera sumado después, las repeticiones ya guardadas habrían quedado viejas.

## Hallazgos

| Hallazgo                                                    | Qué pasaba                                                                                                                                                                                                                                             | Qué hicimos                                                                                                                                                                                                  |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **El determinismo aguanta entre motores, con el personaje** | Era la prueba pendiente desde la etapa 1a: hasta ahora se había comprobado con cubos que caen, no con alguien que se maneja                                                                                                                            | Una prueba maneja al personaje con el teclado en Chromium, Firefox y WebKit, exporta la corrida y la reproduce en Node. En los tres da la misma huella, y abierta como enlace en el mismo navegador, también |
| **Un enlace a la misma página no la vuelve a abrir**        | Si estás en el Dojo y pegás en la misma pestaña un enlace con otro fragmento (`#replay=…`), el navegador solo cambia el fragmento y no la vuelve a abrir: la repetición no arrancaba. Lo mostró la prueba, que tuvo que pasar por una página en blanco | La página del Dojo vuelve a empezar cuando cambia el fragmento                                                                                                                                               |
| **La comprobación tiene que poder fallar**                  | Una prueba que dice "dio igual" vale si también sabe decir "dio distinto"                                                                                                                                                                              | Sin núcleo: una repetición con un solo salto quitado da otra huella. En el navegador: con la reproducción sin sus entradas, la página dice "different" y la prueba falla                                     |

## Medido

- **Lo que ocupa una repetición** en un enlace (el nivel `course`, con la cámara girando todo el tiempo, que es el peor caso: cada pequeño giro cambia la dirección pedida):

| Tiempo de juego | Cambios de entrada | Texto       | Enlace           |
| --------------- | ------------------ | ----------- | ---------------- |
| 10 s            | 298                | 9.622 car.  | 2.142 caracteres |
| 30 s            | 810                | 26.513 car. | 5.867 caracteres |

Los navegadores aceptan enlaces mucho más largos, pero algunas aplicaciones de mensajes los cortan. Hay margen: la dirección se puede guardar más gruesa, o en binario.

- **Las pruebas:**
  - sin pantalla, 84 (5 nuevas: el texto de una repetición va y vuelve igual, reproducirla da la misma huella y alterada no, los errores de formato, mirar hacia un lado y caminar de costado, y una corrida grabada en el Dojo);
  - en el navegador, 54: 48 en Chromium (3 nuevas: la repetición por enlace, el fantasma y el modo `aim`) y las 3 de física también en Firefox y WebKit.

## Lo que sigue

La etapa 1d: el esqueleto de la red. Un servidor y un cliente con el mismo mundo, temprano, para que todo lo demás se arme sabiendo que va a existir.
