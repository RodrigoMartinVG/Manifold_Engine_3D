/**
 * THE EXAMPLES USE THE WHOLE WIDTH. A lesson's text goes in a narrow column (it reads better), but
 * an example needs room: the code and what it draws. So every example breaks out of the column and
 * takes the central panel's width; and if that width is enough, it puts the code and the result
 * side by side, like in full screen.
 *
 * The panel's width changes with the window and with the side panels (which can be hidden), so it
 * is measured with a ResizeObserver. The CSS (LiveCode.astro) uses what is measured: `--lc-width`
 * and `--lc-offset` (how far to move left), plus `data-wide` and `data-side-by-side`.
 *
 * (Why not with CSS "container queries": the panel would have to be a container, and that makes it
 * the reference for whatever has `position: fixed` inside. The example "expanded" without full
 * screen, the iPhone one, would stop covering the window.)
 */

/** Wider than this is no use: on a huge monitor, the example is centered. */
const MAX_WIDTH = 1800;
/** From this width on, the code and the result go side by side. */
export const SIDE_BY_SIDE = 960;

export function widenExamples(examples: HTMLElement[]) {
  const panel = examples[0]?.closest<HTMLElement>('.content-panel');
  if (!panel) return;

  const measure = () => {
    const style = getComputedStyle(panel);
    const box = panel.getBoundingClientRect();
    const left = parseFloat(style.paddingLeft);
    const free = box.width - left - parseFloat(style.paddingRight);
    const width = Math.min(free, MAX_WIDTH);
    const start = box.left + left + (free - width) / 2;
    for (const example of examples) {
      const column = example.parentElement!.getBoundingClientRect();
      const widen = width > column.width + 1;
      example.toggleAttribute('data-wide', widen);
      example.toggleAttribute('data-side-by-side', width >= SIDE_BY_SIDE);
      if (widen) {
        example.style.setProperty('--lc-width', `${width}px`);
        example.style.setProperty('--lc-offset', `${start - column.left}px`);
      }
    }
  };
  new ResizeObserver(measure).observe(panel);
  measure();
}
