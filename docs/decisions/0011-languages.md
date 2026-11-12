# 0011. Languages: the site in Spanish, everything else in English

- **Status:** accepted (it replaces the language part of [0005](0005-way-of-working.md) and of [0010](0010-the-console-and-recipes.md))
- **Date:** 2026-11-12

## Context

Until now everything was in Spanish ([0005](0005-way-of-working.md)): the code, its comments, the file names, the commits, the tutorial, and the Dojo's console ([0010](0010-the-console-and-recipes.md), with English aliases planned for later). With the first stage done, the cost showed:

- **The naming was mixed.** The libraries speak English, so the code read like `escena.add(sol)`, `crearEscena()`, `renderer.setSize(...)`: half and half, in every line.
- **Sharing the project was harder.** Whoever reads the repository, an issue or a commit has to read Spanish, and the industry standard is English.
- **The console is a small language.** Translating its names (`ver.triangulos` for `show.wireframe`) is like translating `if` into `si`: a recipe would need two vocabularies, and the aliases would be a contract forever.
- **Nobody uses it yet.** There are no saved recipes, links or forks to look after: it is the cheapest moment to change.

## Decision

**What explains or informs, on the site, is in Spanish; everything else is in English.**

| In Spanish                                                                                                             | In English                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| The tutorial, the Bitácora and the site's pages                                                                        | The code: names and comments, in the packages, the games, the site and the lessons                           |
| The site's interface: "Ejecutar", "Ocultar", "Pantalla completa", the error text a reader sees ("(main.ts, línea 12)") | File, folder and package names                                                                               |
| The site's addresses: `/tutorial/etapa-0/…`, `/jugar/dojo/`                                                            | The tests: their names and their messages                                                                    |
|                                                                                                                        | The console: its names, its help and its messages. The recipes and the rooms: their names and their titles   |
|                                                                                                                        | The lessons' examples: their names, comments, panels (lil-gui) and what they write to the console            |
|                                                                                                                        | The decisions (these documents), the README, the commit messages and the tag names (`stage-00`, `stage-01`…) |

- **The console is not translated, ever.** When the site has English, the console stays the same: its names are like a programming language's keywords. A recipe written by anyone works for everyone.
- **The site will be translated later** (the prose, into English); the code is already in the language it will keep.
- **The tutorial teaches the vocabulary.** The first time a term shows up, it goes in Spanish with the English one beside it: "una malla (_mesh_)". A glossary page (`/tutorial/glosario/`) gathers every term with its English name, the one used in the code, in the documentation and in the console. A new lesson adds its new words to it.
- **No backward compatibility.** The Spanish names, the old addresses (`?cubos=…&semilla=…`, `#receta=…`) and the console's Spanish vocabulary are dropped, not kept as aliases.
- **History stays as it was.** The Bitácora's earlier reports describe the code with the names of their time; the `paso-00` tag still points at the Spanish code. The tutorial links to `stage-00`, the same stage in English. These decisions were translated, with their file and code names updated, without changing what they decided; where they decided about language, they are marked as replaced.

## Consequences

- The code, the decisions and the history can be read by anyone, and the tutorial's reader learns the words they will meet in any library or documentation.
- A Spanish text next to English code asks for care: the terms at their first appearance and the glossary bridge the two.
- The browser tests look for the site's labels in Spanish (they are the site's text) and for everything else in English.
- A big rename, all at once (stage 0e): every folder, file and name of the project.

## Alternatives discarded

- **Keep everything in Spanish** (0005): consistent with the tutorial, but mixed with every library's English, and harder to share.
- **Everything in English, the site too:** the tutorial is for Spanish speakers first; the English site comes later, as a translation.
- **Translate the console, with aliases** (0010): two vocabularies for one small language, and aliases to keep forever.
