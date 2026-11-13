import { levelFromText, type Level } from '@manifold/core';

/**
 * THE DOJO'S LEVELS (stage 2a): text files in `games/dojo/levels/`, in the engine's level format.
 * Adding a level is adding a file: `dojo.level <its name>` builds it.
 */
const files = import.meta.glob<string>('../levels/*.level', { query: '?raw', import: 'default', eager: true });

/** By name (the file's, without `.level`). A level that is not understood stops the build: better now than in a player's hands. */
export const LEVELS: Readonly<Record<string, Level>> = Object.fromEntries(
  Object.entries(files)
    .map(([path, text]) => [path.replace(/^.*\/([^/]+)\.level$/, '$1'), levelFromText(text)] as const)
    .sort(([a], [b]) => a.localeCompare(b)),
);
