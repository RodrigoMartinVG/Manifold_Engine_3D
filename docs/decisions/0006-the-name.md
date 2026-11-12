# 0006. The name: Manifold Gaming

- **Status:** accepted
- **Date:** 2026-11-11

## Context

The project started as **Manifold_Engine_3D**. But "Manifold Engine" can be confused with a physics or drawing engine (exactly what Rapier and Three.js do, which it is built on) or with design tools (CAD) that use the same word.

## Decision

- The name is **Manifold Gaming**: _manifold_ for the mathematics (a manifold: flat up close, curved or twisted at large, like the Möbius strip, which is what the engine treats as the normal case), and _Gaming_ because it is a platform to make and play games.
- The repository is `RodrigoMartinVG/Manifold_Gaming` (GitHub redirects from the old name) and the site, `https://rodrigomartinvg.github.io/Manifold_Gaming/`.
- The internal packages keep the short prefix `@manifold/` (`@manifold/core`, `@manifold/dojo`...): they are not published, and it is easier to type.

## Consequences

- The site's addresses change from `/Manifold_Engine_3D/` to `/Manifold_Gaming/`. Since the site was published minutes ago, there are no old links to look after.

## Alternatives discarded

- **Manifold Engine 3D:** what we wanted to avoid.
- **Manifold Game Engine:** better, but "engine" still invited confusion with physics or drawing engines.
