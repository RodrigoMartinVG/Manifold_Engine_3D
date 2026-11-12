import { closest, LINK_PREFIX, recipeToLink, type Level, type Message, type Registry } from '@manifold/commands';

export interface ConsoleOptions {
  /** To keep each game's things apart (the history, the bindings, the startup recipe): "dojo". */
  game: string;
  /** The game's saved rooms, by name: for `load`. */
  rooms?: Readonly<Record<string, { title: string; text: string }>>;
  /** A room's own address (if the site gives it one): when it is loaded, the address bar shows it. */
  roomUrl?(name: string): string;
}

export interface GameConsole {
  write(text: string, level?: Level | 'echo'): void;
  open(): void;
  close(): void;
  readonly isOpen: boolean;
  /** This person's startup recipe, for this game (or null). */
  startupRecipe(): string | null;
  stop(): void;
}

/** What the console needs from whoever mounts it. */
export interface ConsoleActions {
  restart(): void;
}

/** The console key, as in Quake: the one to the left of 1 (º on a Spanish keyboard, ` on an English one). */
const KEY = 'Backquote';
const MAX_HISTORY = 100;
const MAX_LINES = 400;

/**
 * THE CONSOLE (decision 0010): a text box over the game that shows, completes and runs what is
 * declared in the registry. It does not run code: a line is a command with its arguments. It is a
 * piece the game mounts if it wants to (the Dojo, yes; others, maybe not). Its vocabulary is
 * English and fixed, like a programming language (decision 0011).
 *
 * Besides what is declared, it brings what depends on the browser and on each person: `export`
 * (the recipe of what changed, as a link), `load` (a saved room), `startup` (one's own startup
 * recipe), `bind`/`unbind` (keys for commands) and `clear`. None of them can be used from a recipe:
 * someone else's link never touches the saved preferences.
 */
export function mountConsole(
  container: HTMLElement,
  registry: Registry<unknown> | Registry<never>,
  o: ConsoleOptions,
  actions: ConsoleActions,
): GameConsole {
  // (The registry is used without looking at the world's type: the console does not need it.)
  const r = registry as Registry<unknown>;
  const saved = storage(`manifold.${o.game}`);
  addStyles();

  const root = document.createElement('div');
  root.className = 'mg-console';
  root.dataset.open = 'false';
  const log = document.createElement('div');
  log.className = 'mg-console-log';
  log.setAttribute('role', 'log');
  const row = document.createElement('label');
  row.className = 'mg-console-line';
  const input = document.createElement('input');
  input.setAttribute('aria-label', 'Command');
  input.autocomplete = 'off';
  input.spellcheck = false;
  row.append(Object.assign(document.createElement('span'), { textContent: ']' }), input);
  root.append(log, row);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'mg-console-button';
  button.textContent = '›_';
  button.title = 'Console (the key left of 1)';
  button.setAttribute('aria-label', 'Open the console');
  container.append(root, button);

  // ---------- Writing ----------
  function write(text: string, level: Level | 'echo' = 'info') {
    for (const line of text.split('\n')) {
      const div = document.createElement('div');
      div.className = `mg-console-${level}`;
      div.textContent = line;
      log.append(div);
    }
    while (log.childElementCount > MAX_LINES) log.firstElementChild?.remove();
    log.scrollTop = log.scrollHeight;
  }
  const show = (messages: Message[]) => messages.forEach((m) => write(m.text, m.level));

  // ---------- Opening and closing ----------
  let isOpen = false;
  function open() {
    isOpen = true;
    root.dataset.open = 'true';
    input.focus();
  }
  function close() {
    isOpen = false;
    root.dataset.open = 'false';
    input.blur();
  }
  button.addEventListener('click', () => (isOpen ? close() : open()));

  // ---------- The history (what was typed, kept for next time) ----------
  const typed: string[] = saved.read('history') ?? [];
  let inHistory = typed.length;

  function run(text: string) {
    write(`] ${text}`, 'echo');
    if (text.trim() && typed[typed.length - 1] !== text) {
      typed.push(text);
      typed.splice(0, Math.max(0, typed.length - MAX_HISTORY));
      saved.write('history', typed);
    }
    inHistory = typed.length;
    show(r.run(text, 'console'));
  }

  // ---------- The keys ----------
  input.addEventListener('keydown', (e) => {
    e.stopPropagation(); // while typing, the keys belong to the console, not to the game
    if (e.code === KEY) {
      e.preventDefault();
      close();
    } else if (e.key === 'Enter') {
      run(input.value);
      input.value = '';
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const { candidates, line } = r.complete(input.value);
      if (candidates.length > 1) write(candidates.join('   '));
      input.value = line;
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      inHistory = Math.max(0, Math.min(typed.length, inHistory + (e.key === 'ArrowUp' ? -1 : 1)));
      input.value = typed[inHistory] ?? '';
    } else if (e.key === 'Escape') close();
  });

  const onKey = (e: KeyboardEvent) => {
    if (e.code === KEY && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      if (isOpen) close();
      else open();
      return;
    }
    // The bindings: only with the console closed, and if nothing else is being typed into.
    const target = e.target as HTMLElement | null;
    if (isOpen || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (target?.closest('input, textarea, select, [contenteditable]')) return;
    const command = binds[e.key.toLowerCase()];
    if (command) {
      e.preventDefault();
      write(`] ${command}   (bind ${e.key.toLowerCase()})`, 'echo');
      show(r.run(command, 'console'));
    }
  };
  document.addEventListener('keydown', onKey);

  // ---------- The console's commands ----------
  const binds: Record<string, string> = saved.read('binds') ?? {};

  r.declareCommand({
    name: 'export',
    description: 'Builds a link with the recipe of what you changed: whoever opens it sees the same.',
    run(_, out) {
      if (r.changed().length === 0) {
        out.write('nothing to export: everything is at its default value');
        return;
      }
      const link = `${location.origin}${location.pathname}#${LINK_PREFIX}${recipeToLink(r.recipe())}`;
      out.write(link);
      out.write(r.recipe().trimEnd());
      navigator.clipboard?.writeText(link).then(
        () => write('(link copied)'),
        () => undefined,
      );
    },
  });

  r.declareCommand({
    name: 'load',
    description: 'Loads a saved room (with no name: the list of rooms).',
    args: [{ name: 'room', type: { kind: 'text' }, optional: true }],
    run([name], out) {
      const rooms = o.rooms ?? {};
      if (typeof name !== 'string') {
        const list = Object.entries(rooms).map(([n, room]) => `${n.padEnd(16)} ${room.title}`);
        out.write(list.length ? list.join('\n') : 'this game has no saved rooms');
        return;
      }
      const room = rooms[name.toLowerCase()];
      if (!room) {
        const suggestion = closest(name.toLowerCase(), Object.keys(rooms));
        out.write(`no room "${name}"${suggestion ? `. Did you mean "${suggestion}"?` : ''}`, 'error');
        return;
      }
      // From scratch: the defaults, the startup recipe and the room's. One single restart at the end.
      const onStartupChange = r.onStartupChange;
      r.onStartupChange = null;
      r.reset();
      const startup = saved.read<string>('startup');
      const messages = [...(startup ? r.run(startup, 'recipe') : []), ...r.run(room.text, 'recipe')];
      r.onStartupChange = onStartupChange;
      for (const m of messages.filter((m) => m.level === 'error')) out.write(m.text, 'warn');
      actions.restart();
      if (o.roomUrl) window.history.replaceState(null, '', o.roomUrl(name.toLowerCase()));
      out.write(`room "${name.toLowerCase()}": ${room.title}`);
    },
  });

  r.declareCommand({
    name: 'startup',
    description:
      'Your startup recipe for this game: "startup save" saves what you changed, and it is applied every time you open it; "startup clear" deletes it.',
    args: [{ name: 'action', type: { kind: 'option', options: ['save', 'clear'] }, optional: true }],
    run([action], out) {
      if (action === 'save') {
        saved.write('startup', r.recipe('My startup recipe'));
        out.write('saved: it is applied every time you open this game');
      } else if (action === 'clear') {
        saved.remove('startup');
        out.write('cleared');
      } else
        out.write(
          saved.read<string>('startup')?.trimEnd() ?? 'you have no startup recipe ("startup save" saves what you changed)',
        );
    },
  });

  r.declareCommand({
    name: 'bind',
    description: 'A key for a command, with the console closed: "bind t toggle show.wireframe". With nothing: the list.',
    args: [
      { name: 'key', type: { kind: 'text' }, optional: true },
      { name: 'command', type: { kind: 'rest' }, optional: true },
    ],
    run([key, command], out) {
      if (typeof key !== 'string') {
        const list = Object.entries(binds).map(([k, c]) => `${k.padEnd(5)} ${c}`);
        out.write(list.length ? list.join('\n') : 'no bindings (for example: bind t toggle show.wireframe)');
        return;
      }
      const k = key.toLowerCase();
      if (!validKey(k)) {
        out.write('the key has to be a letter, a digit, or f1 to f12', 'error');
        return;
      }
      if (typeof command !== 'string') {
        out.write(binds[k] ? `${k}: ${binds[k]}` : `the key ${k} has no binding`);
        return;
      }
      binds[k] = command.replace(/^"(.*)"$/, '$1');
      saved.write('binds', binds);
      out.write(`${k}: ${binds[k]}`);
    },
  });

  r.declareCommand({
    name: 'unbind',
    description: 'Removes a key binding: "unbind t".',
    args: [{ name: 'key', type: { kind: 'text' } }],
    run([key], out) {
      const k = String(key).toLowerCase();
      if (!binds[k]) {
        out.write(`the key ${k} has no binding`, 'error');
        return;
      }
      delete binds[k];
      saved.write('binds', binds);
      out.write(`the key ${k} has no binding now`);
    },
  });

  r.declareCommand({
    name: 'clear',
    description: 'Clears what is written in the console.',
    run: () => log.replaceChildren(),
  });

  write(`${o.game} console. Type "help" to start; Tab completes, Esc closes.`);

  return {
    write,
    open,
    close,
    get isOpen() {
      return isOpen;
    },
    startupRecipe: () => saved.read<string>('startup'),
    stop() {
      document.removeEventListener('keydown', onKey);
      root.remove();
      button.remove();
    },
  };
}

const validKey = (k: string) => /^([a-z0-9]|f([1-9]|1[0-2]))$/.test(k);

/** Saving in the browser, separately for each game. If it cannot (a private window), nothing happens. */
function storage(prefix: string) {
  return {
    read<T>(key: string): T | null {
      try {
        const v = localStorage.getItem(`${prefix}.${key}`);
        return v === null ? null : (JSON.parse(v) as T);
      } catch {
        return null;
      }
    },
    write(key: string, value: unknown) {
      try {
        localStorage.setItem(`${prefix}.${key}`, JSON.stringify(value));
      } catch {
        // no storage: it lasts only while the page is open
      }
    },
    remove(key: string) {
      try {
        localStorage.removeItem(`${prefix}.${key}`);
      } catch {
        // idem
      }
    },
  };
}

/** The styles, once per page: the site's metal and ink (decision 0008). */
function addStyles() {
  if (document.getElementById('mg-console-styles')) return;
  const style = document.createElement('style');
  style.id = 'mg-console-styles';
  style.textContent = `
    .mg-console {
      position: absolute; left: 0; right: 0; top: 0; height: 46%; min-height: 12rem; z-index: 20;
      display: flex; flex-direction: column;
      background: rgb(18 16 13 / 0.94); border-bottom: 1px solid rgb(158 116 70 / 0.65);
      box-shadow: 0 12px 30px -12px rgb(0 0 0 / 0.9);
      font: 13px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace; color: #dcd2c3;
      transform: translateY(-105%); transition: transform 0.18s ease-out; visibility: hidden;
    }
    .mg-console[data-open='true'] { transform: none; visibility: visible; }
    .mg-console-log { flex: 1; overflow-y: auto; padding: 0.6rem 0.9rem; white-space: pre-wrap; }
    .mg-console-echo { color: #93d9c9; }
    .mg-console-warn { color: #e5c07b; }
    .mg-console-error { color: #e88a7d; }
    .mg-console-line {
      display: flex; gap: 0.5rem; align-items: center; padding: 0.45rem 0.9rem;
      border-top: 1px solid rgb(158 116 70 / 0.35); color: #c4a06a;
    }
    .mg-console-line input {
      flex: 1; border: 0; outline: 0; background: transparent; color: #f3e9d8; font: inherit;
    }
    .mg-console-button {
      position: absolute; left: 12px; bottom: 12px; z-index: 21; padding: 0.3rem 0.65rem;
      border: 1px solid #24170a; border-radius: 0.35rem; cursor: pointer;
      background: linear-gradient(160deg, #3c2916, #553c24 55%, #3f2b17); color: #ead5b0;
      font: 700 13px/1.4 ui-monospace, Menlo, monospace; opacity: 0.8;
    }
    .mg-console-button:hover { opacity: 1; }
    @media (prefers-reduced-motion: reduce) { .mg-console { transition: none; } }
  `;
  document.head.append(style);
}
