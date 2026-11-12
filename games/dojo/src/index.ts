import { recetaDelEnlace } from '@manifold/comandos';
import { montar, type Montaje, type RecetaInicial } from '@manifold/presentacion';
import { CartuchoDojo } from './cartucho';
import { RECETAS } from './recetas';

export interface OpcionesDojo {
  /** La sala guardada por la que se entró (`…/jugar/dojo/lluvia/`), si se entró por una. */
  sala?: string;
  /** La dirección base del sitio (`/Manifold_Gaming/`): para que la barra muestre la sala al cargarla. */
  base?: string;
}

/**
 * Arranca el Dojo dentro de `contenedor` (las páginas `/jugar/dojo/` del sitio).
 *
 * El JUEGO decide de dónde salen sus recetas (decisión 0010), en este orden (la última gana):
 *   1. la de inicio de cada persona (la pone la consola);
 *   2. la de la sala por la que se entró;
 *   3. la dirección vieja (`?cubos=20&semilla=3`), traducida, para no romper enlaces viejos;
 *   4. la del enlace (`#receta=…`), la que arma `exportar`.
 * El mundo nace una sola vez, ya configurado.
 */
export function arrancarDojo(contenedor: HTMLElement, o: OpcionesDojo = {}): Montaje {
  const recetas: RecetaInicial[] = [];
  const sala = o.sala ? RECETAS[o.sala] : undefined;
  if (sala) recetas.push({ de: `la sala "${o.sala}"`, texto: sala.texto });
  const vieja = new URLSearchParams(location.search);
  const traducida = [
    vieja.has('semilla') ? `semilla ${vieja.get('semilla')}` : '',
    vieja.has('cubos') ? `dojo.cubos ${vieja.get('cubos')}` : '',
  ].filter(Boolean);
  if (traducida.length) recetas.push({ de: 'la dirección', texto: traducida.join('\n') });
  const delEnlace = recetaDelEnlace(location.hash);
  if (delEnlace) recetas.push({ de: 'la receta del enlace', texto: delEnlace });

  const base = o.base ?? '/';
  return montar(CartuchoDojo, contenedor, {
    recetas,
    consola: { juego: 'dojo', salas: RECETAS, direccionDeSala: (nombre) => `${base}jugar/dojo/${nombre}/` },
  });
}

export { CartuchoDojo, RECETAS };
