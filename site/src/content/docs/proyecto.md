---
title: El proyecto
description: Qué es Manifold Gaming, de dónde viene y cómo está pensado.
---

**Manifold Gaming** es un laboratorio de mundos físicos en 3D para la web: un motor propio escrito en TypeScript (con [Three.js](https://threejs.org) para dibujar y [Rapier](https://rapier.rs) para la física), un **Dojo** donde experimentar con él, **juegos** construidos encima, un **tutorial** con código que se ejecuta en la página y una **bitácora** con el informe de cada etapa.

El nombre viene de la matemática: una _manifold_ (en castellano, _variedad_) es un espacio que, mirado de cerca, parece plano, aunque en grande sea curvo, retorcido o tenga una sola cara, como la cinta de Möbius. Es lo que este motor quiere tratar como caso normal: que el "abajo" cambie de lugar en lugar. Y **Gaming**, porque es una plataforma para hacer y jugar juegos: no es un motor de física ni de dibujo (eso lo hacen [Rapier](https://rapier.rs) y [Three.js](https://threejs.org), sobre los que está construido), ni una herramienta de diseño.

## De dónde viene

Manifold Gaming es la **segunda versión**. La primera fue un shooter que creció paso a paso (física, armas, una hormiga que trepa por las paredes, autos, una cinta de Möbius, red, mecanismos, luz, inteligencia artificial, repeticiones, tres juegos sobre el mismo motor). De ella no se copia código: se traen **lecciones**, muchas medidas, que ahora son reglas desde el primer día. Están escritas, con sus números, en la [decisión 0000](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0000-why-a-v2.md).

## Cómo está pensado

Tres capas, y las dependencias apuntan siempre hacia adentro:

| Capa                                       | Qué hace                                                  | Qué no sabe                               |
| ------------------------------------------ | --------------------------------------------------------- | ----------------------------------------- |
| **Núcleo** (`packages/core`)               | Simula el mundo: su paso fijo, sus entidades, sus eventos | Que existe una pantalla, o a qué se juega |
| **Presentación** (`packages/presentation`) | Dibuja y hace sonar lo que el núcleo simula               | Las reglas de ningún juego                |
| **Juegos** (`games/`)                      | Dicen qué hay en el mundo y qué significa lo que pasa     | Cómo funciona la física por dentro        |

Y unas reglas que no se negocian:

- **Todo el estado vive en el mundo**, como datos: se puede fotografiar, comparar y repetir.
- **La simulación no toca la pantalla.** No lo vigila una costumbre: lo vigila el compilador.
- **El motor no conoce a los juegos.** Recibe un _cartucho_ (_cartridge_) y le avisa lo que pasa.
- **Determinismo medido:** cada paso tiene una _huella_ (_hash_), y dos simulaciones iguales tienen que dar la misma, paso por paso.
- **El Dojo existe desde el primer día**, para usar el motor desde afuera y descubrir rápido lo que no se entiende.
- **Medir antes de afirmar:** un número de rendimiento sin su escenario no vale.

## En qué etapa está

| Fase                      | Qué trae                                                                        | Cómo se demuestra                                        |
| ------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **0. Cimientos** ← _aquí_ | El repositorio, las herramientas, este sitio, las decisiones y un núcleo mínimo | Un cubo que gira en el Dojo, calculado por la simulación |
| 1. Núcleo vertical        | Física, gravedad como campo, un personaje, la red desde temprano                | Caminar alrededor de un planeta                          |
| 2. Capacidades            | Trepar, volar, agarrar, componer capacidades                                    | Prender y apagar capacidades en vivo                     |
| 3. Un mundo que responde  | Mecanismos, señales, cosas que se rompen, luz                                   | Romper una lámpara cambia lo que ve un guardia           |
| 4. Combate e inteligencia | Armas, navegación que usa el mundo                                              | Un guardia que llama al ascensor                         |
| 5. Juegos                 | Juegos completos sobre el motor                                                 | Juegos en este sitio                                     |
| 6. Red y autoría          | Partidas en red, editor de niveles                                              |                                                          |

El código está en [GitHub](https://github.com/RodrigoMartinVG/Manifold_Gaming). Las decisiones importantes, con su porqué, están en [`docs/decisions`](https://github.com/RodrigoMartinVG/Manifold_Gaming/tree/main/docs/decisions).

## Los idiomas

El sitio está en español: el tutorial, la Bitácora y todo lo que explica o informa (más adelante, también en inglés). **Todo lo demás está en inglés**: el código, sus comentarios, los nombres de archivos y carpetas, las pruebas, la consola del Dojo y sus recetas, las decisiones y los mensajes de cada cambio. Es lo que se usa en la industria del software, y así el proyecto se puede compartir con cualquiera sin una nomenclatura mezclada. Lo cuenta la [decisión 0011](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisions/0011-languages.md), y el [glosario](../tutorial/glosario/) junta las palabras de los dos idiomas.
