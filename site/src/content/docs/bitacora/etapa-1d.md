---
title: 'Etapa 1d: el estado que viaja'
description: 'Lo que pide un jugador pasa a ser acciones con nombre, que cada juego amplía con botones propios; y el mundo entero, física incluida, se guarda y se vuelve a él con la misma huella.'
sidebar:
  order: 11
---

> Informe de la etapa 1d. Prepara la red de la 1e. Deja listas las dos cosas que van a viajar: lo que pide cada jugador, que va hacia el servidor, y el mundo entero, que necesita quien entra a una partida empezada.

## Qué hicimos

- **Lo que pide un jugador, con nombres.** Antes era una lista fija de campos: `move`, `ahead`, `side`, `turn`, `face`, `jump` y `run`. Cada acción nueva (agarrar, usar, disparar) habría cambiado el formato de las repeticiones, y el núcleo habría tenido que conocer las acciones de cada juego. Ahora son **acciones declaradas**: el núcleo declara las que lee el personaje, y cada juego declara las suyas, con su espacio de nombres. Hay tres clases: un **botón** vale mientras está apretado, un **eje** es un número de −1 a 1 y un **vector** son tres números. Lo que no aparece vale cero.

  ```
  { move: [0, 0, -1], jump: true }     adelante según la cámara, y saltando
  { ahead: 1, turn: -1 }               adelante según el personaje, girando a la izquierda
  { 'dojo.throw': true }               un botón del Dojo
  ```

- **La sesión deja entrar solo lo declarado.**
  - Un nombre que nadie declaró queda afuera, un eje se limita a ese rango, y lo que no es un número (NaN, infinito) vale cero.
  - Una repetición que trae algo que el juego no declaró se rechaza, y el error dice en qué paso.

  Con la red va a hacer falta: el mensaje de otro jugador no puede meter cualquier cosa en el mundo.

- **Apretar no es mantener.** El mundo recuerda lo que pidió cada jugador en el paso anterior, así que un juego puede preguntar si un botón se apretó en este paso (`pressed`). Mantenido, cuenta una sola vez.
- **El primer botón propio de un juego: `dojo.throw`.** Con **F** (o **X** en un mando), el personaje tira una pelota hacia adelante. El núcleo no sabe nada de pelotas: el Dojo declara el botón, lo lee en cada paso, y su página dice qué tecla lo aprieta. En una repetición queda como `input 130 1 dojo.throw`. En la consola, `inputs` lista todo lo que un jugador puede pedir, y con qué.
- **Instantáneas** (_snapshots_), como las definió la decisión 0004. Guardan:
  - el reloj y el contador de entidades;
  - el estado del azar y la gravedad;
  - lo que pide cada jugador, y lo que pidió en el paso anterior;
  - las entidades;
  - la instantánea que Rapier saca de su propio mundo. Lleva lo que no está en nuestras entidades: los contactos, y lo que el motor de física arrastra de un paso al siguiente.

  Restaurada, sigue exactamente como habría seguido la original.

- **`snapshot` y `snapshot load`** en la consola, como el "guardar estado" de un emulador. **Y la repetición sigue valiendo:** al volver, la sesión también recupera su historia y lo que pidieron los jugadores hasta ese momento. Así, la repetición desde el nacimiento describe el mundo al que llegás después de volver. Lo que pasó entre el guardado y la vuelta no queda en ella, porque ya no pasó.

## Hallazgos

| Hallazgo                                          | Qué pasaba                                                                                                                                                                                                                                                                                                  | Qué hicimos                                                                                                                                                                              |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Rapier restaura exacto, y se midió antes**      | Era el riesgo de la etapa: si Rapier guardara por dentro algo que su instantánea no lleva, el mundo restaurado se iría por otro camino. La primera medición dijo que sí se iba, pero el error era mío: el script avanzaba uno de los dos mundos 50 pasos de más, para medir el tiempo, antes de compararlos | Medido bien: 300 pasos después, los mismos bits. En las pruebas, el mundo restaurado da la misma huella en cada uno de 200 pasos, y en el navegador también (Chromium, Firefox y WebKit) |
| **La huella no contaba el contador de entidades** | Dos mundos con las mismas entidades pero con distinto contador le dan a la próxima entidad otro número: son mundos distintos con la misma huella. Salió al pensar qué tiene que guardar una instantánea                                                                                                     | La huella cuenta el contador, y también lo que se pidió en el paso anterior                                                                                                              |
| **Copiar sin JSON**                               | La manera rápida de copiar datos en JavaScript, pasarlos a JSON y de vuelta, convierte −0 en 0 y NaN en null: otra huella. Y `structuredClone` es del navegador y de Node, no del lenguaje, y el núcleo corre solo con el lenguaje                                                                          | Una copia propia de datos simples, que deja cada número como está                                                                                                                        |
| **Volver también vuelve la historia**             | Sin eso, después de volver, la repetición tendría las entradas de un futuro que ya no pasó                                                                                                                                                                                                                  | La sesión guarda, junto con el mundo, su historia, sus valores de mundo y lo que esperaba el paso siguiente                                                                              |
| **Una prueba mía cambiaba el mundo**              | Para comprobar el próximo número de entidad, la prueba creaba una entidad en el mundo restaurado: ese mundo ya no era el de la repetición, y la prueba fallaba                                                                                                                                              | La prueba mira el contador, sin crear nada                                                                                                                                               |
| **Versión 3**                                     | Con la entrada nueva y la huella más completa, las mismas entradas dan otra huella                                                                                                                                                                                                                          | La versión (`# Manifold replay 3`) es ahora la de la simulación: vale para repeticiones e instantáneas                                                                                   |

## Medido

- **Una instantánea del Dojo** (en Node, en la Mac de desarrollo):

| Mundo                 | Cuerpos | Física | Entidades   | Guardar | Volver |
| --------------------- | ------- | ------ | ----------- | ------- | ------ |
| `course` con 12 cubos | 23      | 32 KB  | unos 11 KB  | 0,7 ms  | 1,5 ms |
| 200 cubos amontonados | 202     | 430 KB | unos 111 KB | 1,4 ms  | 1,9 ms |

Para entrar una vez a una partida empezada alcanza de sobra; para mandarla en cada paso, no. Los contactos pesan: 200 cubos sueltos ocupan menos que 200 amontonados.

- **Las pruebas:**
  - sin pantalla, 97 (8 nuevas: que el mundo restaurado siga igual paso a paso, que la instantánea sea una copia, la versión, volver con la historia y los valores, lo que cuenta la huella, lo que no se declaró, el botón propio de un juego, y `dojo.throw`);
  - en el navegador, 63: 53 en Chromium (2 nuevas: `snapshot` con la pelota que desaparece, y una corrida que vuelve a una instantánea, reproducida en Node) y las 5 de física en Firefox y en WebKit.
- **Las comprobaciones de mutación:** falla cada vez la prueba que corresponde si la huella no cuenta el contador, si volver no recupera los valores, si el mundo no recuerda el paso anterior, si una repetición no se comprueba contra el juego, si entra lo que no se declaró, o si al volver no se sacan los objetos que ya no existen.

## Lo que sigue

La etapa 1e: el esqueleto de la red. Todos los juegos pasan por ella desde el principio, aunque se juegue solo.
