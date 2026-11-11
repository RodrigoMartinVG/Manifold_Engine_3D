# 0002. El sitio: Astro con Starlight, en GitHub Pages

- **Estado:** aceptada
- **Fecha:** 2026-11-11

## Contexto

La plataforma es también una **web**: un inicio, la descripción del proyecto, un **tutorial que crece con el motor** y las páginas desde las que se juega (el Dojo y los juegos). El tutorial necesita escribirse en Markdown y poder mostrar demos en vivo.

## Decisión

- **Astro**, con su tema de documentación **Starlight** para el tutorial y las páginas de texto. Los juegos son **páginas de Astro a pantalla completa** (`/jugar/dojo/`) que importan su paquete: Astro los empaqueta con Vite, como al resto. Una sola compilación arma todo el sitio.
- Se publica en **GitHub Pages**, en `https://rodrigomartinvg.github.io/Manifold_Engine_3D/`. Por eso el sitio tiene `base: '/Manifold_Engine_3D'`, y los enlaces internos se escriben relativos.
- El tutorial vive en `sitio/src/content/docs/tutorial/`, un capítulo por paso del motor.

## Consecuencias

- Escribir un capítulo es escribir Markdown; Starlight agrega el índice, la búsqueda y el modo oscuro.
- Todo es estático: Pages lo sirve gratis. El servidor de los juegos en red (fase 6) va a necesitar otro lugar.

## Alternativas descartadas

- **VitePress:** también sirve y es más simple, pero está pensado solo para documentación; aquí hay también una página de inicio y páginas de juegos.
- **Páginas HTML sueltas con Vite** (como en la V1): el tutorial necesitaría armarse a mano.
