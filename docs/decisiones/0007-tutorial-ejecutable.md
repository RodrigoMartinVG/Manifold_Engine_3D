# 0007. El tutorial ejecutable y la bitácora

- **Estado:** aceptada (modifica la forma de los "capítulos" de 0002 y 0005)
- **Fecha:** 2026-11-11

## Contexto

La primera idea era un tutorial con un capítulo largo por etapa: todo lo que hicimos, con hallazgos, mediciones, autoevaluación y glosario. El autor lo descartó: repetir con detalle lo que hacemos es pesado, y para eso ya están el repositorio y los informes. Lo que se quiere es **aprender la tecnología tocándola**: cada idea pegada a un código chico que corre en la página, muestra algo y se puede cambiar.

## Decisión

**Dos secciones en el sitio:**

| Sección      | Qué es                                                                                                                                       | Dónde                                                                                              |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Tutorial** | Lecciones cortas que acompañan cada etapa, simplificadas: una idea, un código ejecutable, sus sutilezas y un enlace a "así lo hace Manifold" | `sitio/src/content/docs/tutorial/<etapa>/` y su código en `sitio/src/lecciones/<etapa>/<lección>/` |
| **Bitácora** | El informe de cada etapa: qué hicimos, hallazgos, mediciones, decisiones                                                                     | `sitio/src/content/docs/bitacora/`                                                                 |

**El ejecutor** (`<CodigoVivo leccion="..." />`, en `sitio/src/components/` y `sitio/src/codigo-vivo/`):

- **Editor:** CodeMirror 6, una pestaña por archivo de la lección (para mostrar cómo se separa en módulos). Ejecutar: ▶ o Ctrl/⌘ + Enter. ↺ vuelve al original.
- **TypeScript de verdad.** Sucrase le saca los tipos en el navegador (conserva los números de línea). La revisión de tipos la hace el compilador en el repositorio: las lecciones son archivos `.ts` reales, revisados por `astro check` y por el linter.
- **Aislado:** el código corre en un iframe `sandbox="allow-scripts"`, sin `allow-same-origin`. Tiene otro origen: no puede leer nada del sitio, y un error suyo no rompe la página. Se comunican con `postMessage`.
- **Librerías:** las mismas versiones que el motor. `sitio/scripts/vendor.mjs` arma, al compilar, un archivo por librería (Three.js, OrbitControls, lil-gui), sin importaciones relativas. La página se los pasa al iframe, que los vuelve módulos `blob:` con un **mapa de importaciones**. Los archivos de la lección se llaman `leccion/<nombre>` en ese mapa (un `blob:` no tiene carpeta contra la cual resolver `./`).
- **Uno a la vez:** al ejecutar un ejemplo, el que corría se detiene y su iframe se borra (cada uno usa un contexto WebGL).
- **El resultado va arriba del código.** Lo que se ve es lo primero que encuentra el lector. Además, Chrome no le da cuadros a un iframe de otro origen que está fuera de la pantalla (medido: 0 cuadros), así que abajo de un editor largo no se veía nada.
- **Probadas:** las pruebas en el navegador (`e2e/tutorial.e2e.ts`) ejecutan cada ejemplo de cada página del tutorial y exigen que dibuje (o escriba en la consola) sin errores. Si una actualización rompe una lección, falla el pull request.

**Ritmo:** el tutorial va un poco detrás del motor. Una lección se escribe cuando la idea de su etapa ya se estabilizó.

## Consecuencias

- Las lecciones no se pudren: compilan, pasan el linter y se ejecutan en cada cambio.
- Casi siempre son independientes del motor (usan las librerías directamente); las que enseñan a _usar_ el motor importarán `@manifold/...` (habrá que agregarlo al armado de librerías).
- Un bucle infinito en el código del lector puede colgar la pestaña: un iframe del mismo proceso comparte el hilo. Se puede mitigar más adelante (un tiempo límite, o un iframe en otro proceso).
- Una lección con Rapier necesita agregarlo a `vendor.mjs` (su archivo trae el WebAssembly adentro: unos 2 MB, que se piden solo al ejecutar).

## Alternativas descartadas

- **Capítulos largos por etapa** (la primera versión): pesado, y repetía el repositorio.
- **Sandpack o StackBlitz:** editores ejecutables llave en mano, pero dependen de servicios externos y son pesados.
- **Un iframe del mismo origen** con una página de ejecución: más simple (el navegador cachea los módulos), pero el código del lector tendría acceso al sitio.
