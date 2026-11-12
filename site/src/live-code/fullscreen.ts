/**
 * AN EXAMPLE IN FULL SCREEN: the code and what it draws, side by side, taking the whole screen.
 * The layout is done by the CSS (LiveCode.astro) from `data-expanded`; here we only enter, leave and
 * drag the divider.
 *
 * Two ways to expand:
 * - "screen": the browser's full screen (`requestFullscreen`). It is left with Esc or the button;
 *   the browser says so with the `fullscreenchange` event.
 * - "window": when there is none (on the iPhone, only videos can), the example stretches over the
 *   whole window with `position: fixed`. It is left with Esc or the button.
 *
 * In no case does the example move in the page: if the iframe changed parent, the browser would
 * reload it and the example would start from scratch.
 *
 * (The labels are the site's text, in Spanish.)
 */

type Mode = 'screen' | 'window';

const LIMITS = { min: 20, max: 80 }; // the code's width, in % of the screen

export function mountFullscreen(root: HTMLElement, { onEnter }: { onEnter: () => void }) {
  const button = root.querySelector<HTMLButtonElement>('.lc-expand')!;
  const label = button.querySelector<HTMLElement>('.lc-label');
  const divider = root.querySelector<HTMLElement>('.lc-divider')!;

  const mark = (mode: Mode | null) => {
    if (mode) root.dataset.expanded = mode;
    else delete root.dataset.expanded;
    document.documentElement.classList.toggle('lc-has-expanded', mode === 'window');
    button.setAttribute('aria-pressed', String(mode !== null));
    button.title = mode ? 'Volver a la página (Esc)' : 'El código y lo que dibuja, en pantalla completa';
    button.firstElementChild!.textContent = mode ? '✕' : '⛶';
    if (label) label.textContent = mode ? ' Salir' : ' Pantalla completa';
  };

  async function enter() {
    let mode: Mode = 'window';
    if (document.fullscreenEnabled) {
      try {
        await root.requestFullscreen({ navigationUI: 'hide' });
        mode = 'screen';
      } catch {
        // The browser refused (for example, without a click in between): the window stays.
      }
    }
    mark(mode);
    onEnter();
  }

  function leave() {
    // The browser's full screen is left by asking it; it says so with fullscreenchange.
    if (document.fullscreenElement === root) void document.exitFullscreen();
    else mark(null);
  }

  button.addEventListener('click', () => (root.dataset.expanded ? leave() : void enter()));

  // Esc in full screen is handled by the browser: here we only follow along.
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement !== root && root.dataset.expanded === 'screen') mark(null);
  });
  // Esc in the "window" must be handled by hand (unless the editor already used it, e.g. to close
  // the autocompletion).
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !e.defaultPrevented && root.dataset.expanded === 'window') leave();
  });

  // ---------- The divider: dragging it changes how much the code takes ----------
  const setWidth = (percent: number) => {
    const p = Math.round(Math.min(LIMITS.max, Math.max(LIMITS.min, percent)));
    root.style.setProperty('--lc-code', `${p}%`);
    divider.setAttribute('aria-valuenow', String(p));
  };
  divider.addEventListener('pointerdown', (e) => {
    divider.setPointerCapture(e.pointerId);
    root.dataset.dragging = '1'; // meanwhile, the CSS takes the pointer away from the iframe
  });
  divider.addEventListener('pointermove', (e) => {
    if (!divider.hasPointerCapture(e.pointerId)) return;
    const box = root.getBoundingClientRect();
    setWidth(((e.clientX - box.left) / box.width) * 100);
  });
  const release = () => delete root.dataset.dragging;
  divider.addEventListener('pointerup', release);
  divider.addEventListener('pointercancel', release);
  // With the keyboard: the arrows move it by 5 %.
  divider.addEventListener('keydown', (e) => {
    const step = e.key === 'ArrowLeft' ? -5 : e.key === 'ArrowRight' ? 5 : 0;
    if (!step) return;
    e.preventDefault();
    setWidth(Number(divider.getAttribute('aria-valuenow')) + step);
  });
}
