import { EditorView, basicSetup } from 'codemirror';
import { EditorState, Prec } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { iframeDocument } from './iframe';
import { mountFullscreen } from './fullscreen';
import { moduleName, transpile } from './transpile';

/**
 * A LIVE EXAMPLE (decision 0007): an editor with one file per tab, and when run, the code runs in
 * an isolated iframe below it, with its console.
 *
 * Only one runs at a time in the whole page: every 3D example uses a WebGL context (browsers allow
 * about 16, and an integrated GPU suffers with several). Running one stops the one that was
 * running: its iframe is removed, and its context with it.
 *
 * For the browser tests, the element writes its state in `data-` attributes: `state` (running /
 * stopped), `frames` (how many it drew) and `errors`.
 *
 * (What the reader sees, the iframe's title and the error texts, is the site's text, in Spanish.)
 */

/**
 * The workshop's colors on top of One Dark: warm charcoal instead of bluish gray, and a bronze
 * cursor. The code's colors (keywords, strings, numbers) are still One Dark's.
 * `Prec.high`: between two themes, the one with more precedence wins.
 */
const workshop = Prec.high(
  EditorView.theme(
    {
      '&': { backgroundColor: '#1a1714', color: '#dcd2c3' },
      '.cm-content': { caretColor: '#e9c48c' },
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#e9c48c' },
      '.cm-gutters': { backgroundColor: '#1a1714', color: '#6f6454', borderRight: '1px solid #2c2620' },
      '.cm-activeLine': { backgroundColor: '#221e19' },
      '.cm-activeLineGutter': { backgroundColor: '#221e19', color: '#b9a98f' },
      '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
        { backgroundColor: '#41362a' },
    },
    { dark: true },
  ),
);

interface File {
  name: string;
  code: string;
}

interface Running {
  stop(): void;
}

let active: Running | null = null;

/** The libraries (Three.js...): fetched once per page, the first time something runs. */
let libraries: Promise<Record<string, string>> | null = null;

function loadLibraries(base: string): Promise<Record<string, string>> {
  libraries ??= (async () => {
    const get = async (file: string) => {
      const response = await fetch(`${base}/vendor/${file}`);
      if (!response.ok) throw new Error(`No se pudo cargar ${file} (${response.status})`);
      return response;
    };
    const manifest = (await (await get('manifest.json')).json()) as Record<string, string>;
    const texts = await Promise.all(
      Object.entries(manifest).map(async ([specifier, file]) => [specifier, await (await get(file)).text()] as const),
    );
    return Object.fromEntries(texts);
  })();
  return libraries;
}

export function mountLiveCode(root: HTMLElement) {
  if (root.dataset.mounted) return;
  root.dataset.mounted = '1';
  const files = JSON.parse(root.dataset.files ?? '[]') as File[];
  const base = (root.dataset.base ?? '/').replace(/\/$/, '');
  const tabs = root.querySelector<HTMLElement>('.lc-tabs')!;
  const editorPlace = root.querySelector<HTMLElement>('.lc-editor')!;
  const result = root.querySelector<HTMLElement>('.lc-result')!;
  const cover = root.querySelector<HTMLButtonElement>('.lc-cover')!;
  const output = root.querySelector<HTMLElement>('.lc-console')!;
  const running: Running = { stop };

  // ---------- The editor: one state per file; the view shows the chosen tab's ----------
  const extensions = [
    Prec.highest(keymap.of([{ key: 'Mod-Enter', run: () => (void run(), true) }])),
    basicSetup,
    javascript({ typescript: true }),
    oneDark,
    workshop,
    EditorView.lineWrapping, // the editor is narrow: long lines continue below, with no horizontal bar
  ];
  const createState = (code: string) => EditorState.create({ doc: code, extensions });
  let states = files.map((f) => createState(f.code));
  let current = 0;
  const view = new EditorView({ state: states[0], parent: editorPlace });

  const markTab = () => tabs.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-selected', String(i === current)));
  files.forEach((f, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.role = 'tab';
    button.textContent = f.name;
    button.addEventListener('click', () => {
      states[current] = view.state;
      current = i;
      view.setState(states[i]!);
      markTab();
    });
    tabs.append(button);
  });
  markTab();

  // ---------- The console ----------
  let errors = 0;
  const write = (level: string, text: string) => {
    const line = document.createElement('div');
    line.className = `lc-line lc-${level}`;
    line.textContent = text;
    output.append(line);
    while (output.childElementCount > 200) output.firstElementChild?.remove();
    output.hidden = false;
    output.scrollTop = output.scrollHeight;
  };
  const reportError = (text: string) => {
    root.dataset.errors = String(++errors);
    write('error', `✖ ${text}`);
  };

  // ---------- Running ----------
  let iframe: HTMLIFrameElement | null = null;
  let modules: Record<string, string> | null = null;

  window.addEventListener('message', (e: MessageEvent) => {
    if (!iframe || e.source !== iframe.contentWindow || !e.data?.fromLiveCode) return;
    const m = e.data as { type: string; level?: string; text?: string; n?: number };
    if (m.type === 'ready' && modules) iframe.contentWindow?.postMessage({ type: 'run', modules }, '*');
    else if (m.type === 'console') write(m.level ?? 'log', m.text ?? '');
    else if (m.type === 'error') reportError(m.text ?? 'error');
    else if (m.type === 'frames') root.dataset.frames = String(m.n ?? 0);
  });

  async function run() {
    states[current] = view.state;
    active?.stop();
    output.replaceChildren();
    output.hidden = true;
    errors = 0;
    root.dataset.errors = '0';
    root.dataset.frames = '0';
    try {
      const own = Object.fromEntries(files.map((f, i) => [moduleName(f.name), transpile(states[i]!.doc.toString())]));
      modules = { ...(await loadLibraries(base)), ...own };
    } catch (e) {
      // A syntax error shows up here, before anything runs.
      reportError((e as Error).message);
      return;
    }
    cover.hidden = true;
    iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.title = 'Lo que dibuja el código';
    iframe.srcdoc = iframeDocument();
    result.append(iframe);
    root.dataset.state = 'running';
    active = running;
  }

  function stop() {
    iframe?.remove();
    iframe = null;
    modules = null;
    cover.hidden = false;
    root.dataset.state = 'stopped';
    if (active === running) active = null;
  }

  root.querySelector('.lc-run')?.addEventListener('click', () => void run());
  cover.addEventListener('click', () => void run());
  root.querySelector('.lc-reset')?.addEventListener('click', () => {
    states = files.map((f) => createState(f.code));
    view.setState(states[current]!);
  });

  mountFullscreen(root, {
    onEnter: () => {
      if (root.dataset.state !== 'running') void run();
      view.focus(); // to type right away
    },
  });

  // A lesson's first example starts by itself when it shows up on screen (if nothing else is running).
  if (root.dataset.autorun) {
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      observer.disconnect();
      if (!active) void run();
    });
    observer.observe(root);
  }
}
