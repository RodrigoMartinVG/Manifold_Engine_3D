import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { BASE, sectionOf } from './sections';

type Entry = App.Locals['starlightRoute']['sidebar'][number];

/**
 * EACH SECTION, ITS OWN INDEX. Starlight builds one sidebar for the whole site, and its
 * previous/next links follow it in order: from the glossary, "next" went to the Bitácora. Here,
 * before each page is drawn, the sidebar keeps only the page's section, and previous/next never
 * leave it. A section with a single page (Jugar, Proyecto) shows no sidebar at all.
 */
export const onRequest = defineRouteMiddleware((context) => {
  const route = context.locals.starlightRoute;
  const section = sectionOf(route.id);
  if (!section) return; // the home page: no sidebar
  const inSection = (href: string) => href.startsWith(`${BASE}${section}/`);

  // (The section's group keeps its heading: it names the section, and its links stay small.)
  const sidebar = keep(route.sidebar, inSection);
  route.sidebar = sidebar;
  route.hasSidebar &&= countLinks(sidebar) > 1;

  const { prev, next } = route.pagination;
  route.pagination = {
    prev: prev && inSection(prev.href) ? prev : undefined,
    next: next && inSection(next.href) ? next : undefined,
  };
});

/** The entries (and the groups, with what is left of them) whose links pass the filter. */
function keep(entries: Entry[], pass: (href: string) => boolean): Entry[] {
  return entries.flatMap((e): Entry[] => {
    if (e.type === 'link') return pass(e.href) ? [e] : [];
    const inner = keep(e.entries, pass);
    return inner.length ? [{ ...e, entries: inner }] : [];
  });
}

function countLinks(entries: Entry[]): number {
  return entries.reduce((n, e) => n + (e.type === 'link' ? 1 : countLinks(e.entries)), 0);
}
