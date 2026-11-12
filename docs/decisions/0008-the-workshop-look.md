# 0008. The site's look: the workshop

- **Status:** accepted
- **Date:** 2026-11-11

## Context

The site used Starlight's default look: correct, but the same as thousands of documentation sites. Manifold Gaming is something else: a lab where mathematics (fields, quaternions, integration steps) is the raw material. We looked for a look that brings together the sophisticated and technical with the arcane side of mathematics: metal, instruments, compass constructions.

There are three conditions:

- **It must read well.** The site is above all a tutorial: the style cannot compete with the text or the code.
- **It must run on a modest machine** (the development one has an integrated Iris Plus GPU).
- **It must be original:** no images, brands or resources copied.

## Decision

- **The palette.** Bronze and copper for frames and titles; patina (old copper's green) as the accent of links and secondary buttons; warm charcoal for the background. Light mode is parchment with sepia ink. It is all in `site/src/styles/workshop.css`, which redefines Starlight's colors and adds its own (with the `--mg-` prefix).
- **The type.** Cinzel (OFL license, served from the site itself with `@fontsource`, with no third-party requests) only for titles. The text keeps the system font, which is the one that reads best on screen.
- **The drawings are made with code.** `site/scripts/draw.mjs` generates the SVGs with exact geometry: the background, the logo (a gear with a lemniscate) and two gears that really mesh (same module; the CSS turns them at speeds in inverse ratio to their number of teeth).
- **The background says true things.** The constructions (golden rectangle, astrolabe, an orbit with its focus, the compass triangle) and the formulas are the project's: `g = −GM r̂ / r²`, the semi-implicit Euler step (with its points below the exact parabola: the step's error), the quaternion, the seeded generator, the FNV-1a hash, the Möbius strip.
- **The background is a mask.** A fixed layer behind everything lets a color through only where there is a stroke, so the same SVG works in both modes, and it is not repainted when scrolling. On the home page it shows more; in the lessons, barely.
- **The home page has a live 3D showcase** instead of an image: a potential well with three bodies in orbit. Its physics (`site/src/showcase/orbits.ts`) is the same that is drawn, and it is tested: in ten minutes no body escapes or crashes, and the energy does not drift (with explicit Euler, the test fails). Three.js is fetched after the page is drawn, with a dynamic `import()`. The showcase stops when it is not seen, and respects "reduce motion".
- **What is used for working stays sober.** The examples' editor and result stay dark and clean (One Dark with a warm background); the bronze frame stays outside.
- **Later, matte and rusted** (stage 0c): the metal is old bronze, without shiny streaks, with two repeating textures made by the same script (rust with pitting, and patina crusts).

## Consequences

- The site has an identity of its own, and the drawings can be regenerated or changed with code (`npm run draw -w site`).
- The home page weighs more: Three.js (about 130 KB compressed) arrives in a second request, after the page is already visible. It is the same file the Dojo uses, so the browser keeps it only once.
- Every new Starlight version can change class names. If a style stops applying, the place to look is `workshop.css`, which names each component it touches.

## Alternatives discarded

- **A painted background image** (like the sketch that inspired this): it weighs, the text on top reads worse, and its letters and numbers would be meaningless decoration.
- **Metal frames everywhere:** it tires the eye and competes with the content; the metal was kept for what is pointed out (the logo, the title, the cards, the main buttons, the showcase and the examples' frames).
- **A serif font for the whole text:** more "old", but it reads worse on screen in long paragraphs.
