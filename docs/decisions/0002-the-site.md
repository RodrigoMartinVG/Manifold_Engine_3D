# 0002. The site: Astro with Starlight, on GitHub Pages

- **Status:** accepted
- **Date:** 2026-11-11

## Context

The platform is also a **website**: a home page, the project's description, a **tutorial that grows with the engine** and the pages to play from (the Dojo and the games). The tutorial has to be written in Markdown and be able to show live demos.

## Decision

- **Astro**, with its documentation theme **Starlight** for the tutorial and the text pages. The games are **full-screen Astro pages** (`/jugar/dojo/`) that import their package: Astro bundles them with Vite, like everything else. A single build makes the whole site.
- It is published on **GitHub Pages**, at `https://rodrigomartinvg.github.io/Manifold_Gaming/`. That is why the site has `base: '/Manifold_Gaming'`, and internal links are written relative.
- The tutorial lives in `site/src/content/docs/tutorial/`. ([0007](0007-executable-tutorial.md) changed its shape: short lessons with executable code, and each stage's reports in a log, the Bitácora.)
- The site's texts and addresses are in Spanish; everything else is in English ([0011](0011-languages.md)).

## Consequences

- Writing a chapter is writing Markdown; Starlight adds the index, the search and dark mode.
- Everything is static: Pages serves it for free. The server for networked games (phase 6) will need another place.

## Alternatives discarded

- **VitePress:** it would also do and it is simpler, but it is meant for documentation only; here there is also a home page and game pages.
- **Loose HTML pages with Vite** (as in V1): the tutorial would have to be put together by hand.
