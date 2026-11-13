import { LEVELS } from './levels';
import { createDojo } from './rules';

/**
 * THE DOJO'S CARTRIDGE, with its levels: the rules (rules.ts) receive them, and here they get the
 * ones in `games/dojo/levels/`, found by Vite when the site and the tests are built. Elsewhere (the
 * browser tests, which replay in Node; later, a server) the rules get the same files read from disk.
 */
export const DojoCartridge = createDojo(LEVELS);
