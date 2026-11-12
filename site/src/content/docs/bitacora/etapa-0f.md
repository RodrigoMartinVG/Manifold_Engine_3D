---
title: 'Etapa 0f: un sitio con secciones'
description: 'El sitio deja de ser una documentación con una portada encima: cuatro secciones siempre a mano, un índice por sección, un inicio con puertas que llevan a algo, y un Dojo que dice cómo empezar.'
sidebar:
  order: 5
---

> Informe de la etapa 0f. Un cambio del sitio, no del motor: cómo se recorre.

## Qué hicimos

Se revisó el sitio como lo vería alguien que llega por primera vez: cada página, cada botón y cada enlace, con su destino, en una computadora y en un celular. Estaba armado como una documentación (un índice lateral para todo, y "siguiente página" en orden), con una portada encima. Lo que se encontró:

| Qué pasaba                                                                                                                                     | Por qué importa                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| "Entrar al Dojo" llevaba a un cubo que gira, sin ninguna pista. La explicación estaba en "Jugar", y el inicio no la enlazaba                   | Dos caminos al mismo lugar, y a cada uno le faltaba lo que tenía el otro    |
| Las cuatro tarjetas del inicio no llevaban a ningún lado, y repetían los botones. "Los juegos" prometía algo que no existe                     | Contenido sin salida                                                        |
| La Bitácora no aparecía en el inicio                                                                                                           | La mitad del proyecto, invisible desde la portada                           |
| No había un menú principal: el índice lateral hacía de menú, y el inicio no lo tiene. En un celular, desde el inicio, solo quedaba el buscador | Secciones enteras a las que no se podía llegar                              |
| "Siguiente página" seguía el índice entero: del glosario llevaba a la Bitácora, y de "Jugar" al tutorial                                       | Mezclaba un curso, un diario y páginas sueltas como si fueran un solo libro |

Y lo que cambió:

- **Cuatro secciones, siempre a mano: Jugar, Tutorial, Bitácora y Proyecto.** En una pantalla ancha van en la cabecera, al lado del título, y la sección actual queda marcada. En un celular van en una barra abajo, con un ícono cada una, donde llega el pulgar. Es lo habitual cuando hay pocas secciones principales.
- **Cada sección, su índice.** En el tutorial, el índice lateral muestra solo el tutorial; en la Bitácora, solo los informes. "Página anterior" y "siguiente" no salen de la sección. Jugar y Proyecto, que son una página cada una, no tienen índice lateral. Starlight lo permite sin plugins: un _route middleware_ (`site/src/route-data.ts`) recorta el índice antes de dibujar cada página.
- **Un inicio más corto, que lleva a algo.** El texto de arriba bajó de unas 60 palabras a 30. El botón principal es el Dojo, y el segundo, el tutorial. Debajo hay tres puertas con contenido real, leído del propio sitio, que se actualiza solo:
  - el Dojo, con sus salas;
  - el tutorial, con cuántas lecciones tiene y por cuál empezar;
  - la Bitácora, con el último informe.

  Al final, una franja con las siete etapas del motor y la actual marcada, que lleva al plan completo.

- **La Bitácora tiene portada:** `/bitacora/` lista todos los informes, del más nuevo al más viejo, cada uno con su resumen.
- **"Jugar" es la portada del Dojo:** el botón para entrar, las salas como tarjetas (con el comando que las carga), la consola, y los juegos como "próximamente".
- **El Dojo dice cómo empezar.** La primera vez aparece una pista: "Todo se maneja desde la consola: abrila con º o con el botón ›\_, y probá `load rain` o `help`". Se va al abrir la consola, o con su ✕, y no vuelve a aparecer en ese navegador. El botón para salir lleva a "Jugar" en vez del inicio.

## Hallazgos

| Hallazgo                                                      | Qué pasaba                                                                                                                                                                                                                 | Arreglo                                                                                                                 |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Starlight ensancha las páginas sin índice lateral**         | Pensando en portadas como el inicio, les da 67,5rem de ancho en vez de 45. "Jugar" y "Proyecto" quedaron con renglones de más de 1.000 píxeles, incómodos para leer                                                        | Las páginas sin índice y sin portada vuelven al ancho normal. Una prueba mide el ancho, y falla si se quita la regla    |
| **Un índice sin el título de su grupo**                       | Al principio se sacaba el encabezado del grupo ("Bitácora"), para no repetir el nombre de la sección. Pero Starlight dibuja los enlaces sueltos de arriba con letra de título: los informes quedaban en mayúsculas grandes | El grupo conserva su encabezado: nombra la sección, y sus enlaces quedan del tamaño normal                              |
| **El menú de Starlight en el celular no tapa la barra nueva** | El índice del celular se abre en la capa superior del navegador (un _popover_), por encima de todo                                                                                                                         | La barra no necesita ningún arreglo: el menú abierto la cubre, y al cerrarlo vuelve                                     |
| **La primera prueba de una tanda puede tardar de más**        | Al romper cosas a propósito, falló una prueba que no tenía nada que ver: era la primera, y la primera carga del sitio recién armado tardó más que el tiempo límite                                                         | Las pruebas que solo miran la estructura de la página esperan el HTML (`domcontentloaded`), no cada imagen y la vitrina |

## Medido

- **Las pruebas en Chromium pasaron de 22 a 36**, con un archivo nuevo (`e2e/navigation.e2e.ts`) y la del inicio actualizada. Comprueban:
  - las cuatro secciones, con la actual marcada, en ocho páginas de distintos tipos;
  - la barra del celular en el inicio, que no tapa el final de la página;
  - el índice y "anterior/siguiente" de cada sección;
  - que cada enlace de las puertas del inicio lleve a una página que existe;
  - que la Bitácora liste cada informe, del más nuevo al más viejo;
  - la pista del Dojo: aparece la primera vez, se va al abrir la consola o con su ✕, y no vuelve.
- **Seis protecciones rotas a propósito, en dos tandas:** sin el _middleware_, sin el espacio para la barra, con los informes al revés, con el ancho de lectura ancho, y con la pista que no se va o que no se recuerda. Cada una hace fallar la prueba que le corresponde.
