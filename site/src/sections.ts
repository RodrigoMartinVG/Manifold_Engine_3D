/**
 * THE SITE'S SECTIONS: the four doors, always visible in the header (and, on a phone, in a bar at
 * the bottom). Each one is a folder of the site, with its own sidebar and its own previous/next
 * (route-data.ts). The labels and addresses are the site's text, in Spanish (decision 0011).
 */
export const SECTIONS = [
  { id: 'jugar', label: 'Jugar', icon: 'rocket' },
  { id: 'tutorial', label: 'Tutorial', icon: 'open-book' },
  { id: 'bitacora', label: 'Bitácora', icon: 'pencil' },
  { id: 'proyecto', label: 'Proyecto', icon: 'information' },
] as const;

export type SectionId = (typeof SECTIONS)[number]['id'];

/** The section a page belongs to, from its id (`tutorial/etapa-0/01-primer-cubo` → `tutorial`). The home page has none. */
export function sectionOf(pageId: string): SectionId | null {
  return SECTIONS.find((s) => pageId === s.id || pageId.startsWith(`${s.id}/`))?.id ?? null;
}

/** The site's base address, always with a slash at the end: `/Manifold_Gaming/`. */
export const BASE = import.meta.env.BASE_URL.replace(/\/?$/, '/');
