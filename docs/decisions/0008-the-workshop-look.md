# 0008. La estética del sitio: el taller

- **Estado:** aceptada
- **Fecha:** 2026-11-11

## Contexto

El sitio usaba el aspecto de fábrica de Starlight: correcto, pero igual al de miles de documentaciones. Manifold Gaming es otra cosa: un laboratorio donde la matemática (campos, cuaterniones, pasos de integración) es la materia prima. Se buscó una estética que junte lo sofisticado y técnico con lo arcano de la matemática: metal, instrumentos, construcciones con compás.

Hay tres condiciones:

- **Que se lea bien.** El sitio es sobre todo un tutorial: el estilo no puede competir con el texto ni con el código.
- **Que ande en una máquina modesta** (la de desarrollo tiene una gráfica integrada Iris Plus).
- **Que sea original:** nada de imágenes, marcas ni recursos copiados.

## Decisión

- **La paleta.** Bronce y cobre para marcos y títulos; pátina (el verde del cobre viejo) como acento de enlaces y botones secundarios; carbón cálido de fondo. El modo claro es pergamino con tinta sepia. Todo está en `sitio/src/estilos/taller.css`, que redefine los colores de Starlight y agrega los propios (con prefijo `--mg-`).
- **La letra.** Cinzel (licencia OFL, servida desde el propio sitio con `@fontsource`, sin pedidos a terceros) solo para títulos. El texto sigue con la letra del sistema, que es la que mejor se lee en pantalla.
- **Los dibujos se hacen con código.** `sitio/scripts/dibujar.mjs` genera los SVG con geometría exacta: el fondo, la marca (un engranaje con una lemniscata) y dos engranajes que engranan de verdad (mismo módulo; el CSS los gira con velocidades en razón inversa al número de dientes).
- **El fondo dice cosas verdaderas.** Las construcciones (rectángulo áureo, astrolabio, una órbita con su foco, el triángulo del compás) y las fórmulas son las del proyecto: `g = −GM r̂ / r²`, el paso de Euler semi-implícito (con sus puntos por debajo de la parábola exacta: el error del paso), el cuaternión, el generador con semilla, la huella FNV-1a, la cinta de Möbius.
- **El fondo es una máscara.** Una capa fija detrás de todo deja pasar un color solo donde hay trazo, así el mismo SVG sirve en los dos modos, y no se repinta al bajar. En el inicio se ve más; en las lecciones, apenas.
- **El inicio tiene una vitrina 3D en vivo** en vez de una imagen: un pozo de potencial con tres cuerpos en órbita. Su física (`sitio/src/vitrina/orbitas.ts`) es la misma que se dibuja, y está probada: en diez minutos ningún cuerpo se escapa ni choca, y la energía no deriva (con Euler explícito, la prueba falla). Three.js se pide después de que la página se dibuja, con un `import()` dinámico. La vitrina se detiene cuando no se ve, y respeta "reducir movimiento".
- **Lo que se usa para trabajar queda sobrio.** El editor y el resultado de los ejemplos siguen oscuros y limpios (One Dark con fondo cálido); el marco de bronce queda afuera.

## Consecuencias

- El sitio tiene una identidad propia, y los dibujos se pueden regenerar o cambiar con código (`npm run dibujar -w sitio`).
- El inicio pesa más: Three.js (unos 130 KB comprimido) llega en un segundo pedido, después de que la página ya se ve. Es el mismo archivo que usa el Dojo, así que el navegador lo guarda una sola vez.
- Cada versión nueva de Starlight puede cambiar nombres de clases. Si un estilo deja de aplicarse, el lugar donde mirar es `taller.css`, que nombra cada componente que toca.

## Alternativas descartadas

- **Una imagen de fondo pintada** (como el boceto que inspiró esto): pesa, el texto encima se lee peor, y sus letras y números serían decorado sin sentido.
- **Marcos metálicos en todo:** cansa la vista y compite con el contenido; el metal quedó para lo que se señala (la marca, el título, las tarjetas, los botones principales, la vitrina y los marcos de los ejemplos).
- **Una letra con serifa para todo el texto:** más "antigua", pero se lee peor en pantalla en párrafos largos.
