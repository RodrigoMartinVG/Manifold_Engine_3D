import { describe, expect, it, vi } from 'vitest';
import { declareHelp } from './help';
import { Registry } from './registry';
import type { Value } from './types';

/** A fake world for the tests: it only writes down what is done to it. */
interface TestWorld {
  done: string[];
}

function build() {
  const r = new Registry<TestWorld>();
  const view = vi.fn();
  r.declareVariable({ name: 'seed', description: 'The seed.', scope: 'startup', type: { kind: 'integer', min: 0 }, default: 1 });
  r.declareVariable({
    name: 'dojo.cubes',
    description: 'Extra cubes.',
    scope: 'startup',
    type: { kind: 'integer', min: 0, max: 200 },
    default: 0,
  });
  r.declareVariable({
    name: 'physics.gravity',
    description: 'The gravity.',
    scope: 'world',
    type: { kind: 'vector' },
    default: [0, -9.81, 0],
    onWorld: (w, v) => w.done.push(`gravity ${String(v)}`),
  });
  r.declareVariable({
    name: 'show.axes',
    description: 'The axes.',
    scope: 'view',
    type: { kind: 'boolean' },
    default: false,
    onChange: view,
  });
  r.declareVariable({
    name: 'view.timescale',
    description: 'Slower.',
    scope: 'view',
    type: { kind: 'number', min: 0.05, max: 4 },
    default: 1,
  });
  r.declareVariable({
    name: 'view.quality',
    description: 'The quality.',
    scope: 'view',
    type: { kind: 'option', options: ['low', 'medium', 'high'] },
    default: 'medium',
  });
  const done = vi.fn<(args: Value[]) => void>();
  r.declareCommand({
    name: 'step',
    description: 'Advances steps.',
    args: [{ name: 'n', type: { kind: 'integer', min: 1 }, optional: true }],
    run: (args) => done(args),
  });
  r.declareCommand({
    name: 'spawn',
    description: 'Creates something at x y z.',
    args: [{ name: 'place', type: { kind: 'vector' } }],
    onWorld: (w, [place]) => w.done.push(`spawn ${String(place)}`),
  });
  r.declareCommand({
    name: 'bind',
    description: 'A key binding.',
    args: [
      { name: 'key', type: { kind: 'text' } },
      { name: 'line', type: { kind: 'rest' } },
    ],
    run: (args) => done(args),
  });
  return { r, view, done };
}

const texts = (ms: { text: string }[]) => ms.map((m) => m.text).join('\n');
const errors = (ms: { level: string }[]) => ms.filter((m) => m.level === 'error').length;

describe('the registry', () => {
  it('declares and reads; an invalid or repeated name, or a default that is not of its type, is refused', () => {
    const { r } = build();
    expect(r.value('dojo.cubes')).toBe(0);
    expect(r.value('physics.gravity')).toEqual([0, -9.81, 0]);
    const base = { description: '', scope: 'view', type: { kind: 'boolean' }, default: false } as const;
    expect(() => r.declareVariable({ ...base, name: 'Show.Axes' })).toThrow(/invalid name/);
    expect(() => r.declareVariable({ ...base, name: 'show.axes' })).toThrow(/already declared/);
    expect(() => r.declareVariable({ ...base, name: 'show.other', default: 3 })).toThrow(/default value/);
  });

  it('with no arguments, a variable is shown: value, default, type, scope and what it is for', () => {
    const { r } = build();
    const t = texts(r.run('dojo.cubes'));
    expect(t).toContain('dojo.cubes = 0');
    expect(t).toContain('an integer from 0 to 200');
    expect(t).toContain('startup');
    expect(t).toContain('Extra cubes.');
  });

  it('reads every type, and if the value does not fit, it says what it expected', () => {
    const { r } = build();
    r.run('dojo.cubes 20');
    expect(r.value('dojo.cubes')).toBe(20);
    expect(texts(r.run('dojo.cubes 300'))).toContain('expected an integer from 0 to 200, got 300');
    expect(texts(r.run('dojo.cubes many'))).toContain('got "many"');
    expect(texts(r.run('dojo.cubes 2.5'))).toContain('expected an integer');
    expect(texts(r.run('view.timescale 0,25'))).toContain('decimals use a point (0.25)');
    expect(texts(r.run('dojo.cubes 3 4'))).toContain('extra "4"');
    expect(r.value('dojo.cubes')).toBe(20); // none of that changed it

    for (const [typed, value] of [
      ['on', true],
      ['off', false],
      ['1', true],
      ['0', false],
      ['true', true],
      ['no', false],
    ] as const) {
      r.run(`show.axes ${typed}`);
      expect(r.value('show.axes')).toBe(value);
    }
    r.run('view.timescale .25');
    expect(r.value('view.timescale')).toBe(0.25);
    r.run('view.quality HIGH');
    expect(r.value('view.quality')).toBe('high');
    expect(texts(r.run('view.quality ultra'))).toContain('low, medium, high');
    expect(texts(r.run('physics.gravity 0 -3'))).toContain('three numbers');
  });

  it('a name that does not exist suggests the closest one', () => {
    const { r } = build();
    expect(texts(r.run('physics.gravty 0 -3 0'))).toContain('Did you mean "physics.gravity"?');
    expect(texts(r.run('cubes 3'))).toContain('"dojo.cubes"');
    expect(texts(r.run('xyzzy'))).toContain('Try "find xyzzy"');
  });

  it('STARTUP values say so once per text run, and only if something changed', () => {
    const { r } = build();
    const restart = vi.fn();
    r.onStartupChange = restart;
    r.run('seed 7; dojo.cubes 20');
    expect(restart).toHaveBeenCalledTimes(1);
    r.run('seed 7');
    expect(restart).toHaveBeenCalledTimes(1); // same value: it does not start over
  });

  it('WORLD values are not applied right away: they go to the scheduler (the session) with their line', () => {
    const { r } = build();
    const world: TestWorld = { done: [] };
    // No session yet: it is only stored, and the world is born with that value.
    r.run('physics.gravity 0 -3 0');
    expect(world.done).toEqual([]);
    r.applyToWorld(world);
    expect(world.done).toEqual(['gravity 0,-3,0']);

    const scheduled: { line: string; apply: (w: TestWorld) => void }[] = [];
    r.scheduler = (line, apply) => scheduled.push({ line, apply });
    expect(texts(r.run('physics.gravity 0 -1 0'))).toContain('from the next step');
    r.run('spawn 1 2 3');
    expect(scheduled.map((s) => s.line)).toEqual(['physics.gravity 0 -1 0', 'spawn 1 2 3']);
    expect(world.done).toHaveLength(1); // nothing yet: the session applies it, at its step
    for (const s of scheduled) s.apply(world);
    expect(world.done).toEqual(['gravity 0,-3,0', 'gravity 0,-1,0', 'spawn 1,2,3']);
  });

  it('VIEW values are applied right away', () => {
    const { r, view } = build();
    r.run('show.axes on');
    expect(view).toHaveBeenCalledWith(true);
  });

  it('commands read their arguments (optional, missing, extra, the rest of the line)', () => {
    const { r, done } = build();
    r.run('step');
    expect(done).toHaveBeenLastCalledWith([]);
    r.run('step 10');
    expect(done).toHaveBeenLastCalledWith([10]);
    expect(texts(r.run('step 10 20'))).toContain('Usage: step [n]');
    expect(texts(r.run('spawn 1 2'))).toContain('three numbers');
    r.run('bind f "show.axes on; view.timescale 0.5"');
    expect(done).toHaveBeenLastCalledWith(['f', '"show.axes on; view.timescale 0.5"']);
  });

  it('a RECIPE cannot run commands that are not safe for recipes (decision 0010)', () => {
    const { r, done } = build();
    const ms = r.run('dojo.cubes 5\nbind f show.axes on', 'recipe');
    expect(r.value('dojo.cubes')).toBe(5); // variables, yes
    expect(errors(ms)).toBe(1);
    expect(texts(ms)).toContain('"bind" cannot be used in a recipe');
    expect(done).not.toHaveBeenCalled();
  });

  it('splits by line and by ";", and skips comments', () => {
    const { r } = build();
    const ms = r.run('# a comment\ndojo.cubes 3 # at the end\n\nseed 9; show.axes on');
    expect(errors(ms)).toBe(0);
    expect([r.value('dojo.cubes'), r.value('seed'), r.value('show.axes')]).toEqual([3, 9, true]);
  });

  it('the exported recipe has only what changed, with view values in a separate section', () => {
    const { r } = build();
    r.run('dojo.cubes 20; physics.gravity 0 -3 0; show.axes on; view.timescale 0.5');
    expect(r.recipe('My room')).toBe(
      '# My room\ndojo.cubes 20\nphysics.gravity 0 -3 0\n\n# What is seen\nshow.axes on\nview.timescale 0.5\n',
    );
    // And it gives the same again when loaded into a new registry.
    const other = build().r;
    expect(errors(other.run(r.recipe(), 'recipe'))).toBe(0);
    expect(other.recipe('My room')).toBe(r.recipe('My room'));
  });

  it('reset puts everything back to its default (and view values are applied)', () => {
    const { r, view } = build();
    r.run('dojo.cubes 20; show.axes on');
    r.reset();
    expect(r.changed()).toEqual([]);
    expect(view).toHaveBeenLastCalledWith(false);
  });

  it('completes names and values', () => {
    const { r } = build();
    declareHelp(r);
    expect(r.complete('dojo.c').line).toBe('dojo.cubes ');
    expect(r.complete('view.').candidates).toEqual(['view.quality', 'view.timescale']);
    expect(r.complete('show.axes ').candidates).toEqual(['on', 'off']);
    expect(r.complete('view.quality h').line).toBe('view.quality high ');
    expect(r.complete('help dojo').line).toBe('help dojo.cubes ');
  });
});

describe('the help commands', () => {
  it('find ignores accents and capitals; toggle flips an on/off; changed shows only what changed', () => {
    const { r } = build();
    declareHelp(r);
    expect(texts(r.run('find GRAVITY'))).toContain('physics.gravity');
    r.run('toggle show.axes');
    expect(r.value('show.axes')).toBe(true);
    expect(texts(r.run('toggle dojo.cubes'))).toContain('is not an on/off variable');
    expect(texts(r.run('changed'))).toContain('show.axes');
    expect(texts(r.run('changed'))).not.toContain('dojo.cubes');
    expect(texts(r.run('help'))).toContain('Commands:');
    expect(texts(r.run('help spawn'))).toContain('spawn place');
  });
});
