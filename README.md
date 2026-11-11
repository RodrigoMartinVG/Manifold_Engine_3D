# Manifold

**Un laboratorio de mundos físicos en 3D para la web.** Un motor propio (TypeScript, [Three.js](https://threejs.org), [Rapier](https://rapier.rs)) donde la gravedad es un campo, las cosas se componen de capacidades y lo que pasa se puede repetir; un **Dojo** para experimentar con él; **juegos** encima; y un **tutorial** que se escribe a medida que el motor crece.

🌐 **Sitio:** https://rodrigomartinvg.github.io/Manifold_Engine_3D/

> Estado: **fase 0** (cimientos). El Dojo tiene un cubo que gira, calculado por la simulación.

## Cómo está organizado

```
paquetes/comun          azar con semilla y matemática sobre datos planos
paquetes/nucleo         la simulación: el mundo, su paso fijo, sus eventos (sin pantalla)
paquetes/presentacion   lo que se ve: Three.js
juegos/dojo             el primer juego (el laboratorio)
sitio                   la web: inicio, el proyecto, el tutorial, jugar (Astro + Starlight)
docs/decisiones         las decisiones de arquitectura, con su porqué
e2e                     pruebas en un navegador de verdad (Playwright)
```

Las capas solo dependen hacia adentro: el núcleo no conoce a la presentación ni a los juegos. Lo vigilan el compilador y el linter ([decisión 0003](docs/decisiones/0003-fronteras.md)).

## Para trabajar

Hace falta [mise](https://mise.jdx.dev) (o Node 24).

```bash
mise install          # Node 24, el de este proyecto
npm install
npm run dev           # el sitio y el Dojo, con recarga en caliente
```

| Comando                 | Qué hace                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| `npm run dev`           | El sitio en http://localhost:4321/Manifold_Engine_3D/                                     |
| `npm run verificar`     | Tipos, linter, formato y pruebas sin pantalla                                             |
| `npm run pruebas:mirar` | Las pruebas, que se vuelven a correr al guardar                                           |
| `npm run e2e`           | Arma el sitio y lo prueba en Chromium (la primera vez: `npx playwright install chromium`) |
| `npm run build`         | El sitio listo para publicar, en `sitio/dist`                                             |

Cómo se trabaja (ramas, PR, commits, etiquetas por paso): [decisión 0005](docs/decisiones/0005-forma-de-trabajo.md). Todas las decisiones: [docs/decisiones](docs/decisiones/README.md).

## De dónde viene

Es la segunda versión de un motor que creció paso a paso como un shooter. De esa versión no se copia código: se traen lecciones, escritas con sus números en la [decisión 0000](docs/decisiones/0000-por-que-la-v2.md).
