import { closest } from './closest';
import type { Argument, Command, Message, Level, Output, Scope, Source, Value, Variable } from './types';
import { describeType, formatValue, parseValue, sameValue, tokenize, wordsUsed, splitLines, type Word } from './values';

const NAME = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;

interface Stored<W> {
  decl: Variable<W>;
  value: Value;
}

/** A world change, ready to be applied at the step it belongs to. */
export type Scheduler<W> = (line: string, apply: (world: W) => void) => void;

/**
 * THE REGISTRY (decision 0010): the variables and commands every part declared, and the
 * interpreter that runs a line. It is not a language: a line is a command with its arguments (or
 * several, separated by `;`). No variables of its own, no conditions, no loops.
 *
 * How each change is applied depends on its scope (see `Scope`):
 * - `startup`: it is stored, and when the text ends it tells `onStartupChange` (whoever mounts the
 *   game restarts it). Before there is a world, it is only stored: the world is born with that value.
 * - `world`: it is stored and handed to the `scheduler` (set by the session), which applies it at
 *   the start of the next step and keeps it in its history. Without a session yet, it is only
 *   stored, and the session applies it when the world is created (`applyToWorld`).
 * - `view`: it is stored and applied right away (`onChange`).
 *
 * `W` is the type of the world (the core uses `Registry<World>`); this package does not know it.
 */
export class Registry<W = unknown> {
  private readonly vars = new Map<string, Stored<W>>();
  private readonly cmds = new Map<string, Command<W>>();
  /** Set by the session: how to schedule a world change for the next step. */
  scheduler: Scheduler<W> | null = null;
  /** Set by whoever mounts the game: what to do when a startup value changes (restart). */
  onStartupChange: (() => void) | null = null;

  // ---------------------------------------------------------------- declaring

  declareVariable(v: Variable<W>) {
    this.checkName(v.name);
    if (
      !parseValue(
        v.type,
        tokenize(formatValue(v.default)).map((w) => w.text),
      ).ok
    )
      throw new Error(`${v.name}: the default value is not ${describeType(v.type)}`);
    this.vars.set(v.name, { decl: v, value: copy(v.default) });
  }

  declareCommand(c: Command<W>) {
    this.checkName(c.name);
    const args = c.args ?? [];
    args.forEach((a, i) => {
      if (a.type.kind === 'rest' && i !== args.length - 1) throw new Error(`${c.name}: a "rest" argument can only go last`);
    });
    this.cmds.set(c.name, c);
  }

  private checkName(name: string) {
    if (!NAME.test(name)) throw new Error(`invalid name: "${name}" (lowercase letters, digits, "_" and dots)`);
    if (this.vars.has(name) || this.cmds.has(name)) throw new Error(`already declared: ${name}`);
  }

  // ---------------------------------------------------------------- reading

  /** A variable's current value. Asking for one that does not exist is a programming error. */
  value(name: string): Value {
    const s = this.vars.get(name);
    if (!s) throw new Error(`no such variable: ${name}`);
    return copy(s.value);
  }

  /** Every variable, in declaration order, with its current value. */
  variables(): { decl: Variable<W>; value: Value }[] {
    return [...this.vars.values()].map((s) => ({ decl: s.decl, value: copy(s.value) }));
  }

  commands(): Command<W>[] {
    return [...this.cmds.values()];
  }

  /** The ones that are not at their default value. */
  changed(): { decl: Variable<W>; value: Value }[] {
    return this.variables().filter((v) => !sameValue(v.value, v.decl.default));
  }

  /**
   * The recipe of what was changed (decision 0010): startup and world values with their final
   * values, and view values in a separate section. A recipe is a SETTING, not a story: the
   * commands that were run are not included.
   */
  recipe(title?: string): string {
    const changed = this.changed();
    const line = (v: { decl: Variable<W>; value: Value }) => `${v.decl.name} ${formatValue(v.value)}`;
    const world = changed.filter((v) => v.decl.scope !== 'view').map(line);
    const view = changed.filter((v) => v.decl.scope === 'view').map(line);
    const parts: string[] = [];
    if (title) parts.push(`# ${title}`);
    parts.push(...world);
    if (view.length) parts.push('', '# What is seen', ...view);
    return parts.join('\n') + '\n';
  }

  // ---------------------------------------------------------------- changing

  /** Everything back to its default value (view values are applied right away; the rest, on restart). */
  reset() {
    for (const s of this.vars.values()) {
      if (sameValue(s.value, s.decl.default)) continue;
      s.value = copy(s.decl.default);
      if (s.decl.scope === 'view') s.decl.onChange?.(copy(s.value));
    }
  }

  /** The world values that are not at their default, applied to a freshly created world. */
  applyToWorld(world: W) {
    for (const s of this.vars.values())
      if (s.decl.scope === 'world' && !sameValue(s.value, s.decl.default)) s.decl.onWorld?.(world, copy(s.value));
  }

  /**
   * Runs a text: one or more lines (separated by line breaks or by `;`), with comments (`#`).
   * Returns what should be shown. If a startup value changed, it says so once at the end, even if
   * it changed on several lines.
   */
  /** The world values (scope `world`) as they are now: for a session's save (stage 1d). */
  worldValues(): Map<string, Value> {
    const out = new Map<string, Value>();
    for (const [name, s] of this.vars) if (s.decl.scope === 'world') out.set(name, copy(s.value));
    return out;
  }

  /**
   * Back to saved world values, WITHOUT applying them: the world they belong to comes back with them
   * (from its snapshot). What was not saved stays as it is.
   */
  restoreWorldValues(values: ReadonlyMap<string, Value>) {
    for (const [name, value] of values) {
      const s = this.vars.get(name);
      if (s?.decl.scope === 'world') s.value = copy(value);
    }
  }

  run(text: string, source: Source = 'console'): Message[] {
    const messages: Message[] = [];
    const out: Output = { write: (t, level: Level = 'info') => messages.push({ level, text: t }) };
    let restart = false;
    for (const line of splitLines(text)) if (this.runLine(line, source, out)) restart = true;
    if (restart) this.onStartupChange?.();
    return messages;
  }

  /** One line. Returns whether a startup value changed. */
  private runLine(line: string, source: Source, out: Output): boolean {
    const words = tokenize(line);
    const first = words[0];
    if (!first) return false;
    const name = first.text.toLowerCase();
    const rest = words.slice(1);

    const variable = this.vars.get(name);
    if (variable) {
      if (rest.length === 0) {
        out.write(this.describe(variable));
        return false;
      }
      const parsed = parseValue(
        variable.decl.type,
        rest.map((w) => w.text),
      );
      if (!parsed.ok) {
        out.write(`${name}: ${parsed.error}`, 'error');
        return false;
      }
      const used = wordsUsed(variable.decl.type);
      if (rest.length > used) {
        out.write(`${name}: extra "${rest[used]!.text}"`, 'error');
        return false;
      }
      return this.set(variable, parsed.value, out);
    }

    const command = this.cmds.get(name);
    if (command) {
      if (source === 'recipe' && !command.inRecipes) {
        out.write(`"${name}" cannot be used in a recipe: console only`, 'error');
        return false;
      }
      const args = this.parseArgs(command, line, rest, out);
      if (!args) return false;
      if (command.onWorld) {
        const onWorld = command.onWorld;
        const canonical = [name, ...args.map(formatValue)].join(' ');
        if (this.scheduler) this.scheduler(canonical, (world) => onWorld(world, args));
        else out.write(`${name}: there is no world to do it in yet`, 'error');
        return false;
      }
      command.run?.(args, out);
      return false;
    }

    // The suggestion is the whole line, corrected: in the console it can be clicked (text in `backticks`).
    const suggestion = closest(name, this.names());
    const restOfLine = line.trim().slice(first.text.length);
    out.write(
      suggestion
        ? `no such name "${name}". Did you mean \`${suggestion}${restOfLine}\`?`
        : `no such name "${name}". Try \`find ${name}\` or \`help\`.`,
      'error',
    );
    return false;
  }

  private set(s: Stored<W>, value: Value, out: Output): boolean {
    const name = s.decl.name;
    const changed = !sameValue(s.value, value);
    s.value = copy(value);
    const written = formatValue(value);
    switch (s.decl.scope) {
      case 'startup':
        out.write(`${name} = ${written}${changed && this.onStartupChange ? ' (the world starts over)' : ''}`);
        return changed;
      case 'world': {
        const onWorld = s.decl.onWorld;
        if (this.scheduler && onWorld) this.scheduler(`${name} ${written}`, (world) => onWorld(world, copy(value)));
        out.write(`${name} = ${written}${this.scheduler ? ' (from the next step)' : ''}`);
        return false;
      }
      case 'view':
        s.decl.onChange?.(copy(value));
        out.write(`${name} = ${written}`);
        return false;
    }
  }

  private parseArgs(c: Command<W>, line: string, rest: Word[], out: Output): Value[] | null {
    const args: Value[] = [];
    let i = 0;
    for (const a of c.args ?? []) {
      if (i >= rest.length) {
        if (a.optional) break;
        out.write(`${c.name}: missing ${a.name} (${describeType(a.type)}). Usage: \`${this.usage(c)}\``, 'error');
        return null;
      }
      if (a.type.kind === 'rest') {
        args.push(line.slice(rest[i]!.start).trim());
        i = rest.length;
        break;
      }
      const used = wordsUsed(a.type);
      const parsed = parseValue(
        a.type,
        rest.slice(i, i + used).map((w) => w.text),
      );
      if (!parsed.ok) {
        out.write(`${c.name}: ${a.name}: ${parsed.error}`, 'error');
        return null;
      }
      args.push(parsed.value);
      i += used;
    }
    if (i < rest.length) {
      out.write(`${c.name}: extra "${rest[i]!.text}". Usage: \`${this.usage(c)}\``, 'error');
      return null;
    }
    return args;
  }

  // ---------------------------------------------------------------- help and completion

  /** Every name that can be typed. */
  names(): string[] {
    return [...this.vars.keys(), ...this.cmds.keys()].sort();
  }

  usage(c: Command<W>): string {
    const args = (c.args ?? []).map((a: Argument) => (a.optional ? `[${a.name}]` : a.name));
    return [c.name, ...args].join(' ');
  }

  describe(v: { decl: Variable<W>; value: Value }): string {
    const { decl } = v;
    const scopes: Record<Scope, string> = {
      startup: 'startup: changing it restarts the world',
      world: 'world: it enters at the next step',
      view: 'view',
    };
    return [
      `${decl.name} = ${formatValue(v.value)}   (default ${formatValue(decl.default)} · ${describeType(decl.type)} · ${scopes[decl.scope]})`,
      `  ${decl.description}`,
    ].join('\n');
  }

  /** The help for a name (variable or command), or null if it does not exist. */
  helpFor(name: string): string | null {
    const v = this.vars.get(name);
    if (v) return this.describe(v);
    const c = this.cmds.get(name);
    if (c) return `${this.usage(c)}\n  ${c.description}`;
    return null;
  }

  /**
   * Completion (the Tab key): the name, or the value if the name is already typed and its type has
   * options (on/off, a list). Returns the candidates and the line completed as far as they all agree.
   */
  complete(line: string): { candidates: string[]; line: string } {
    const words = tokenize(line);
    const endsWithSpace = /\s$/.test(line);
    if (words.length === 0 || (words.length === 1 && !endsWithSpace)) {
      const partial = (words[0]?.text ?? '').toLowerCase();
      const candidates = this.names().filter((n) => n.startsWith(partial));
      return { candidates, line: completeUpTo(partial, candidates, '') };
    }
    const name = words[0]!.text.toLowerCase();
    const type = this.vars.get(name)?.decl.type ?? this.cmds.get(name)?.args?.[0]?.type;
    const options =
      type?.kind === 'boolean'
        ? ['on', 'off']
        : type?.kind === 'option'
          ? [...type.options]
          : name === 'help' || name === 'toggle'
            ? this.names()
            : [];
    const partial = endsWithSpace ? '' : (words[words.length - 1]?.text ?? '').toLowerCase();
    if (words.length > (endsWithSpace ? 1 : 2)) return { candidates: [], line };
    const candidates = options.filter((o) => o.startsWith(partial));
    return { candidates, line: completeUpTo(partial, candidates, `${words[0]!.text} `) };
  }
}

/** The longest start that all the candidates share (and a space, if there is only one). */
function completeUpTo(partial: string, candidates: string[], before: string): string {
  if (candidates.length === 0) return before + partial;
  if (candidates.length === 1) return `${before}${candidates[0]} `;
  let common = candidates[0]!;
  for (const c of candidates) while (!c.startsWith(common)) common = common.slice(0, -1);
  return before + (common.length > partial.length ? common : partial);
}

function copy(v: Value): Value {
  return Array.isArray(v) ? [v[0], v[1], v[2]] : v;
}
