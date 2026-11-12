---
title: 'Etapa 0c: el taller y el tutorial con contexto'
description: 'Antes de la física: el sitio tomó su forma (la estética del taller, la vitrina 3D, los ejemplos a todo el ancho) y el tutorial, su contexto. Lo que hicimos, lo que encontramos y lo que medimos.'
sidebar:
  order: 2
---

> Informe de la etapa 0c: lo que se hizo después del [tutorial ejecutable](../etapa-0b/) y antes de empezar con la física. Las decisiones de esta etapa son la [0008](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisiones/0008-la-estetica-del-taller.md) (la estética), la [0009](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisiones/0009-directo-en-main.md) (directo en `main`) y un cambio en la [0001](https://github.com/RodrigoMartinVG/Manifold_Gaming/blob/main/docs/decisiones/0001-monorepo-y-herramientas.md) (Node 26).

## Qué hicimos

### El sitio: el taller

- **Una estética propia**, que junta lo técnico con lo arcano de la matemática:
  - **colores:** bronce viejo, pátina y óxido, sobre carbón en el modo oscuro y sobre pergamino en el claro;
  - **títulos:** la letra Cinzel;
  - **fondo:** construcciones con compás y fórmulas del proyecto, todas verdaderas: la gravedad como campo, el paso de Euler, el cuaternión, la huella.
- **El metal, primero pulido y después oxidado.** La primera versión tenía franjas de brillo. A pedido pasó a bronce **mate y oscuro**, con dos texturas que se repiten: manchas de óxido con picado, y costras de pátina verde. En las piezas chicas (un botón, la página actual del índice) va sin costras, para que la letra se lea limpia.
- **Los dibujos se hacen con código** (`sitio/scripts/dibujar.mjs`):
  - el fondo;
  - la marca, un engranaje con una lemniscata;
  - dos engranajes que engranan de verdad: mismo módulo, y giran con velocidades en razón 12 : 20;
  - las texturas, hechas con el ruido que calcula el navegador (`feTurbulence`).
- **La portada tiene una vitrina 3D en vivo:** un pozo de potencial con tres cuerpos en órbita. La física de la vitrina es la misma que se dibuja (paso fijo y Euler semi-implícito), y tiene pruebas.

### Los ejemplos del tutorial

- **Pantalla completa:**
  - el código y lo que dibuja, lado a lado, con un divisor que se arrastra o se mueve con las flechas;
  - en un celular, uno arriba del otro;
  - donde no hay pantalla completa (el iPhone), el ejemplo ocupa la ventana.
- **Paneles que se ocultan:** el índice del sitio (a la izquierda) y "En esta página" (a la derecha) se ocultan con dos botones de la cabecera, y el navegador lo recuerda.
- **Ejemplos a todo el ancho:** el texto sigue en su columna, porque se lee mejor, pero cada ejemplo sale de ella y usa todo el ancho del panel central. Si alcanza, el código y el resultado van lado a lado, también sin pantalla completa.

### El tutorial, con contexto

- **Una introducción de verdad** ("Empezar aquí"):
  - para quién es;
  - qué se aprende en cada etapa, desde los cimientos hasta los personajes, los bots y los juegos;
  - con qué herramientas y para qué sirve cada una;
  - cómo es una lección;
  - qué **no** es el tutorial.
- **Una lección nueva al principio, "Del 3D a la pantalla",** para quien nunca hizo nada gráfico: píxeles, coordenadas, triángulos, cámara, luz y cuadros por segundo.
- **Las cinco lecciones suman** por qué importa cada idea, "qué probar" paso a paso, el código explicado por partes y "Para saber más".
- **La matemática, en capas:**
  - lo mínimo, en el texto de la lección;
  - el porqué, en recuadros "Más a fondo" que se abren con un clic;
  - la matemática completa, en los enlaces.

### La forma de trabajo y las herramientas

- **Directo en `main`**, sin _pull requests_ (decisión 0009). Antes de subir algo se verifica todo en la máquina, y GitHub verifica de nuevo antes de publicar.
- **Node 26**, la versión con soporte a largo plazo desde octubre de 2026, junto con sus tipos.
- **Dependabot ya no propone versiones mayores de dos cosas, que se suben a mano:**
  - los tipos de Node, que van junto con Node;
  - TypeScript, fijado en la 6 hasta que sus herramientas soporten la 7.

## Hallazgos

| Hallazgo                                           | Qué pasaba                                                                                                                                                                                                                            | Arreglo                                                                                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Un _pull request_ encima de otro se cerró solo** | Al fusionar el de abajo y borrar su rama, GitHub cerró el de arriba en vez de pasarlo a `main`                                                                                                                                        | Se restauró la rama, se reabrió el PR y se le cambió la base. Después, la decisión 0009                                                     |
| **La verificación de GitHub, trabada**             | Las ejecuciones quedaron en cola casi una hora sin arrancar, con la página de estado de GitHub diciendo que todo andaba. Como `main` exigía que pasaran, nada podía entrar                                                            | Se trabaja directo en `main`, verificando antes en la máquina. GitHub sigue verificando antes de publicar                                   |
| **Mover un iframe lo recarga**                     | Para la pantalla completa no se puede llevar el ejemplo a otro lugar de la página: el navegador recarga el iframe y el ejemplo empieza de cero                                                                                        | Solo cambia la disposición, con una grilla de CSS. Una prueba cuenta las recargas del iframe: con una mutación que lo vuelve a poner, falla |
| **_Container queries_ contra `position: fixed`**   | Para ensanchar los ejemplos con CSS solo, el panel central tendría que ser un "contenedor". Eso lo vuelve la referencia de todo lo que tiene `position: fixed` adentro, y el ejemplo ampliado del iPhone dejaría de cubrir la ventana | El ancho se mide con JavaScript (`ResizeObserver`) y se pasa al CSS en variables                                                            |
| **El panel de controles tapaba la escena**         | En un celular, el panel de lil-gui (245 px) cubría casi todo el resultado                                                                                                                                                             | En un iframe angosto, el panel se achica                                                                                                    |
| **El campo de visión no "aplana"**                 | La lección 0 decía que un teleobjetivo aplana la escena. Con la cámara quieta, solo hace zoom; el aplanado aparece cuando además se aleja la cámara                                                                                   | Corregido, y explicado con la cuenta en un recuadro "Más a fondo"                                                                           |
| **Dependabot quería TypeScript 7**                 | Su actualización falló: typescript-eslint y `astro check` todavía no lo soportan                                                                                                                                                      | Las versiones mayores de TypeScript y de los tipos de Node se suben a mano                                                                  |
| **Un enlace que no existía**                       | La página de `Math.imul` no existe en la versión en castellano de MDN                                                                                                                                                                 | Se comprobaron todos los enlaces del tutorial; ese va en inglés                                                                             |

## Medido

- **La vitrina:** Three.js llega en un segundo pedido, de unos **130 KB** comprimido, después de que la página ya se ve. Es el mismo archivo que usa el Dojo.
- **Las órbitas de la vitrina, en 10 minutos simulados:**
  - la que más se acerca al centro llega a **0,717 m** (el cuerpo central mide 0,3 m);
  - la energía varía como mucho un **0,46 %**;
  - con Euler explícito en lugar del semi-implícito, las 6 pruebas fallan.
- **Los dibujos:** las texturas de óxido y de pátina pesan **0,9 KB** cada una, porque el ruido lo calcula el navegador, y el fondo pesa 21 KB.
- **Los ejemplos a todo el ancho:** en una pantalla de 1440 px, con los dos paneles ocultos, un ejemplo pasa de **732 px a 1392 px**, con el código (583 px) y el resultado (799 px) lado a lado.
- **Las pruebas:** 32 sin pantalla y 15 en Chromium. Cada prueba nueva se rompió una vez a propósito, para ver que falla cuando tiene que fallar.
