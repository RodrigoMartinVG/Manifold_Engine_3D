// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

/**
 * The Manifold Gaming site (decision 0002): Astro, with Starlight for the tutorial. It is published
 * on GitHub Pages, at https://rodrigomartinvg.github.io/Manifold_Gaming/ : that is why every address
 * starts with `base`. The site's TEXT is in Spanish (decision 0011); its code, in English.
 */
export default defineConfig({
  site: 'https://rodrigomartinvg.github.io',
  base: '/Manifold_Gaming',
  trailingSlash: 'always',
  integrations: [
    starlight({
      title: 'Manifold Gaming',
      description: 'Un laboratorio de mundos físicos en 3D para la web.',
      defaultLocale: 'root',
      locales: { root: { label: 'Español', lang: 'es' } },
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/RodrigoMartinVG/Manifold_Gaming' }],
      // The "workshop" look (bronze, patina and compass constructions): src/styles/workshop.css.
      logo: { src: './src/assets/drawings/logo.svg', alt: '' },
      favicon: '/favicon.svg',
      customCss: ['@fontsource-variable/cinzel', './src/styles/workshop.css'],
      components: {
        // The home page has its own hero, with the live 3D showcase.
        Hero: './src/components/Hero.astro',
        // Next to the title, the site's sections (and, on a phone, a bar at the bottom).
        SiteTitle: './src/components/SiteTitle.astro',
        // Next to the theme selector, the buttons that hide the side panels.
        ThemeSelect: './src/components/ThemeSelect.astro',
        // Each side panel, with its "Ocultar" button on top.
        Sidebar: './src/components/Sidebar.astro',
        PageSidebar: './src/components/PageSidebar.astro',
      },
      // The panels hidden on another page: applied before drawing, so nothing flickers.
      head: [
        {
          tag: 'script',
          content:
            "try{for(const[k,a]of[['mg-no-sidebar','data-no-sidebar'],['mg-no-toc','data-no-toc']])if(localStorage.getItem(k)==='1')document.documentElement.setAttribute(a,'')}catch{}",
        },
      ],
      // The whole site's sidebar; each page shows only its section's part (src/route-data.ts).
      sidebar: [
        {
          label: 'Tutorial',
          items: [
            { label: 'Empezar aquí', link: '/tutorial/' },
            { label: 'Etapa 0: cimientos', items: [{ autogenerate: { directory: 'tutorial/etapa-0' } }] },
            { label: 'Etapa 1: física y un personaje', items: [{ autogenerate: { directory: 'tutorial/etapa-1' } }] },
            { label: 'Glosario', link: '/tutorial/glosario/' },
          ],
        },
        { label: 'Bitácora', items: [{ autogenerate: { directory: 'bitacora' } }] },
      ],
      routeMiddleware: './src/route-data.ts',
    }),
  ],
});
