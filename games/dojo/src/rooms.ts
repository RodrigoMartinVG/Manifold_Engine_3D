import { recipeTitle } from '@manifold/commands';

/**
 * THE DOJO'S SAVED ROOMS (decision 0010): plain-text recipes in `games/dojo/recipes/`. Each one has
 * its own address on the site (`…/jugar/dojo/rain/`), is loaded from the console (`load rain`) and
 * is run by the tests without a screen. Adding a room is adding a file: nothing else to maintain.
 */
const files = import.meta.glob<string>('../recipes/*.txt', { query: '?raw', import: 'default', eager: true });

export interface Room {
  /** Its title, the recipe's first comment (in English, like everything in the console). */
  title: string;
  text: string;
}

/** By name (the file's, without `.txt`). */
export const ROOMS: Readonly<Record<string, Room>> = Object.fromEntries(
  Object.entries(files)
    .map(([path, text]) => [path.replace(/^.*\/([^/]+)\.txt$/, '$1'), { title: recipeTitle(text) ?? '', text }] as const)
    .sort(([a], [b]) => a.localeCompare(b)),
);
