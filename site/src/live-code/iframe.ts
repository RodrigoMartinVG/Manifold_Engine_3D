/**
 * THE IFRAME'S DOCUMENT, where a lesson's code runs (decision 0007).
 *
 * The iframe is `sandbox="allow-scripts"`, WITHOUT `allow-same-origin`: its origin is a different
 * one (an "opaque" one), so the code the reader edits cannot read anything of the site (its
 * storage, its cookies) nor touch the page. They only talk through messages (`postMessage`), both
 * ways:
 *
 *   page ──► iframe   { type: 'run', modules }            the libraries and the files, already in JavaScript
 *   iframe ──► page   { type: 'ready' }                    ready to receive them
 *                     { type: 'console', level, text }     what the lesson writes with console.log
 *                     { type: 'error', text }              an error (with its file and line)
 *                     { type: 'frames', n }                how many frames it drew (for the tests)
 *
 * Each module becomes a `blob:` (a file that exists only in the iframe's memory), and an IMPORT MAP
 * (`<script type="importmap">`) tells the browser which `blob:` is `three` and which one is
 * `lesson/main`. It is what a bundler like Vite does, but backwards: instead of joining the modules
 * into one file, it tells the browser where each one is.
 *
 * (What the reader sees, like "(main.ts, línea 12)", is the site's text, in Spanish.)
 */
export function iframeDocument(): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<style>
  html, body { margin: 0; height: 100%; overflow: hidden; background: #15120f; color: #e6dccb; font: 13px/1.4 system-ui, sans-serif; }
  canvas { display: block; }
  /* The lil-gui panels, in the site's colors (its CSS variables; "html" beats its own). */
  html .lil-gui {
    --background-color: #1b1814; --widget-color: #2f2922; --hover-color: #3b332a; --focus-color: #473d31;
    --text-color: #dcd2c3; --title-background-color: #2a221a; --title-text-color: #f0d59a;
    --number-color: #93d9c9; --string-color: #e9c48c;
  }
  /* In a narrow place (a phone), a smaller panel, so it does not cover the scene. */
  @media (max-width: 520px) {
    html .lil-gui { --width: 180px; --font-size: 10px; --input-font-size: 10px; --widget-height: 16px; --padding: 3px; --spacing: 3px; }
    html .lil-gui.root { opacity: 0.9; }
  }
</style>
<script>
  const parent = window.parent;
  const send = (m) => parent.postMessage({ fromLiveCode: true, ...m }, '*');
  const names = {};
  const asText = (v) => {
    if (typeof v === 'string') return v;
    if (v instanceof Error) return v.message;
    try {
      return JSON.stringify(v, (_, x) => (typeof x === 'number' && !Number.isInteger(x) ? Math.round(x * 1e4) / 1e4 : x));
    } catch {
      return String(v);
    }
  };
  for (const level of ['log', 'info', 'warn', 'error']) {
    const original = console[level].bind(console);
    console[level] = (...args) => {
      send({ type: 'console', level, text: args.map(asText).join(' ') });
      original(...args);
    };
  }
  // An error's file and line: the browser says "blob:...", and here it becomes the file's name.
  const where = (file, line) => {
    const name = names[file];
    return name ? ' (' + name + ', línea ' + line + ')' : '';
  };
  addEventListener('error', (e) => send({ type: 'error', text: e.message + where(e.filename, e.lineno) }));
  addEventListener('unhandledrejection', (e) => send({ type: 'error', text: asText(e.reason) }));
  // Count the frames without the lesson knowing: requestAnimationFrame is wrapped.
  let frames = 0;
  const requestFrame = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (f) =>
    requestFrame((t) => {
      if (++frames % 10 === 0) send({ type: 'frames', n: frames });
      f(t);
    });
  addEventListener('message', (e) => {
    if (e.source !== parent || !e.data || e.data.type !== 'run') return;
    const imports = {};
    for (const [specifier, code] of Object.entries(e.data.modules)) {
      const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
      imports[specifier] = url;
      names[url] = specifier.startsWith('lesson/') ? specifier.slice(7) + '.ts' : specifier;
    }
    const map = document.createElement('script');
    map.type = 'importmap';
    map.textContent = JSON.stringify({ imports });
    document.head.append(map);
    const start = document.createElement('script');
    start.type = 'module';
    start.textContent = "import 'lesson/main';";
    document.head.append(start);
  });
  send({ type: 'ready' });
</script>
</head>
<body></body>
</html>`;
}
