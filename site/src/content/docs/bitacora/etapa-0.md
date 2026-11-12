---
title: 'Etapa 0: cimientos'
description: 'Informe de la etapa 0: el repositorio, las herramientas, el sitio, las decisiones y el primer código del motor. Lo que hicimos, lo que encontramos y lo que medimos.'
sidebar:
  order: 0
---

## Qué construimos y qué vas a entender

> Este es el **informe** de la etapa 0: el detalle de lo que hicimos, con sus hallazgos y mediciones. Para aprender las ideas tocando código, está el [tutorial de la etapa 0](../../tutorial/).

En la etapa 0 todavía no hay física ni personajes. Hay **cimientos**, que son lo que más cuesta cambiar después:

- un **repositorio** en GitHub, organizado en capas (un _monorepo_);
- las **herramientas** que revisan todo en cada cambio: tipos, linter, formato, pruebas sin pantalla, pruebas en un navegador;
- este **sitio**, que se publica solo cada vez que el código pasa todas las verificaciones;
- las **decisiones** de arquitectura, escritas con su porqué;
- y un núcleo mínimo: un **mundo** que avanza de a pasos fijos, un **cartucho** (el Dojo) que pone un cubo en ese mundo, y una **presentación** que lo dibuja.

Vas a entender:

- Por qué la simulación y lo que se ve están **separados**, y cómo lo vigila el **compilador**.
- Qué es un **paso fijo** y por qué se dibuja "a mitad de camino" (interpolar).
- Qué es el **azar con semilla**, y la **huella** de un mundo.
- Por qué el estado son **datos planos**.
- Cómo se trabaja con **git**: ramas, _pull requests_, commits, etiquetas, integración continua.

| Archivo                                                                                                                                                                                                                                               | Qué contiene                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| [`paquetes/comun/src/azar.ts`](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/paso-00/paquetes/comun/src/azar.ts)                                                                                                                            | El azar con semilla (SFC32)                    |
| [`paquetes/comun/src/matematica.ts`](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/paso-00/paquetes/comun/src/matematica.ts)                                                                                                                | Vectores y cuaterniones como tuplas            |
| [`paquetes/nucleo/src/mundo.ts`](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/paso-00/paquetes/nucleo/src/mundo.ts)                                                                                                                        | El mundo: reloj, ids, azar, entidades, eventos |
| [`paquetes/nucleo/src/partida.ts`](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/paso-00/paquetes/nucleo/src/partida.ts) y [`cartucho.ts`](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/paso-00/paquetes/nucleo/src/cartucho.ts) | Un mundo y el juego que lo juega               |
| [`paquetes/nucleo/src/reloj.ts`](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/paso-00/paquetes/nucleo/src/reloj.ts)                                                                                                                        | El paso fijo                                   |
| [`paquetes/nucleo/src/huella.ts`](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/paso-00/paquetes/nucleo/src/huella.ts)                                                                                                                      | Un número que resume el mundo entero           |
| [`paquetes/presentacion/src/cliente.ts`](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/paso-00/paquetes/presentacion/src/cliente.ts)                                                                                                        | Dibujar el mundo con Three.js                  |
| [`juegos/dojo/src/cartucho.ts`](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/paso-00/juegos/dojo/src/cartucho.ts)                                                                                                                          | El Dojo: un cubo que gira                      |

---

## 1. Por qué una segunda versión, y por qué de cero

La primera versión fue un shooter que creció durante unos treinta pasos. Aprendimos mucho, y varias veces hubo que frenar para rehacer cimientos: separar la simulación de la pantalla, sacar las reglas del juego del motor, darle a cada simulación su propio azar.

Esta versión se escribe **de cero**. No se copia código de la anterior: se traen sus **lecciones**, la mayoría medidas, y se vuelven reglas desde el primer día. Están escritas en la [decisión 0000](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisiones/0000-por-que-la-v2.md), junto con lo que se tomó y lo que no de dos borradores de arquitectura.

## 2. Tres capas

```
juegos/dojo  ──usa──►  paquetes/presentacion  ──usa──►  paquetes/nucleo  ──usa──►  paquetes/comun
   (reglas)               (lo que se ve)                  (la simulación)           (azar, matemática)
```

Las flechas van **siempre hacia adentro**. El núcleo no sabe que existe una pantalla, ni a qué se juega. Así, la misma simulación corre en el navegador, en las pruebas (sin pantalla) y, más adelante, en un servidor.

¿Quién lo vigila? Tres guardias ([decisión 0003](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisiones/0003-fronteras.md)):

1. **El compilador.** El núcleo compila **sin la librería del navegador** (`"lib": ["ES2023"]`). Si escribes `document` en la simulación, **no compila**.
2. **El linter.** Prohíbe importaciones: el núcleo no importa Three.js ni un juego, y un juego no importa otro.
3. **Las dependencias:** el `package.json` del núcleo no tiene a Three.js.

En la primera versión, esa frontera la cuidaba una prueba que buscaba palabras en el código. Funcionaba, pero llegaba tarde y se confundía con los comentarios.

## 3. El mundo, el paso fijo y la interpolación

Un **mundo** es todo el estado de una simulación: su reloj (`tick`), su contador de ids, su azar y sus entidades. **Nada vive afuera.** En la primera versión, el contador de ids era uno solo para todo el programa, y dos simulaciones juntas (un servidor y un cliente en una prueba, o una partida y su repetición) se robaban números.

El mundo avanza de a **pasos fijos** de 1/60 de segundo, no al ritmo de la pantalla. La pantalla dibuja cuando puede (60, 30 o 144 veces por segundo), y un **reloj** junta el tiempo real y dice cuántos pasos enteros tocan:

```
tiempo real:  |--16 ms--|--33 ms (un cuadro lento)--|--8 ms--|
pasos:            1                2                    0 o 1
```

Lo que sobra queda para el cuadro siguiente. Para que no se vea a saltos, la presentación dibuja cada cosa **entre su pose del paso anterior y la actual**, según cuánto del paso siguiente ya pasó (`alfa`). Eso es **interpolar**.

Un detalle: si la pestaña estuvo dormida diez segundos, el reloj no intenta dar 600 pasos de golpe (trabaría todo: la "espiral de la muerte"). Da como mucho cinco y descarta el resto.

## 4. Entidades como datos

Una **entidad** es un id y sus **componentes**: objetos planos de números. El cubo del Dojo es:

```ts
{
  id: 1,
  transformacion: { posicion: [0, 1, 0], rotacion: [0, 0, 0, 1] },
  giro: { velocidadAngular: [0.35, 0.9, 0.15] },
  apariencia: { forma: 'caja', tamano: [1, 1, 1], color: 0xe0a040 },
}
```

Sin clases, sin métodos, sin objetos de Three.js. ¿Por qué tanto cuidado? Porque así **el mundo se puede fotografiar**: copiar, comparar, guardar, mandar por la red, volver atrás. En la primera versión eso quedó pendiente porque el estado estaba repartido en objetos ([decisión 0004](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisiones/0004-estado-como-datos.md)).

La rotación es un **cuaternión** `[x, y, z, w]`: cuatro números que representan un giro sin los problemas de los ángulos (el "bloqueo de cardán"). El sistema de giro, en cada paso, multiplica la rotación por el giro de ese paso: un ángulo de |ω|·Δt alrededor del eje de la velocidad angular ω. Después **renormaliza**: multiplicar miles de veces acumula redondeo, y un cuaternión que deja de medir 1 empieza a deformar lo que rota.

## 5. Azar con semilla y la huella

Todo el azar que cambia el mundo sale de un **generador con semilla**: la misma semilla da siempre la misma secuencia. El nuestro es **SFC32**: cuatro números de 32 bits que cada llamada mezcla con sumas, desplazamientos y rotaciones de bits. Uno de los cuatro es un contador que solo crece, y garantiza que la secuencia no caiga en un ciclo corto. La semilla (un número) se reparte en los cuatro con **SplitMix32**: así, semillas vecinas (1, 2, 3) dan secuencias que no se parecen.

¿Cómo sabemos que dos mundos con la misma semilla hacen **exactamente** lo mismo? Con su **huella**: un número de 32 bits que resume todo el estado. Se calcula con **FNV-1a** sobre los **bytes** de cada número, así que `0,1 + 0,2` y `0,3` (que en coma flotante no son iguales) dan huellas distintas. Las pruebas comparan la huella de dos mundos **en cada paso**: si algún día se separan, sabremos en cuál.

## 6. El cartucho: el motor no sabe a qué se juega

El motor recibe un **cartucho**: un objeto que dice qué hay en el mundo al empezar (`alIniciar`) y qué significa lo que pasa (`alAvanzar`, con los eventos de cada paso). El Dojo es el primero, y existe **desde el primer día**: es la manera de usar el motor desde afuera y darse cuenta enseguida si algo es incómodo.

Los eventos tienen **dos lectores**: el juego los lee de a un paso, y la presentación de a un cuadro. Si en un cuadro se dan dos pasos, la presentación tiene que ver los eventos de los dos: por eso el mundo guarda dos listas.

## 7. Cómo se trabaja: git y GitHub

Todo el proyecto vive en un **repositorio git**, publicado en [GitHub](https://github.com/RodrigoMartinVG/Manifold_Gaming) ([decisión 0005](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisiones/0005-forma-de-trabajo.md)):

- **Un commit** es una foto del proyecto con un mensaje que dice qué cambió. Los mensajes siguen una convención: `feat(nucleo): gravedad como campo radial`, `fix(dojo): ...`, `docs(tutorial): ...`.
- **`main`** es la rama principal y **siempre anda**. Cada paso del motor se hace en su propia **rama** (`paso/01-...`) y entra a `main` por un **pull request**: una propuesta de cambio que se puede revisar y discutir.
- **La integración continua** (GitHub Actions) revisa cada pull request en una computadora limpia: tipos, linter, formato, pruebas sin pantalla, y el sitio armado y abierto en un navegador. Si algo falla, no entra.
- Cuando `main` pasa, **el sitio se publica solo** en GitHub Pages.
- Al terminar cada paso se pone una **etiqueta** (`paso-00`, `paso-01`...). Los enlaces de los capítulos apuntan al código de su etiqueta: lo ves tal como estaba en ese paso, aunque el proyecto haya seguido creciendo.

:::note[Después de la etapa 0]
Desde la [etapa 0c](../etapa-0c/) ya no se usan ramas ni _pull requests_: se trabaja directo en `main`, verificando todo antes en la máquina, y GitHub sigue verificando cada cambio antes de publicar el sitio ([decisión 0009](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisiones/0009-directo-en-main.md)). Lo demás sigue igual: los commits, la integración continua y las etiquetas.
:::

## 8. Las herramientas

| Para qué                | Qué                                                         |
| ----------------------- | ----------------------------------------------------------- |
| La versión de Node      | **mise** (lee `mise.toml`: Node 24)                         |
| Los paquetes            | **npm**, con _workspaces_: un solo `npm install` para todo  |
| El lenguaje             | **TypeScript** 6.0                                          |
| Compilar y servir       | **Vite**, a través de **Astro** (el sitio)                  |
| Pruebas sin pantalla    | **Vitest**: archivos `*.prueba.ts` junto al código          |
| Pruebas en el navegador | **Playwright**: abre las páginas como una persona           |
| Estilo                  | **ESLint** (que además vigila las fronteras) y **Prettier** |

:::note[Después de la etapa 0]
Desde la [etapa 0c](../etapa-0c/), el proyecto usa **Node 26**, que en octubre de 2026 pasó a ser la versión con soporte a largo plazo; la 24 quedó en mantenimiento ([decisión 0001](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisiones/0001-monorepo-y-herramientas.md)).
:::

```bash
npm run dev         # el sitio y el Dojo, con recarga en caliente
npm run verificar   # tipos, linter, formato y pruebas
npm run e2e         # el sitio armado, probado en Chromium
```

---

## Los hallazgos

| Hallazgo                               | Qué pasaba                                                                                                                                                                                                                                                                                  | Arreglo                                                                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TypeScript 7 todavía no**            | La 7 (reescrita en Go) ya salió, pero el linter y el chequeo de Astro aceptan hasta la 6.0                                                                                                                                                                                                  | TypeScript 6.0, revisar más adelante                                                                                                                |
| **Node 20 sin soporte**                | Dejó de tener actualizaciones de seguridad en abril de 2026                                                                                                                                                                                                                                 | Node 24, fijado por proyecto con mise                                                                                                               |
| **Una instalación cortada a la mitad** | La instalación se interrumpió y dejó paquetes incompletos. Reinstalar encima no los reparó, y el archivo de versiones (`package-lock.json`) quedó armado sobre esa instalación rota                                                                                                         | Borrar `node_modules` **y** el archivo de versiones, e instalar de cero                                                                             |
| **El "ángulo girado" de una prueba**   | 5 s girando a 0,99 rad/s son 4,95 rad, pero el ángulo entre dos rotaciones es siempre el camino más corto (de 0 a π): 2π − 4,95                                                                                                                                                             | La prueba compara con el camino más corto                                                                                                           |
| **Cada cubo, dibujado dos veces**      | Ninguna prueba lo vio: se notó **mirando**. La presentación creaba las mallas recorriendo el mundo al montarse, y otra vez por el evento `entidadCreada` que había quedado pendiente. La segunda tapaba a la primera en el registro, y la primera quedaba en la escena, quieta en el origen | Una malla por entidad. Y la prueba del navegador ahora **cuenta las mallas de la escena**: sin el arreglo, ve 2 donde hay 1 cubo, y 42 donde hay 21 |
| **El servidor de prueba "terminaba"**  | Fuera de una terminal, `astro preview` (Astro 7) se va solo a segundo plano, y Playwright creía que se había cerrado                                                                                                                                                                        | Las pruebas sirven el sitio armado con `vite preview`, que se queda en primer plano                                                                 |

---

## 🔬 Experimentos

1. Abre el [Dojo](../../jugar/dojo/) y agrega `?cubos=30` a la dirección. Recarga: los mismos cubos, en los mismos lugares. Ahora agrega `&semilla=2`.
2. En `paquetes/nucleo/src/mundo.ts`, escribe `document.title = 'hola'` dentro de `paso()` y corre `npm run check`. ¿Qué dice el compilador?
3. En `juegos/dojo/src/cartucho.ts`, importa `three` y corre `npm run lint`.
4. En la prueba de determinismo (`mundo.prueba.ts`), cambia la semilla de un solo mundo: ¿en qué paso fallan las huellas?

---

## 🧠 Autoevaluación

<details>
<summary>1. ¿Por qué el núcleo compila sin la librería del navegador?</summary>

Para que el compilador mismo impida usar la pantalla desde la simulación: escribir `document` o `window` en el núcleo no compila. Así la simulación corre igual en el navegador, en las pruebas y en un servidor.
</details>

<details>
<summary>2. ¿Qué es `alfa`, y para qué lo usa la presentación?</summary>

Cuánto del paso siguiente ya pasó (entre 0 y 1). La presentación dibuja cada cosa entre su pose del paso anterior y la actual según `alfa`, para que el movimiento se vea suave aunque la pantalla vaya a otro ritmo que la simulación.
</details>

<details>
<summary>3. ¿Por qué el estado son datos planos y no objetos con métodos?</summary>

Para poder fotografiar el mundo: copiarlo, compararlo, guardarlo, mandarlo por la red o volver atrás sin convertir nada.
</details>

<details>
<summary>4. ¿Qué detecta la huella que no detectaría comparar "a ojo"?</summary>

Cualquier diferencia, hasta la de un redondeo en el último decimal: la huella se calcula sobre los bytes de cada número. Y comparándola en cada paso, se sabe en qué paso se separaron dos simulaciones.
</details>

<details>
<summary>5. ¿Por qué los eventos tienen dos listas?</summary>

Porque tienen dos lectores a dos ritmos: el juego, de a un paso, y la presentación, de a un cuadro. Si en un cuadro hay dos pasos, la presentación tiene que ver los eventos de los dos.
</details>

---

## 🎯 Reto

Que el Dojo acepte `?cubos=N` para agregar N cubos con lugares, tamaños, colores y giros **al azar**, y que con la misma `?semilla=` sean **siempre los mismos**.

---

## ✅ Solución del reto

- El cartucho lee la opción `cubos` (las opciones son los parámetros de la dirección: el motor no sabe cuáles existen, cada juego entiende los suyos).
- Cada número sale de **`mundo.azar`**, nunca de `Math.random()`: el azar del mundo tiene semilla.
- Un valor que no es un número (`?cubos=muchos`) no rompe nada: se toma como 0, y hay un máximo de 200.

**Prueba:** dos partidas con semilla 7 y `cubos=10` tienen 11 entidades y la misma huella; con semilla 8, otra huella.

> Este reto muestra la regla más importante del motor: el azar que cambia el mundo **siempre** sale del mundo. El azar puramente visual (por ejemplo, las chispas) puede seguir usando `Math.random()`: si dos personas ven chispas distintas, no importa.

---

## 📖 Glosario del paso

| Término                          | Significado                                                                                    |
| -------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Monorepo**                     | Un solo repositorio con varios paquetes que se usan entre sí.                                  |
| **Paso fijo**                    | La simulación avanza siempre de a 1/60 s, sin importar los cuadros por segundo de la pantalla. |
| **Interpolar**                   | Dibujar a mitad de camino entre el paso anterior y el actual.                                  |
| **Entidad / componente**         | Una cosa del mundo (un id) y sus datos (dónde está, cómo gira, cómo se ve).                    |
| **Cuaternión**                   | Cuatro números que representan una rotación, sin el bloqueo de cardán de los ángulos.          |
| **Semilla**                      | El número inicial de un generador de azar: la misma semilla da la misma secuencia.             |
| **Huella**                       | Un número que resume todo el estado de un mundo.                                               |
| **Cartucho**                     | Un juego, tal como el motor lo recibe: qué hay al empezar y qué significa lo que pasa.         |
| **Commit / rama / pull request** | Una foto del proyecto; una línea de trabajo; una propuesta para sumarla a la principal.        |
| **Integración continua**         | Una computadora que revisa todo en cada cambio.                                                |
