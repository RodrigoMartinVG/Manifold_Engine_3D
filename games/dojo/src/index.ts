import { recipeFromLink } from '@manifold/commands';
import { initPhysics } from '@manifold/core';
import { mount, type InitialRecipe, type Mount } from '@manifold/presentation';
import { DojoCartridge } from './cartridge';
import { ROOMS } from './rooms';

export interface DojoOptions {
  /** The saved room it was entered through (`…/jugar/dojo/rain/`), if any. */
  room?: string;
  /** The site's base address (`/Manifold_Gaming/`): so the address bar shows the room when it is loaded. */
  base?: string;
}

/**
 * Starts the Dojo inside `container` (the site's `/jugar/dojo/` pages).
 *
 * The GAME decides where its recipes come from (decision 0010), in this order (the last one wins):
 *   1. each person's startup recipe (the console provides it);
 *   2. the room it was entered through;
 *   3. the link's (`#recipe=…`), the one `export` builds.
 * The world is born once, already configured. Before that, the physics loads (Rapier, in
 * WebAssembly: asynchronously).
 */
export async function startDojo(container: HTMLElement, o: DojoOptions = {}): Promise<Mount> {
  await initPhysics();
  const recipes: InitialRecipe[] = [];
  const room = o.room ? ROOMS[o.room] : undefined;
  if (room) recipes.push({ from: `the room "${o.room}"`, text: room.text });
  const fromLink = recipeFromLink(location.hash);
  if (fromLink) recipes.push({ from: "the link's recipe", text: fromLink });

  const base = o.base ?? '/';
  return mount(DojoCartridge, container, {
    recipes,
    console: { game: 'dojo', rooms: ROOMS, roomUrl: (name) => `${base}jugar/dojo/${name}/` },
  });
}

export { DojoCartridge, ROOMS };
