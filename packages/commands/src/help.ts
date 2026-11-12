import type { Registry } from './registry';
import { formatValue } from './values';

/** Without accents or capitals, for searching: "Gravity" finds "gravity". */
const normalize = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * THE COMMANDS TO FIND YOUR WAY in the console: `help`, `find`, `vars`, `changed` and `toggle`.
 * Declared by whoever mounts a console (a game without a console does not need them).
 */
export function declareHelp<W>(registry: Registry<W>) {
  registry.declareCommand({
    name: 'help',
    description: 'How to use the console, or the help for a name.',
    args: [{ name: 'name', type: { kind: 'text' }, optional: true }],
    run([name], out) {
      if (typeof name === 'string') {
        out.write(registry.helpFor(name.toLowerCase()) ?? `no such name "${name}". Try "find ${name}".`);
        return;
      }
      out.write(
        [
          'Type a name to see its value, or the name and a value to change it:',
          '  dojo.cubes            dojo.cubes 20            show.wireframe on',
          'Tab completes, the arrows go through what you typed, and Esc closes.',
          'To find your way: find <text>, vars [prefix], changed, help <name>.',
          `Commands: ${registry
            .commands()
            .map((c) => c.name)
            .sort()
            .join(', ')}`,
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
        .map((x) => `${x.name.padEnd(22)} ${x.d}`);
      out.write(lines.length ? lines.join('\n') : `nothing with "${text}"`);
    },
  });

  registry.declareCommand({
    name: 'vars',
    description: 'The variables and their values (all of them, or the ones starting with a prefix: "vars show.").',
    args: [{ name: 'prefix', type: { kind: 'text' }, optional: true }],
    run([prefix], out) {
      const p = typeof prefix === 'string' ? prefix.toLowerCase() : '';
      const lines = registry
        .variables()
        .filter((v) => v.decl.name.startsWith(p))
        .map((v) => `${v.decl.name.padEnd(22)} ${formatValue(v.value)}`);
      out.write(lines.length ? lines.join('\n') : `none starts with "${p}"`);
    },
  });

  registry.declareCommand({
    name: 'changed',
    description: 'Only the variables that are not at their default value.',
    run(_, out) {
      const lines = registry.changed().map((v) => `${v.decl.name.padEnd(22)} ${formatValue(v.value)}`);
      out.write(lines.length ? lines.join('\n') : 'nothing changed: everything is at its default value');
    },
  });

  registry.declareCommand({
    name: 'toggle',
    description: 'Flips an on/off variable: "toggle show.axes".',
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
}
