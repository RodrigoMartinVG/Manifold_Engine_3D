import { recipeFromLink } from '@manifold/commands';
import { initPhysics } from '@manifold/core';
import { GHOST_PREFIX, mount, REPLAY_PREFIX, replayFromFragment, type InitialRecipe, type Mount } from '@manifold/presentation';
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
 *
 * A link can also bring a replay (`#replay=…`: it plays, and checks at the end that it gave the same)
 * or a ghost to race (`#ghost=…`), stage 1c.
 */
export async function startDojo(container: HTMLElement, o: DojoOptions = {}): Promise<Mount> {
  await initPhysics();
  const replay = (await replayFromFragment(location.hash, REPLAY_PREFIX)) ?? undefined;
  const ghost = (await replayFromFragment(location.hash, GHOST_PREFIX)) ?? undefined;
  const recipes: InitialRecipe[] = [];
  const room = o.room ? ROOMS[o.room] : undefined;
  if (room) recipes.push({ from: `the room "${o.room}"`, text: room.text });
  const fromLink = recipeFromLink(location.hash);
  if (fromLink) recipes.push({ from: "the link's recipe", text: fromLink });

  const base = o.base ?? '/';
  return mount(DojoCartridge, container, {
    recipes,
    replay,
    ghost,
    // A lab: a free camera, and a click on an object inspects it.
    camera: 'orbit',
    console: {
      game: 'dojo',
      rooms: ROOMS,
      roomUrl: (name) => `${base}jugar/dojo/${name}/`,
      examples: [
        'load course',
        'controls.scheme tank',
        'dojo.spawn 0 5 0',
        'physics.gravity 0 -1.62 0',
        'show.physics on',
        'inspect 1',
      ],
    },
  });
}

export { DojoCartridge, ROOMS };
