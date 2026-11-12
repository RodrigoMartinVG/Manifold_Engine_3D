import type { Registry } from './registry';
import type { Scope } from './types';
import { formatValue, sameValue } from './values';

/** Without accents or capitals, for searching: "Gravity" finds "gravity". */
const normalize = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * A name the console can show as clickable (text in `backticks`), padded to a column: the backticks
 * do not take room on the screen, so the padding is counted without them.
 */
const clickable = (name: string, width = 22) => `\`${name}\`${' '.repeat(Math.max(1, width - name.length))}`;

const SCOPES: readonly [Scope, string][] = [
  ['startup', 'startup: changing them restarts the world'],
  ['world', 'world: they enter at the next step'],
  ['view', 'view: only what is seen'],
];

export interface HelpOptions {
  /** A few lines worth trying first, given by the game (the generic help does not know any game). */
  examples?: readonly string[];
}

/**
 * THE COMMANDS TO FIND YOUR WAY in the console: `help`, `find`, `vars`, `changed`, `toggle` and
 * `reset`. Declared by whoever mounts a console (a game without a console does not need them).
 *
 * Text in `backticks` is something that can be typed: the console shows it as clickable, and a click
 * puts it in the line.
 */
export function declareHelp<W>(registry: Registry<W>, o: HelpOptions = {}) {
  registry.declareCommand({
    name: 'help',
    description: 'How to use the console, or the help for a name.',
    args: [{ name: 'name', type: { kind: 'text' }, optional: true }],
    run([name], out) {
      if (typeof name === 'string') {
        out.write(registry.helpFor(name.toLowerCase()) ?? `no such name "${name}". Try \`find ${name}\`.`);
        return;
      }
      const examples = o.examples ?? [];
      out.write(
        [
          'Type a name to see its value, or the name and a value to change it. A click on a `command` puts it in the line; Enter runs it.',
          ...(examples.length ? [`Try: ${examples.map((e) => `\`${e}\``).join('   ')}`] : []),
          'Tab completes, the arrows go through what you typed, and Esc closes.',
          'To find your way: `find` a word, `vars`, `changed`, `help` a name, `reset` to go back to the defaults.',
          `Commands: ${registry
            .commands()
            .map((c) => `\`${c.name}\``)
            .sort()
            .join(' ')}`,
        ].join('\n'),
      );
    },
  });

  registry.declareCommand({
    name: 'find',
    description: 'Searches the names and the descriptions.',
    args: [{ name: 'text', type: { kind: 'rest' } }],
    run([text], out) {
      const wanted = normalize(String(text));
      const lines = [
        ...registry.variables().map((v) => ({ name: v.decl.name, d: v.decl.description })),
        ...registry.commands().map((c) => ({ name: c.name, d: c.description })),
      ]
        .filter((x) => normalize(`${x.name} ${x.d}`).includes(wanted))
        .map((x) => `${clickable(x.name)}${x.d}`);
      out.write(lines.length ? lines.join('\n') : `nothing with "${text}"`);
    },
  });

  registry.declareCommand({
    name: 'vars',
    description: 'The variables and their values, by scope (all of them, or the ones starting with a prefix: `vars show.`).',
    args: [{ name: 'prefix', type: { kind: 'text' }, optional: true }],
    run([prefix], out) {
      const p = typeof prefix === 'string' ? prefix.toLowerCase() : '';
      const lines: string[] = [];
      for (const [scope, title] of SCOPES) {
        const vars = registry.variables().filter((v) => v.decl.scope === scope && v.decl.name.startsWith(p));
        if (!vars.length) continue;
        lines.push(title);
        for (const v of vars) {
          const changed = !sameValue(v.value, v.decl.default);
          lines.push(
            `  ${clickable(v.decl.name)}${formatValue(v.value)}${changed ? `   (changed; default ${formatValue(v.decl.default)})` : ''}`,
          );
        }
      }
      out.write(lines.length ? lines.join('\n') : `none starts with "${p}"`);
    },
  });

  registry.declareCommand({
    name: 'changed',
    description: 'Only the variables that are not at their default value.',
    run(_, out) {
      const lines = registry
        .changed()
        .map((v) => `${clickable(v.decl.name)}${formatValue(v.value)}   (default ${formatValue(v.decl.default)})`);
      out.write(lines.length ? lines.join('\n') : 'nothing changed: everything is at its default value');
    },
  });

  registry.declareCommand({
    name: 'toggle',
    description: 'Flips an on/off variable: `toggle show.axes`.',
    args: [{ name: 'name', type: { kind: 'text' } }],
    run([name], out) {
      const n = String(name).toLowerCase();
      const v = registry.variables().find((x) => x.decl.name === n);
      if (!v || v.decl.type.kind !== 'boolean') {
        out.write(`toggle: "${n}" is not an on/off variable`, 'error');
        return;
      }
      for (const m of registry.run(`${n} ${v.value ? 'off' : 'on'}`)) out.write(m.text, m.level);
    },
  });

  registry.declareCommand({
    name: 'reset',
    description:
      'Puts a variable back to its default value (`reset dojo.cubes`); with no name, all of them. Each one enters as if typed: startup values restart the world.',
    args: [{ name: 'name', type: { kind: 'text' }, optional: true }],
    run([name], out) {
      const n = typeof name === 'string' ? name.toLowerCase() : null;
      if (n && !registry.variables().some((v) => v.decl.name === n)) {
        out.write(`reset: no variable "${n}"`, 'error');
        return;
      }
      const targets = registry.changed().filter((v) => !n || v.decl.name === n);
      if (!targets.length) {
        out.write(n ? `${n} is already at its default value` : 'nothing to reset: everything is at its default value');
        return;
      }
      // All in one text: if several startup values go back, the world restarts once.
      const text = targets.map((v) => `${v.decl.name} ${formatValue(v.decl.default)}`).join('\n');
      for (const m of registry.run(text)) out.write(m.text, m.level);
    },
  });
}
