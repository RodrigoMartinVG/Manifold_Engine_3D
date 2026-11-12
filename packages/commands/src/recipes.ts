import { splitLines } from './values';

/**
 * RECIPES IN A LINK (decision 0010). A recipe is plain text: one command per line, with comments
 * (`#`). In a link it goes after `#recipe=`: lines are separated by `;` and spaces are written `+`,
 * so the link can be read and fixed by hand. Everything else is escaped as in any address (a real
 * `+` becomes `%2B`).
 *
 *   dojo.cubes 20           →   #recipe=dojo.cubes+20;show.wireframe+on
 *   show.wireframe on
 *
 * It goes in the FRAGMENT (`#`), which never travels to the server: no server needs to understand it.
 */
export const LINK_PREFIX = 'recipe=';

/** The recipe for a link: without comments or empty lines. */
export function recipeToLink(text: string): string {
  return splitLines(text)
    .map((line) => encodeURIComponent(line).replace(/%20/g, '+'))
    .join(';');
}

/** Back to text, one command per line. If the fragment carries no recipe, null. */
export function recipeFromLink(fragment: string): string | null {
  const withoutHash = fragment.replace(/^#/, '');
  if (!withoutHash.startsWith(LINK_PREFIX)) return null;
  return withoutHash
    .slice(LINK_PREFIX.length)
    .split(';')
    .map((part) => {
      const withSpaces = part.replace(/\+/g, ' ');
      try {
        return decodeURIComponent(withSpaces);
      } catch {
        return withSpaces; // a broken escape: the line is tried anyway, and if it is not understood, it is reported
      }
    })
    .filter((line) => line.trim() !== '')
    .join('\n');
}

/**
 * A recipe's title: its first comment, if it comes before the first command. Like everything in
 * the console, it is in English (decision 0011).
 *
 *   # Cube rain
 *   seed 7
 */
export function recipeTitle(text: string): string | null {
  for (const row of text.split(/\r?\n/)) {
    const line = row.trim();
    if (line.startsWith('#')) return line.replace(/^#\s*/, '') || null;
    if (line !== '') return null; // a command first: the recipe has no title
  }
  return null;
}
