---
title: 'Etapa 1c2: girar sobre su eje, y la cámara'
description: 'Una segunda manera de manejar al personaje, con A y D que lo giran sobre su eje; una cámara que lo sigue con correa y otra que vuelve detrás de él. Y un error de la 1c que no se había visto: el −0.'
sidebar:
  order: 10
---

> Informe de la etapa 1c2, una etapa corta antes de la red. Salió de una pregunta: la cámara solo gira arrastrando el mouse, y con el teclado el personaje tiene 8 direcciones, que cambian cuando gira la cámara. ¿No es raro? Era un tema de la cámara, y también de desde dónde se mide "adelante".

## Qué hicimos

- **Dos maneras de manejar con las teclas** (`controls.scheme`):
  - `camera`, la de siempre: "adelante" es hacia donde mira la cámara, y el personaje mira hacia donde camina, como en un juego de plataformas;
  - `tank`, la nueva: "adelante" es hacia donde mira el personaje. W y S avanzan y retroceden, A y D lo giran sobre su eje, y Q y E lo llevan de costado. Como en los shooters viejos, A y D con **Alt** apretado también van de costado. Son los **controles de tanque** (_tank controls_): con el teclado solo ya se puede ir hacia cualquier lado. Con un mando, el stick izquierdo gira y avanza, y los botones de los hombros van de costado.
- **Lo que pide el jugador suma tres números:** `ahead` (adelante o atrás), `side` (de costado) y `turn` (girar). La dirección del modo `camera` se arma en la presentación, porque la cámara es de la vista. Esto otro se resuelve en la simulación, porque hacia dónde mira el personaje es del mundo. Y queda una ventaja: mantener A apretada es un solo cambio de entrada en la repetición, no uno por cada pequeño giro, como pasa con la cámara.
- **Girar sin trigonometría.** Girar un ángulo usa seno y coseno, y el estándar deja que cada motor de JavaScript los calcule a su manera: en otro navegador, una repetición terminaría en otro lado. En lugar de eso, a hacia dónde mira se le suma un poco de su costado derecho, y se lo vuelve a llevar a largo 1. Son sumas, productos y una raíz, que dan los mismos bits en todos lados. Gira atan(k) en vez de k radianes, con k = 0,05 por paso: la diferencia es de menos de una milésima. Las demos de Doom resolvían lo mismo a su manera: guardaban por cada paso cuánto avanzar, cuánto ir de costado, cuánto girar y los botones, con ángulos enteros y una tabla de senos.
- **Retroceder no lo da vuelta.** El personaje mira hacia donde camina solo cuando el pedido es en el mundo. Si mirara hacia donde se mueve también con `ahead`, al retroceder giraría para el otro lado, y en el paso siguiente otra vez.
- **Cuatro cámaras** (`view.camera`):
  - `follow` ahora va **con correa**: mantiene la altura y la distancia, pero se queda donde está mientras puede. Alejarse la arrastra, acercarse la empuja, e ir hacia un costado la gira de a poco. Antes se movía lo mismo que la cabeza del personaje, y nunca giraba sola;
  - `chase`, nueva, vuelve sola detrás del personaje: arrastrar mira alrededor, y al soltar vuelve. Es la pareja de `tank`;
  - `aim` y `free`, como antes.
- **El stick derecho del mando gira la cámara**, en cualquiera de ellas.

Las combinaciones dan los esquemas de siempre:

| Teclas            | Cámara   | Se parece a                                          |
| ----------------- | -------- | ---------------------------------------------------- |
| `camera`          | `follow` | un juego de plataformas en 3D                        |
| `camera`          | `aim`    | un shooter                                           |
| `tank`            | `chase`  | las aventuras de antes, un auto                      |
| `tank`, con Q y E | `follow` | los juegos de rol en línea, que se miran arrastrando |

## Hallazgos

| Hallazgo                                               | Qué pasaba                                                                                                                                                                                                                                                               | Qué hicimos                                                                                                                                                                                                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **El −0: un error de la 1c que no se había visto**     | Lo que pide el jugador se redondea a centésimos. Un número negativo chiquito, como −0,003, redondea a −0, que se escribe "0" y se lee como +0. Tienen bits distintos, así que la repetición daba **otra huella**. Las pruebas de la 1c caminaban derecho y no lo tocaron | Al redondear, el −0 pasa a +0 desde el principio. Una prueba lo comprueba, y sin el arreglo falla                                                                                                                                               |
| **Una repetición es de un motor, no solo de un texto** | Con los tres números nuevos, el mundo guarda más cosas, y las mismas entradas dan otra huella. Una repetición de la 1c habría dicho "different", como si el mundo hubiera divergido                                                                                      | La primera línea dice la versión (`# Manifold replay 2`), y una de otra versión lo dice en vez de reproducirse mal. Ya que cambiaba, lo que pide el jugador se escribe con palabras y solo lo que no es cero: `input 96 1 ahead 1 turn -1 jump` |
| **En `aim`, el mouse vertical estaba al revés**        | Bajar el mouse hacía mirar hacia arriba: al contrario de arrastrar, y de la mayoría de los juegos                                                                                                                                                                        | Ahora bajar el mouse (o el stick derecho) mira hacia abajo                                                                                                                                                                                      |
| **Una prueba que leía valores viejos**                 | La página dice hacia dónde mira el personaje cada 10 cuadros, y sin placa de video hay pocos por segundo. La prueba soltaba D cuando veía el giro, pero el personaje ya había girado bastante más. Y dos lecturas iguales no probaban que el giro hubiera terminado      | La prueba compara solo lecturas entre las que la página volvió a escribir (cambió su paso), y comprueba que avance hacia donde quedó mirando, sea cual sea                                                                                      |

## Medido

- **Las pruebas:**
  - sin pantalla, 89 (5 nuevas: girar y caminar según el personaje, girar sin trigonometría, que mirar hacia un lado gane sobre girar, la versión de una repetición y el −0);
  - en el navegador, 59: 51 en Chromium (3 nuevas: la correa, los controles de tanque con `chase`, y una corrida que gira, grabada en el navegador y reproducida en Node) y las 4 de física en Firefox y en WebKit. Girar sin trigonometría da la misma huella en los tres y en Node.
- **Las comprobaciones de mutación:** sin el arreglo del −0, sin "retroceder no lo da vuelta", sin la correa, sin la vuelta de `chase` y sin Alt, falla cada vez la prueba que lo cuida.

## Lo que sigue

La etapa 1d: el esqueleto de la red.
