/**
 * LOS EJEMPLOS USAN TODO EL ANCHO. El texto de una lección va en una columna angosta (se lee
 * mejor), pero un ejemplo necesita lugar: el código y lo que dibuja. Así que cada ejemplo se sale
 * de la columna y ocupa el ancho del panel central; y si ese ancho alcanza, pone el código y el
 * resultado lado a lado, como en la pantalla completa.
 *
 * El ancho del panel cambia con la ventana y con los paneles de los costados (que se pueden
 * ocultar), así que se mide con un ResizeObserver. El CSS (CodigoVivo.astro) usa lo medido:
 * `--cv-ancho` y `--cv-correr` (cuánto correrse a la izquierda), más `data-ancho` y
 * `data-lado-a-lado`.
 *
 * (Por qué no con "container queries" de CSS: el panel tendría que ser un contenedor, y eso lo
 * convierte en la referencia de lo que tiene `position: fixed` adentro. El ejemplo "ampliado" sin
 * pantalla completa, el del iPhone, dejaría de cubrir la ventana.)
 */

/** Más ancho que esto no sirve: en un monitor enorme, el ejemplo queda centrado. */
const ANCHO_MAXIMO = 1800;
/** Desde este ancho, el código y el resultado van lado a lado. */
export const LADO_A_LADO = 960;

export function ensancharEjemplos(ejemplos: HTMLElement[]) {
  const panel = ejemplos[0]?.closest<HTMLElement>('.content-panel');
  if (!panel) return;

  const medir = () => {
    const estilo = getComputedStyle(panel);
    const caja = panel.getBoundingClientRect();
    const izquierda = parseFloat(estilo.paddingLeft);
    const libre = caja.width - izquierda - parseFloat(estilo.paddingRight);
    const ancho = Math.min(libre, ANCHO_MAXIMO);
    const inicio = caja.left + izquierda + (libre - ancho) / 2;
    for (const ejemplo of ejemplos) {
      const columna = ejemplo.parentElement!.getBoundingClientRect();
      const ensanchar = ancho > columna.width + 1;
      ejemplo.toggleAttribute('data-ancho', ensanchar);
      ejemplo.toggleAttribute('data-lado-a-lado', ancho >= LADO_A_LADO);
      if (ensanchar) {
        ejemplo.style.setProperty('--cv-ancho', `${ancho}px`);
        ejemplo.style.setProperty('--cv-correr', `${inicio - columna.left}px`);
      }
    }
  };
  new ResizeObserver(medir).observe(panel);
  medir();
}
