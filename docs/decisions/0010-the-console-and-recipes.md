# 0010. The console and the recipes

- **Status:** accepted (when revising it, each room's own address and the rules for links were added). Its language part, and the temporary translation of the Dojo's old address, replaced by [0011](0011-languages.md): the console's names are now in English, and this document uses them.
- **Date:** 2026-11-11

## Context

Today the Dojo is configured with parameters in the address (`?cubos=20&semilla=3`). What can be changed is not discoverable, there is no help nor validation, and to change something the page has to be reloaded.

In V1 the same happened, and worse:

- **The address was read in a dozen places** of `main.ts` (`servidor`, `nivel`, `repeticion`, `fantasma`, `nueva`…), and it was handed whole to each game's rules.
- **The debug views were turned on with loose keys:** F, the physics; N, the navigation; M, the level's merge; P, the scale. To know they existed one had to read the code, and F1 was useless, because on the MacBook it is the brightness.

A panel with all the options does not scale either: every new option is one more control to design and maintain, and in the future there will be many.

And something that orders everything else: **the Dojo is a game**, the first one, used to try every piece of the engine. The games to come will have their own rules; maybe a console, maybe not.

## Decision

### A registry of commands and variables; the console is one of its faces

- **Every part declares its own in a registry:**
  - **variables:** type, range, default value and description;
  - **commands:** actions with arguments.

  No module reads the address or the keyboard on its own.

- **The console**, like Quake's, shows, completes and runs what was declared. There is no options panel: a new option shows up in the console by itself.
- **It is not a language.** A line is a command with its arguments; several can also go on one line, separated by `;`. It has no variables of its own, conditions, loops or JavaScript. To configure, look and share, it is enough.

### The layers: the engine offers, each game decides

| Layer                                                        | What it brings                                                                                                                                                                                 | Required for a game?                                          |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Engine, without a screen** (`packages/commands`, the core) | The registry, the interpreter and the recipe format. The declarations the engine brings ready (`seed`, `physics.gravity`…). The channel through which a world change enters at a concrete step | No: it is a library. A game that does not use it pays nothing |
| **Presentation**                                             | The console, as a piece that is mounted, and the debug views `show.*`                                                                                                                          | No: each game mounts it or not, and can give it its own look  |
| **Each game**                                                | What it exposes: its variables and commands, and which of the engine's it lets be touched. Also its scenarios, its recipes, its startup recipe and its links                                   | It is each game's decision                                    |

- **The Dojo exposes everything**, because it is a lab. Another game may have no console, have one only for development, or allow only view commands. In a competitive game, changing gravity from the console would be cheating.
- **The Dojo has no back doors.** It uses the same public contract as any game. If something is missing for it, it is missing in the engine.
- **Every name has its namespace:** the engine's (`seed`, `physics.gravity`, `show.wireframe`) and each game's (`dojo.room`, `dojo.cubes`).

### Three kinds of options, by what they touch

| Kind        | Examples                                      | What happens when it changes                                                                                                                                      |
| ----------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Startup** | `seed 7`, `dojo.room planet`, `dojo.cubes 20` | They define how the world is born: changing them restarts it                                                                                                      |
| **World**   | `physics.gravity 0 -3 0`, `dojo.spawn 0 5 0`  | They enter the simulation as one more input, at a concrete step, just like a player's key. They are recorded in the replay, and the hash still comes out the same |
| **View**    | `show.wireframe on`, `view.timescale 0.25`    | They only change what is seen. They do not touch the simulation, are not recorded in the replay and do not change the hash                                        |

This split keeps determinism, and prepares for networking. A world change can be validated and distributed by a server; a view change never leaves the machine.

`view.timescale` belongs to the view: with a fixed step, going slower does not change the physics, it only shows it more slowly.

### The debug views: `show.*`

- **From the first version:**
  - `show.wireframe`: the meshes as wire;
  - `show.axes`;
  - `show.stats`: frames per second, step and hash.
- **With the physics, in stage 1:**
  - `show.physics`: what Rapier sees, like V1's F;
  - `show.vectors`: velocities and forces;
  - `show.gravity`: arrows of the field;
  - `show.contacts`.
- **Every view is a presentation module that declares itself.** Off, it costs nothing: it neither computes nor draws.
- **Keys come back as configurable bindings:** `bind f toggle show.physics`, like Quake's `bind`. They are saved in the browser, separately for each game.

### How it is written

- **Reading and changing:**
  - `name`, with no arguments: shows the value, the range, the default value, what it is for and its type;
  - `name values…`: changes it, or runs the command;
  - `toggle name`: flips an on/off.
- **The values:**
  - **on or off:** `on`/`off`, and also `1`/`0`, `true`/`false`, `yes`/`no`;
  - **decimals:** with a dot, as in code (`0.25`);
  - **vectors:** three numbers separated by spaces;
  - **text:** in quotes.
- **In recipes:** `#` starts a comment, and `;` separates commands on one line.
- **To find one's way:**
  - `help` and `help name`;
  - `find text`: searches names and descriptions;
  - `vars prefix` (for example, `vars show.`): a list with the current values;
  - `changed`: only what differs from the default value.
- **Errors say what they expected,** and suggest the similar name: `Did you mean "physics.gravity"?`.
- **The console on screen:**
  - it opens with the key to the left of 1 (code `Backquote`: the **º** on a Spanish keyboard), as in Quake, and with an on-screen button for touch screens;
  - while it is open, the keys belong to the console and not to the game;
  - Tab completes names and options, and the arrows go through the history, which is saved in the browser, separately for each game.

### The recipes, and how a game starts with a scenario

A **recipe** is plain text, that can be read and copied:

```
# Orbits that close
seed 7
dojo.room planet
physics.gravity.strength 12

# What is seen
show.vectors on
```

- **A game is born configured.** When it opens, and before creating the world, these are gathered in this order:
  1. the default values;
  2. the **startup recipe**, if there is one: what each person always wants, like Quake's `autoexec.cfg`. It is saved in the browser with `startup save` and removed with `startup clear`;
  3. the **room's recipe**, if one came in through the address of a saved room;
  4. the **link's recipe**, if one came. It wins over the previous ones.

  Only then is the world created, once and already configured. It does not start "basic" to change afterwards.

- **Every saved room has its own address.** A recipe saved in the game's repository (`games/dojo/recipes/orbits.txt`) becomes, when the site is built, a page of its own: `…/jugar/dojo/orbits/`. It is the same game, born with that recipe. It can be bookmarked, the "Jugar" page lists it and a lesson can link to it. It is the address as a _place_ ("the orbits room is here"), not as a control panel.
- **A link can carry the recipe inside,** in the fragment (`#`), which does not travel to the server: `…/jugar/dojo/#recipe=dojo.cubes+20;show.wireframe+on`. It is what `export` builds. Lines are separated with `;` and spaces are written `+`, so the link can be read and fixed by hand; everything else is escaped as in any address. It can be added to a room's address: `…/jugar/dojo/orbits/#recipe=show.vectors+on`.

- **What a link cannot do.** A recipe (from a link, from a room or the startup one) can only set variables and run the commands declared safe for recipes. It never touches the preferences saved in the browser (`startup`, `bind`): someone else's link does not change anybody's configuration. And since the console runs no code and validates every value, a link cannot do anything the console does not allow.
- **If a line is not understood** (for example, the recipe comes from a newer version), the game starts anyway with the rest, and the console reports how many lines it did not understand and which ones.
- **`export` writes the recipe of what was changed.** Startup and world values go with their final values; view values, in a separate section.
- **A recipe is not a replay.** The recipe is a _setting_: how to start and what to see. The replay is a _story_: the seed plus every world change with its step.
- **The tests run recipes** without a screen and compare the hash.
- **The Dojo's old address** (`?cubos=…&semilla=…`) is translated into a recipe for a while, so as not to break links, and is retired afterwards. (Replaced by 0011: retired already, nobody used it.)

### The language (replaced by [0011](0011-languages.md))

What was decided here, and no longer holds:

- **The names of commands and variables were fixed identifiers, in Spanish** (`semilla`, `ver.triangulos`), like the code then. A recipe has to work the same years from now, and in any language.
- **What was going to be translated:**
  - the descriptions, the help and the messages. Each declaration kept its text per language (`{ es: '…' }`) from the start, and English would be added later;
  - the on/off values: `si` and `yes` both valid.
- **Later, English aliases:** `physics.gravity` would run `fisica.gravedad`. But `export` would always write the original names, so that a recipe made in English opens in Spanish, and the other way around.
- **`idioma en` in the console itself**, saved in the browser.

Since 0011, the console is in English and is not translated, like the keywords of a programming language: names, help and messages. The only fixed identifier is the English one, so there are no aliases to keep.

### The first part, before stage 1

1. **The registry, the interpreter and the recipe format**, without a screen and with Vitest tests.
2. **The channel for world changes, at a concrete step.** It is the same the character will use in stage 1.
3. **The console**, as a presentation piece.
4. **The Dojo mounts it** and declares `seed`, `dojo.cubes`, `restart`, `pause` and `step`. It adds `show.wireframe`, `show.axes` and `show.stats`, the recipes (`export`, `load`, `startup`), the bindings, and (until 0011) the old address translated into a recipe.
5. **A test in Chromium:** open the console, type `dojo.cubes 20` and see 21 meshes.

## Consequences

- **A new option costs one declaration**, not an interface control.
- **A single format and a single interpreter** to configure, look, share and test: the console, the links, the repository's recipes and the tests.
- **World changes go through the player inputs' channel:** it has to be built now. Stage 1 needs it anyway.
- **Typing is less friendly than touching a control.** The help, the completion, `find` and the named recipes have to make up for it.
- **The names are a contract:** a saved recipe has to keep working. If a name changes, the old one stays as an alias. (0011 renamed them all at once, while nobody used them yet.)
- **The permissions for networking are still to be decided:** who can run a world change in a networked game. It is decided with the networking.

## Alternatives discarded

- **Parameters in the address**, today's: not discoverable, no help, and they force a reload. They remain only as the transport of a recipe.
- **A panel with all the options** (lil-gui or our own): it becomes unmaintainable as the options grow.
- **A console that runs JavaScript:** powerful, but it breaks determinism and the boundary between the simulation and the screen.
- **Loose keys for each debug view,** as in V1: not discoverable, and they clash with the system. They come back as configurable bindings.
- **A console of the site or of the engine, the same for every game:** each game has its idiosyncrasy; the engine offers the pieces and the game decides.

## What was decided by default (it can be changed later)

- **The key to open it:** the one to the left of 1 (**º**), plus an on-screen button.
- **On and off:** `on`/`off`, and also `1`/`0` (since 0011; before, `si`/`no`).
- **Decimals:** with a dot.
- **Recipes:** they also keep the view values, in a separate section.
- **Bindings:** they go in the first version.
