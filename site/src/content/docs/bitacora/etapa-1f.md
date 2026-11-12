---
title: 'Etapa 1f: el cierre de la fase 1'
description: 'Una regla que no deja entrar a la simulación lo que cada navegador calcula a su manera, las vistas de física que faltaban, y las cinco lecciones de la fase, con Rapier en los ejemplos en vivo. Con esto se cierra la fase 1.'
sidebar:
  order: 13
---

> Informe de la etapa 1f, la última de la fase 1. Con ella se cierra la fase: lo que la fase 2 necesita ya está, y el tutorial cuenta lo que se hizo.

## Qué hicimos

- **Una regla del linter para que la simulación dé los mismos bits en todos lados.** El estándar de JavaScript exige que `Math.sqrt`, las cuentas, `Math.round` o `Math.floor` den exactamente lo mismo en todos los navegadores. Pero deja que `Math.sin`, `cos`, `atan2`, `hypot`, `exp` y `pow` (y `**`) se calculen "aproximados por cada implementación". En el núcleo, en la red y en las reglas de cada juego, ahora están prohibidos, igual que `Math.random` y `quat.fromAxisAngle`. Las pruebas sí pueden usarlos: comparan, no simulan.
- **La regla encontró los dos últimos usos:** el giro de los objetos sin cuerpo físico usaba `hypot`, seno y coseno en cada paso. Ahora gira sin trigonometría, con el mismo truco que el personaje: un cuaternión de giro chico, `[ω·dt/2, 1]`, llevado a largo 1.
- **El laboratorio de física que la decisión 0010 había prometido para esta etapa:**
  - `show.vectors`: la velocidad de cada cuerpo que se mueve, y hacia dónde mira cada personaje;
  - `show.contacts`: dónde se tocan los cuerpos, con la normal de cada contacto, leídos de Rapier a través de la frontera con la física;
  - `show.gravity`: el campo de gravedad, como flechas.
- **Rapier en los ejemplos en vivo**, el mismo que usa el motor. Pesa 4,4 MB (1,7 MB comprimido), porque su WebAssembly viaja adentro. Por eso el ejecutor de ejemplos ahora baja solo las librerías que importa cada lección: las de la etapa 0 no lo esperan.
- **Las cinco lecciones de la fase 1**, que se debían desde la 1a:
  1. [Un motor de física](../../tutorial/etapa-1/00-motor-de-fisica/);
  2. [Un personaje](../../tutorial/etapa-1/01-un-personaje/);
  3. [Repeticiones y fantasmas](../../tutorial/etapa-1/02-repeticiones/);
  4. [Instantáneas](../../tutorial/etapa-1/03-instantaneas/);
  5. [Un servidor y un cliente](../../tutorial/etapa-1/04-servidor-y-cliente/).

## Hallazgos

| Hallazgo                                | Qué pasaba                                                                                                                                                                                                                                                                 | Qué hicimos                                                                                                                                                                                                                     |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Trigonometría escondida en el paso**  | El giro de los objetos sin cuerpo usaba `hypot`, seno y coseno. Las pruebas entre navegadores no lo veían porque el Dojo no lo usa: su cubo gira con Rapier. Un juego que hiciera girar un adorno habría dado otra huella en otro navegador                                | La regla del linter lo encontró, y gira sin trigonometría. Con un archivo de prueba, la regla marca `Math.sin`, `**`, `Math.random` y `quat.fromAxisAngle`, y deja pasar `Math.sqrt`                                            |
| **Correr sin errores no es funcionar**  | Las pruebas del tutorial comprueban que cada ejemplo corra sin errores. Una lección pasaba, y no mostraba nada: el empujón a la pelota era diez veces demasiado para sus 270 gramos, y la pelota se iba volando del piso. Lo mostró una captura de pantalla, no una prueba | El empujón quedó realista, con paredes bajas alrededor. Y unas pruebas nuevas leen los paneles de las lecciones, como un lector: que el fantasma dé la misma huella, que el gemelo siga igual, que la desincronización aparezca |
| **Lo que no se usa, desaparece**        | La prueba de "qué librerías importa una lección" fallaba con un ejemplo inventado: al quitar los tipos, Sucrase borra los `import` que no se usan (como TypeScript), y en el ejemplo no se usaba ninguno                                                                   | El ejemplo los usa. Las lecciones reales siempre usan lo que importan                                                                                                                                                           |
| **Bajar solo lo necesario, comprobado** | Que las lecciones de la etapa 0 no bajen Rapier no se nota mirando: corren igual                                                                                                                                                                                           | Una prueba mira los pedidos de red: la etapa 0 baja Three.js y no Rapier; la etapa 1 baja Rapier. Si el ejecutor bajara todo, falla                                                                                             |

## Medido

- **Las librerías del tutorial:** Rapier pesa 4,4 MB, 1,7 MB comprimido como lo sirve GitHub Pages. Three.js, 0,9 MB y 200 KB.
- **Las pruebas:**
  - sin pantalla, 107 (2 nuevas: los contactos de una caja apoyada, y qué librerías importa una lección);
  - en el navegador, 76: 64 en Chromium (10 nuevas: las cinco lecciones corren, tres comprueban lo que muestran, qué se baja, y el laboratorio de física) y las 6 de física en Firefox y en WebKit.

## La fase 1, cerrada

Lo que la fase 1 deja para las siguientes:

- **La física:** Rapier, en su versión determinista, detrás de una frontera chica, con la misma huella en Chromium, Firefox, WebKit y Node.
- **Un personaje** que se maneja con el teclado o con un mando, de dos maneras, con cuatro cámaras. Es el que van a compartir los tres juegos clásicos.
- **Repeticiones y fantasmas por enlace**, con su versión.
- **Instantáneas** que vuelven exactas.
- **El esqueleto de la red**, por el que juegan todos los juegos, aunque se juegue solo.
- **Lo que pide un jugador, ampliable por cada juego**, y una regla que cuida que todo dé igual en todos lados.
- **Las ocho entradas de la Bitácora de la fase y sus cinco lecciones** que cuentan cómo se hizo.

## Lo que sigue

La fase 2. Empieza por el juego de plataformas como juego, no como recorrido:

- niveles como datos;
- zonas que notan quién entra;
- el ciclo de un nivel: los puntos de control, caerse y volver, la meta.

Antes del modelo del personaje hay que decidir de dónde salen el arte y el sonido.
