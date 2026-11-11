import { montar, type Montaje } from '@manifold/presentacion';
import { CartuchoDojo } from './cartucho';

/** Arranca el Dojo dentro de `contenedor` (la página `/jugar/dojo/` del sitio). */
export function arrancarDojo(contenedor: HTMLElement): Montaje {
  return montar(CartuchoDojo, contenedor);
}

export { CartuchoDojo };
