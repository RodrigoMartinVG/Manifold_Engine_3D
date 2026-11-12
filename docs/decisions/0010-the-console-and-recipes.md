# 0010. La consola y las recetas

- **Estado:** aceptada (al revisarla se sumaron la dirección propia de cada sala y las reglas de los enlaces).
- **Fecha:** 2026-11-11

## Contexto

Hoy el Dojo se configura con parámetros en la dirección (`?cubos=20&semilla=3`). No se descubre qué se puede cambiar, no hay ayuda ni validación, y para cambiar algo hay que recargar la página.

En la V1 pasaba lo mismo, y peor:

- **La dirección se leía en una decena de lugares** de `main.ts` (`servidor`, `nivel`, `repeticion`, `fantasma`, `nueva`…), y se le pasaba entera a las reglas de cada juego.
- **Las vistas de depuración se prendían con teclas sueltas:** F, la física; N, la navegación; M, la fusión del nivel; P, la escala. Para saber que existían había que leer el código, y F1 no servía, porque en el MacBook es el brillo.

Un panel con todas las opciones tampoco escala: cada opción nueva es un control más que diseñar y mantener, y a futuro van a ser muchas.

Y algo que ordena todo lo demás: **el Dojo es un juego**, el primero, con el que se prueba cada cosa del motor. Los juegos que vengan tendrán sus propias reglas; quizás una consola, quizás no.

## Decisión

### Un registro de comandos y variables; la consola es una de sus caras

- **Cada parte declara lo suyo en un registro:**
  - **variables:** tipo, rango, valor por defecto y descripción;
  - **comandos:** acciones con argumentos.

  Ningún módulo lee la dirección ni el teclado por su cuenta.

- **La consola**, como la de Quake, muestra, completa y ejecuta lo declarado. No hay panel de opciones: una opción nueva aparece sola en la consola.
- **No es un lenguaje.** Una línea es un comando con sus argumentos; también se pueden poner varios en una línea, separados por `;`. No tiene variables propias, condiciones, bucles ni JavaScript. Para configurar, mirar y compartir, alcanza.

### Las capas: el motor ofrece, cada juego decide

| Capa                                                     | Qué pone                                                                                                                                                                                              | ¿Obligatorio para un juego?                                   |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Motor, sin pantalla** (`paquetes/comandos`, el núcleo) | El registro, el intérprete y el formato de las recetas. Las declaraciones que el motor trae listas (`semilla`, `fisica.gravedad`…). El canal por el que un cambio del mundo entra en un paso concreto | No: es una librería. Un juego que no la usa no paga nada      |
| **Presentación**                                         | La consola, como una pieza que se monta, y las vistas de depuración `ver.*`                                                                                                                           | No: cada juego la monta o no, y puede darle su propio aspecto |
| **Cada juego**                                           | Qué expone: sus variables y comandos, y cuáles del motor deja tocar. También sus escenarios, sus recetas, su receta de inicio y sus enlaces                                                           | Es la decisión de cada juego                                  |

- **El Dojo expone todo**, porque es un laboratorio. Otro juego puede no tener consola, tenerla solo para desarrollo, o permitir solo comandos de la vista. En un juego competitivo, cambiar la gravedad desde la consola sería hacer trampa.
- **El Dojo no tiene puertas traseras.** Usa el mismo contrato público que cualquier juego. Si le falta algo, le falta al motor.
- **Cada nombre tiene su espacio:** los del motor (`semilla`, `fisica.gravedad`, `ver.triangulos`) y los de cada juego (`dojo.sala`, `dojo.cubos`).

### Tres tipos de opciones, según qué tocan

| Tipo            | Ejemplos                                          | Qué pasa al cambiarla                                                                                                                                        |
| --------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **De arranque** | `semilla 7`, `dojo.sala planeta`, `dojo.cubos 20` | Definen cómo nace el mundo: cambiarlas lo reinicia                                                                                                           |
| **Del mundo**   | `fisica.gravedad 0 -3 0`, `crear cubo 0 5 0`      | Entran a la simulación como una entrada más, en un paso concreto, igual que una tecla del jugador. Se graban en la repetición, y la huella sigue dando igual |
| **De la vista** | `ver.triangulos si`, `vista.lento 0.25`           | Solo cambian lo que se ve. No tocan la simulación, no se graban en la repetición y no cambian la huella                                                      |

Esta división mantiene el determinismo, y prepara la red. Un cambio del mundo lo puede validar y repartir un servidor; uno de la vista nunca sale de la máquina.

`vista.lento` es de la vista: con paso fijo, ir más lento no cambia la física, solo la muestra más despacio.

### Las vistas de depuración: `ver.*`

- **Desde la primera versión:**
  - `ver.triangulos`: las mallas como alambre;
  - `ver.ejes`;
  - `ver.estadisticas`: cuadros por segundo, paso y huella.
- **Con la física, en la etapa 1:**
  - `ver.fisica`: lo que Rapier ve, como la F de la V1;
  - `ver.vectores`: velocidades y fuerzas;
  - `ver.gravedad`: flechas del campo;
  - `ver.contactos`.
- **Cada vista es un módulo de la presentación que se declara solo.** Apagada no cuesta nada: no calcula ni dibuja.
- **Las teclas vuelven como atajos configurables:** `atajo f ver.fisica`, como el `bind` de Quake. Se guardan en el navegador, aparte para cada juego.

### Cómo se escribe

- **Leer y cambiar:**
  - `nombre`, sin argumentos: muestra el valor, el rango, el valor por defecto, para qué sirve y de qué tipo es;
  - `nombre valores…`: lo cambia, o ejecuta el comando;
  - `alternar nombre`: da vuelta un sí o no.
- **Los valores:**
  - **sí o no:** `si`/`no`, y también `1`/`0`;
  - **decimales:** con punto, como en el código (`0.25`);
  - **vectores:** tres números separados por espacios;
  - **texto:** entre comillas.
- **En las recetas:** `#` empieza un comentario, y `;` separa comandos en una línea.
- **Para orientarse:**
  - `ayuda` y `ayuda nombre`;
  - `buscar texto`: busca en nombres y descripciones;
  - `variables prefijo` (por ejemplo, `variables ver.`): lista con los valores actuales;
  - `cambiadas`: solo lo que difiere del valor por defecto.
- **Los errores dicen qué esperaban,** y sugieren el nombre parecido: "¿quisiste decir `fisica.gravedad`?".
- **La consola en pantalla:**
  - se abre con la tecla de la izquierda del 1 (código `Backquote`: la **º** en un teclado español), como en Quake, y con un botón en pantalla para pantallas táctiles;
  - mientras está abierta, las teclas son de la consola y no del juego;
  - Tab completa nombres y opciones, y las flechas recorren el historial, que se guarda en el navegador, aparte para cada juego.

### Las recetas, y cómo arranca un juego con un escenario

Una **receta** es texto plano, que se lee y se copia:

```
# Órbitas que se cierran
semilla 7
dojo.sala planeta
fisica.gravedad.intensidad 12

# Lo que se ve
ver.vectores si
```

- **Un juego nace configurado.** Al abrirlo, y antes de crear el mundo, se juntan en este orden:
  1. los valores por defecto;
  2. la **receta de inicio**, si hay: lo que cada persona quiere siempre, como el `autoexec.cfg` de Quake. Se guarda en el navegador con `inicio guardar` y se borra con `inicio borrar`;
  3. la **receta de la sala**, si se entró por la dirección de una sala guardada;
  4. la **receta del enlace**, si vino una. Gana sobre las anteriores.

  Recién entonces se crea el mundo, una sola vez y ya configurado. No arranca "básico" para después cambiar.

- **Cada sala guardada tiene su propia dirección.** Una receta guardada en el repositorio del juego (`juegos/dojo/recetas/orbitas.txt`) se convierte, al armar el sitio, en una página propia: `…/jugar/dojo/orbitas/`. Es el mismo juego, que nace con esa receta. Se puede guardar en favoritos, la página "Jugar" la lista y una lección la puede enlazar. Es la dirección como _lugar_ ("la sala de las órbitas está acá"), no como panel de control.
- **Un enlace puede llevar la receta adentro,** en el fragmento (`#`), que no viaja al servidor: `…/jugar/dojo/#receta=dojo.cubos+20;ver.triangulos+si`. Es lo que arma `exportar`. Las líneas se separan con `;` y los espacios se escriben `+`, así el enlace se puede leer y corregir a mano; lo demás se escapa como en cualquier dirección. Se puede sumar a la dirección de una sala: `…/jugar/dojo/orbitas/#receta=ver.vectores+si`.

- **Lo que un enlace no puede hacer.** Una receta (de un enlace, de una sala o la de inicio) solo puede fijar variables y ejecutar los comandos declarados como seguros para recetas. Nunca toca las preferencias guardadas en el navegador (`inicio`, `atajo`, `idioma`): un enlace ajeno no cambia la configuración de nadie. Y como la consola no ejecuta código y valida cada valor, un enlace no puede hacer nada que la consola no permita.
- **Si una línea no se entiende** (por ejemplo, la receta viene de una versión más nueva), el juego arranca igual con el resto, y la consola avisa cuántas líneas no entendió y cuáles.
- **`exportar` escribe la receta de lo que se cambió.** Lo de arranque y lo del mundo van con sus valores finales; lo de la vista, en una sección aparte.
- **Una receta no es una repetición.** La receta es un _ajuste_: cómo arrancar y qué ver. La repetición es una _historia_: la semilla más cada cambio del mundo con su paso.
- **Las pruebas corren recetas** sin pantalla y comparan la huella.
- **La dirección vieja del Dojo** (`?cubos=…&semilla=…`) se traduce a receta durante un tiempo, para no romper enlaces, y después se retira.

### El idioma

- **Los nombres de comandos y variables son identificadores fijos, en castellano,** como el código. Una receta tiene que andar igual dentro de años, y en cualquier idioma.
- **Lo que se traduce:**
  - las descripciones, la ayuda y los mensajes. Cada declaración guarda su texto por idioma (`{ es: '…' }`) desde el principio, y el inglés se suma después;
  - los valores de sí o no: `si` y `yes` valen los dos.
- **Más adelante, alias en inglés:** `physics.gravity` ejecutaría `fisica.gravedad`. Pero `exportar` siempre escribe los nombres originales, para que una receta armada en inglés se abra en castellano, y al revés.
- **`idioma en` en la misma consola**, guardado en el navegador. Cuando el sitio tenga inglés, la consola arranca en el idioma de la página.
- Por ahora, todo en castellano.

### La primera parte, antes de la etapa 1

1. **El registro, el intérprete y el formato de las recetas**, sin pantalla y con pruebas en Vitest.
2. **El canal para los cambios del mundo, en un paso concreto.** Es el mismo que va a usar el personaje en la etapa 1.
3. **La consola**, como pieza de la presentación.
4. **El Dojo la monta** y declara `semilla`, `dojo.cubos`, `reiniciar`, `pausa` y `paso`. Suma `ver.triangulos`, `ver.ejes` y `ver.estadisticas`, las recetas (`exportar`, `cargar`, `inicio`), los atajos, y la dirección vieja traducida a receta.
5. **Una prueba en Chromium:** abrir la consola, escribir `dojo.cubos 20` y ver 21 mallas.

## Consecuencias

- **Una opción nueva cuesta una declaración**, no un control de interfaz.
- **Un solo formato y un solo intérprete** para configurar, mirar, compartir y probar: la consola, los enlaces, las recetas del repositorio y las pruebas.
- **Los cambios del mundo pasan por el canal de las entradas del jugador:** hay que construirlo ya. De todos modos lo necesita la etapa 1.
- **Escribir es menos amable que tocar un control.** La ayuda, el autocompletado, `buscar` y las recetas con nombre tienen que compensarlo.
- **Los nombres son un contrato:** una receta guardada tiene que seguir andando. Si un nombre cambia, el viejo queda como alias.
- **Falta decidir los permisos para la red:** quién puede ejecutar un cambio del mundo en una partida en red. Se decide con la red.

## Alternativas descartadas

- **Parámetros en la dirección**, lo de hoy: no se descubren, no tienen ayuda y obligan a recargar. Quedan solo como transporte de una receta.
- **Un panel con todas las opciones** (lil-gui o uno propio): se vuelve inmantenible a medida que crecen las opciones.
- **Una consola que ejecuta JavaScript:** potente, pero rompe el determinismo y la frontera entre la simulación y la pantalla.
- **Teclas sueltas para cada vista de depuración,** como en la V1: no se descubren y chocan con el sistema. Vuelven como atajos configurables.
- **Una consola del sitio o del motor, igual para todos los juegos:** cada juego tiene su idiosincrasia; el motor ofrece las piezas y el juego decide.

## Lo que se decidió por defecto (se puede cambiar más adelante)

- **La tecla para abrirla:** la de la izquierda del 1 (**º**), más un botón en pantalla.
- **Los sí y no:** `si`/`no`, y también `1`/`0`.
- **Los decimales:** con punto.
- **Las recetas:** también guardan lo de la vista, en una sección aparte.
- **Los atajos:** van en la primera versión.
