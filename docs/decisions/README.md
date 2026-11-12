# Architecture decisions

Every important decision is written down here, with its why, in a short, numbered document (an _Architecture Decision Record_, ADR). They keep us from discussing again what was already decided without knowing why it was decided, and they let the tutorial cite them.

Each one has: **context** (what problem there was), **decision**, **consequences** (the good and what it costs) and discarded **alternatives**. A decision is not deleted: if it changes, a new one is written that replaces it, and the old one is marked as _replaced_.

| No.                                     | Decision                                                      | Status                                            |
| --------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------- |
| [0000](0000-why-a-v2.md)                | Why a V2, and what we take from the drafts and from V1        | Accepted                                          |
| [0001](0001-monorepo-and-tools.md)      | A monorepo, and its tools                                     | Accepted                                          |
| [0002](0002-the-site.md)                | The site: Astro with Starlight, on GitHub Pages               | Accepted                                          |
| [0003](0003-boundaries.md)              | The boundaries between layers, guarded by compiler and linter | Accepted                                          |
| [0004](0004-state-as-data.md)           | The world's state as plain data                               | Accepted (completed in phase 1)                   |
| [0005](0005-way-of-working.md)          | How we work: branches, PRs, commits, tags, language           | Accepted (branches and PRs: 0009; language: 0011) |
| [0006](0006-the-name.md)                | The name: Manifold Gaming                                     | Accepted                                          |
| [0007](0007-executable-tutorial.md)     | The executable tutorial and the Bitácora                      | Accepted                                          |
| [0008](0008-the-workshop-look.md)       | The site's look: the workshop                                 | Accepted                                          |
| [0009](0009-straight-to-main.md)        | Straight to main, without pull requests                       | Accepted                                          |
| [0010](0010-the-console-and-recipes.md) | The console and the recipes                                   | Accepted (language: 0011)                         |
| [0011](0011-languages.md)               | Languages: the site in Spanish, everything else in English    | Accepted                                          |
| [0012](0012-the-games.md)               | The games: the classics first, the strange ones after         | Accepted                                          |
