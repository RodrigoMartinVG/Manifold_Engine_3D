// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

/**
 * El sitio de Manifold Gaming (decisión 0002): Astro, con Starlight para el tutorial.
 * Se publica en GitHub Pages, en https://rodrigomartinvg.github.io/Manifold_Gaming/ :
 * por eso todas las direcciones empiezan con `base`.
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
      // La estética del "taller" (bronce, pátina y construcciones con compás): src/estilos/taller.css.
      logo: { src: './src/assets/dibujos/marca.svg', alt: '' },
      favicon: '/favicon.svg',
      customCss: ['@fontsource-variable/cinzel', './src/estilos/taller.css'],
      // El inicio tiene su propia portada, con la vitrina 3D en vivo.
      components: { Hero: './src/components/Heroe.astro' },
      sidebar: [
        { label: 'El proyecto', link: '/proyecto/' },
        { label: 'Jugar', link: '/jugar/' },
        {
          label: 'Tutorial',
          items: [
            { label: 'Cómo funciona', link: '/tutorial/' },
            { label: 'Etapa 0: cimientos', items: [{ autogenerate: { directory: 'tutorial/etapa-0' } }] },
          ],
        },
        { label: 'Bitácora', items: [{ autogenerate: { directory: 'bitacora' } }] },
      ],
    }),
  ],
});
