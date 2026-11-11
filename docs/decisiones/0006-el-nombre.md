# 0006. El nombre: Manifold Gaming

- **Estado:** aceptada
- **Fecha:** 2026-11-11

## Contexto

El proyecto empezó como **Manifold_Engine_3D**. Pero "Manifold Engine" se puede confundir con un motor de física o de dibujo (justo lo que hacen Rapier y Three.js, sobre los que está construido) o con herramientas de diseño (CAD) que usan la misma palabra.

## Decisión

- El nombre es **Manifold Gaming**: _manifold_ por la matemática (una variedad: plana de cerca, curva o retorcida en grande, como la cinta de Möbius, que es lo que el motor trata como caso normal), y _Gaming_ porque es una plataforma para hacer y jugar juegos.
- El repositorio es `RodrigoMartinVG/Manifold_Gaming` (GitHub redirige desde el nombre viejo) y el sitio, `https://rodrigomartinvg.github.io/Manifold_Gaming/`.
- Los paquetes internos siguen con el prefijo corto `@manifold/` (`@manifold/nucleo`, `@manifold/dojo`...): no se publican, y es más cómodo de escribir.

## Consecuencias

- Las direcciones del sitio cambian de `/Manifold_Engine_3D/` a `/Manifold_Gaming/`. Como el sitio se publicó hace minutos, no hay enlaces viejos que cuidar.

## Alternativas descartadas

- **Manifold Engine 3D:** lo que se quería evitar.
- **Manifold Game Engine:** mejor, pero "engine" seguía invitando a la confusión con los motores de física o de dibujo.
