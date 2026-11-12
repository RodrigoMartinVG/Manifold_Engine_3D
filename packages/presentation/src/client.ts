import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Quat, Vec3 } from '@manifold/common';
import { declareHelp, type Message, type Registry } from '@manifold/commands';
import {
  Clock,
  registryFor,
  Session,
  stateHash,
  upAt,
  type Appearance,
  type Cartridge,
  type Entity,
  type EntityId,
  type World,
} from '@manifold/core';
import { mountConsole, type ConsoleOptions, type GameConsole } from './console';
import { mountPlayerControls } from './player';

/** A recipe to start with, and where it comes from (for the warnings: "the link's recipe…"). */
export interface InitialRecipe {
  from: string;
  text: string;
}

export interface MountOptions {
  /**
   * The recipes the world is born with, in order (the room's, the link's…): the GAME gathers them,
   * because it knows where they come from (decision 0010). The presentation does not read the address.
   */
  recipes?: readonly InitialRecipe[];
  /** Whether the game mounts the console, and how. Each game decides (decision 0010). */
  console?: ConsoleOptions | false;
  /**
   * The camera. `orbit` is a lab's: dragging turns around the scene, the wheel (or a pinch) gets
   * closer, and a click on an object inspects it in the console. `fixed` (the default) does not move.
   * A game will bring its own (the character's, from phase 1b).
   */
  camera?: 'orbit' | 'fixed';
}

export interface Mount {
  readonly registry: Registry<World>;
  /** The current session (it changes on restart). */
  readonly session: Session;
  readonly console: GameConsole | null;
  /** Creates the world again, with the registry's current values. */
  restart(): void;
  /** Stops drawing and frees the GPU (when leaving the page, or in tests). */
  stop(): void;
}

/** An entity's pose at the previous step: it is drawn halfway between that one and the current one. */
interface Pose {
  position: Vec3;
  rotation: Quat;
}

/**
 * THE CLIENT: mounts a cartridge in an element of the page and makes it run.
 *
 * On every screen frame:
 *   1. the clock says how many fixed steps are due (V1's step 1: the simulation does not depend on FPS);
 *   2. before each step, every thing's pose is saved (the "previous" one);
 *   3. the session advances;
 *   4. every thing is drawn between its previous pose and the current one, by `alpha` (interpolation).
 *
 * The presentation READS the world and never writes it: what is seen is a consequence of the
 * simulation, not the other way round. What can be changed in the view is declared here (`show.*`,
 * `view.*`), and the game decides whether to mount a console to touch it (decision 0010).
 *
 * `container` must be positioned (`position` fixed, absolute or relative): the stats and the
 * console are drawn on top, inside it. And the physics must be ready first (`await initPhysics()`,
 * from the core): it loads asynchronously, and every world has its own.
 */
export function mount(cartridge: Cartridge, container: HTMLElement, o: MountOptions = {}): Mount {
  const registry = registryFor(cartridge);

  // 1× resolution (an integrated GPU, like the Iris Plus, struggles with 2×: four times the pixels).
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  container.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14161c);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 200);
  const START = { position: new THREE.Vector3(3.2, 2.4, 4.2), target: new THREE.Vector3(0, 1, 0) };
  camera.position.copy(START.position);
  camera.lookAt(START.target);
  const controls = o.camera === 'orbit' ? new OrbitControls(camera, renderer.domElement) : null;
  if (controls) {
    controls.target.copy(START.target);
    controls.enableDamping = true; // it slows down smoothly when released
    controls.update();
    controls.saveState(); // for camera.reset
  }
  scene.add(new THREE.HemisphereLight(0xc8d4ff, 0x3a3028, 1.4));
  const sun = new THREE.DirectionalLight(0xfff2e0, 1.8);
  sun.position.set(4, 8, 3);
  scene.add(sun);
  scene.add(new THREE.GridHelper(20, 20, 0x3a4050, 0x262a33));
  const axes = new THREE.AxesHelper(3);
  axes.visible = false;
  scene.add(axes);
  // What the physics sees (show.physics): Rapier's colliders, as lines, redrawn on every frame.
  const physicsLines = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0x7fe0c8, depthTest: false, transparent: true, opacity: 0.85 }),
  );
  physicsLines.visible = false;
  physicsLines.renderOrder = 1;
  physicsLines.frustumCulled = false;
  scene.add(physicsLines);

  const fitSize = () => {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(fitSize);
  observer.observe(container);
  fitSize();

  // ---------- The stats (show.stats): the step, the hash, the frames per second ----------
  const stats = document.createElement('div');
  stats.className = 'mg-stats';
  stats.hidden = true;
  Object.assign(stats.style, {
    position: 'absolute',
    top: '12px',
    right: '12px',
    padding: '6px 10px',
    borderRadius: '6px',
    background: 'rgb(18 16 13 / 0.82)',
    color: '#e6dccb',
    font: '12px/1.5 ui-monospace, Menlo, monospace',
    pointerEvents: 'none',
    whiteSpace: 'pre',
  });
  container.append(stats);

  // The world and its meshes (before anything else: a recipe can ask for show.wireframe, which walks them).
  const meshes = new Map<EntityId, THREE.Mesh>();
  const previous = new Map<EntityId, Pose>();
  const geometries = { box: new THREE.BoxGeometry(1, 1, 1), sphere: new THREE.SphereGeometry(0.5, 24, 16) };
  /**
   * A mesh for an appearance. Boxes and spheres are one shared shape, scaled; a capsule is built at
   * its size (scaling would squash its round ends), with a visor that shows where it looks (−Z).
   */
  const meshFor = (a: Appearance) => {
    const material = new THREE.MeshLambertMaterial({ color: a.color, wireframe });
    if (a.shape !== 'capsule') {
      const mesh = new THREE.Mesh(geometries[a.shape], material);
      mesh.scale.set(...a.size);
      return mesh;
    }
    const radius = a.size[0] / 2;
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, a.size[1] - a.size[0], 6, 16), material);
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(radius * 1.2, radius * 0.45, radius * 0.5),
      new THREE.MeshLambertMaterial({ color: 0x1a1714, wireframe }),
    );
    visor.position.set(0, a.size[1] * 0.28, -radius * 0.85);
    mesh.add(visor);
    return mesh;
  };
  let session: Session;
  let started = false;
  let clock = new Clock();

  // ---------- What the view lets people change (decision 0010: scope "view") ----------
  let wireframe = false;
  // (Declared here, before the recipes run: a recipe may bring `view.camera free`.)
  let follow = true;
  let timescale = 1;
  let paused = false;
  registry.declareVariable({
    name: 'show.wireframe',
    description: 'Meshes as wire: the triangles the graphics card draws.',
    scope: 'view',
    type: { kind: 'boolean' },
    default: false,
    onChange(v) {
      wireframe = v === true;
      for (const mesh of meshes.values())
        mesh.traverse((o) => {
          if (o instanceof THREE.Mesh) (o.material as THREE.MeshLambertMaterial).wireframe = wireframe;
        });
    },
  });
  registry.declareVariable({
    name: 'show.axes',
    description: "The world's axes at the origin: x red, y green, z blue (3 meters).",
    scope: 'view',
    type: { kind: 'boolean' },
    default: false,
    onChange: (v) => (axes.visible = v === true),
  });
  registry.declareVariable({
    name: 'show.physics',
    description: "What the physics sees: every body's collider, as lines (it may not match what is drawn).",
    scope: 'view',
    type: { kind: 'boolean' },
    default: false,
    onChange: (v) => (physicsLines.visible = v === true),
  });
  registry.declareVariable({
    name: 'show.stats',
    description: "The step, the world's hash, the entities and the frames per second.",
    scope: 'view',
    type: { kind: 'boolean' },
    default: false,
    onChange: (v) => (stats.hidden = v !== true),
  });
  registry.declareVariable({
    name: 'view.timescale',
    description:
      'Show the world slower (0.2) or faster (2). The world advances the same, by fixed steps: it does not change the physics or the hash.',
    scope: 'view',
    type: { kind: 'number', min: 0.05, max: 4 },
    default: 1,
    onChange: (v) => (timescale = Number(v)),
  });
  registry.declareVariable({
    name: 'view.paused',
    description: 'Stops the world (with `step` it advances one step at a time).',
    scope: 'view',
    type: { kind: 'boolean' },
    default: false,
    onChange: (v) => (paused = v === true),
  });
  registry.declareCommand({
    name: 'pause',
    description: 'Stops or resumes the world (the same as `toggle view.paused`).',
    run: (_, out) => {
      for (const m of registry.run(`view.paused ${paused ? 'off' : 'on'}`)) out.write(m.text, m.level);
    },
  });
  registry.declareCommand({
    name: 'step',
    description: 'Advances the world n steps (1, if not said), and leaves it paused.',
    args: [{ name: 'n', type: { kind: 'integer', min: 1, max: 600 }, optional: true }],
    run: ([n], out) => {
      registry.run('view.paused on');
      for (let i = 0; i < (typeof n === 'number' ? n : 1); i++) advance();
      out.write(`step ${session.world.tick}`);
    },
  });
  registry.declareCommand({
    name: 'hash',
    description: "The world's step and its hash: a number that sums up its whole state.",
    run: (_, out) => out.write(`step ${session.world.tick} · hash ${hex(stateHash(session.world))}`),
  });
  registry.declareCommand({
    name: 'restart',
    description: 'The world starts over, with the current values.',
    run: (_, out) => {
      restart();
      out.write('the world started over');
    },
  });

  // ---------- The console, if the game mounts it ----------
  const gameConsole = o.console ? mountConsole(container, registry, o.console, { restart: () => restart() }) : null;
  if (gameConsole) declareHelp(registry, { examples: o.console ? o.console.examples : undefined });

  // ---------- Looking inside the world: inspect, and a click on an object ----------
  registry.declareCommand({
    name: 'inspect',
    description:
      'What an entity is made of: its components, with their numbers (a click on an object does it too). With no id: how many entities there are.',
    args: [{ name: 'id', type: { kind: 'integer', min: 1 }, optional: true }],
    run: ([id], out) => out.write(typeof id === 'number' ? inspectEntity(session.world, id) : countEntities(session.world)),
  });
  if (controls) {
    registry.declareVariable({
      name: 'view.camera',
      description:
        'With a character to drive: `follow` keeps the camera behind it (the mouse still turns it around); `free` leaves it where it is.',
      scope: 'view',
      type: { kind: 'option', options: ['follow', 'free'] },
      default: 'follow',
      onChange: (v) => (follow = v === 'follow'),
    });
    registry.declareCommand({
      name: 'camera.reset',
      description:
        'The camera back to where it started, or behind the character (drag to look around; the wheel, or a pinch, gets closer).',
      run: (_, out) => {
        resetCamera();
        out.write(player() ? 'the camera is behind the character' : 'the camera is back where it started');
      },
    });
    // A click (not a drag: dragging turns the camera) on an object inspects it in the console.
    const pointer = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    let down: { x: number; y: number } | null = null;
    renderer.domElement.addEventListener('pointerdown', (e) => (down = e.button === 0 ? { x: e.clientX, y: e.clientY } : null));
    renderer.domElement.addEventListener('pointerup', (e) => {
      if (!down || !gameConsole || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      const box = renderer.domElement.getBoundingClientRect();
      pointer.set(((e.clientX - box.left) / box.width) * 2 - 1, -((e.clientY - box.top) / box.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects([...meshes.values()], false)[0];
      const id = hit && [...meshes].find(([, mesh]) => mesh === hit.object)?.[0];
      if (id === undefined) return;
      gameConsole.open();
      gameConsole.run(`inspect ${id}`);
    });
  }

  // ---------- The recipes the world is born with (the startup one, if there is a console; then the game's) ----------
  const startup = gameConsole?.startupRecipe();
  const recipes = [...(startup ? [{ from: 'your startup recipe', text: startup }] : []), ...(o.recipes ?? [])];
  for (const recipe of recipes) warn(recipe.from, registry.run(recipe.text, 'recipe'));

  function warn(from: string, messages: Message[]) {
    const errors = messages.filter((m) => m.level === 'error');
    if (!errors.length) return;
    const title = `${from}: ${errors.length === 1 ? 'one line was not understood' : `${errors.length} lines were not understood`}`;
    if (gameConsole) {
      gameConsole.write(title, 'warn');
      for (const e of errors) gameConsole.write(`  ${e.text}`, 'warn');
    } else console.warn([title, ...errors.map((e) => e.text)].join('\n'));
  }

  // ---------- The world and its meshes ----------
  const createMesh = (e: Entity) => {
    // Only once per entity. (Bug found in step 0: the ones the cartridge put at the start arrived
    // TWICE, when walking the world and through their `entityCreated` event; the second mesh hid
    // the first one in the map, and the first stayed in the scene, forgotten at the origin.)
    if (!e.appearance || !e.transform || meshes.has(e.id)) return;
    const mesh = meshFor(e.appearance);
    scene.add(mesh);
    meshes.set(e.id, mesh);
  };
  const removeMesh = (id: EntityId) => {
    const mesh = meshes.get(id);
    if (mesh) {
      scene.remove(mesh);
      mesh.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        (o.material as THREE.Material).dispose();
        // Shared shapes (boxes, spheres) stay; a capsule's own shape and its visor's go.
        if (o.geometry !== geometries.box && o.geometry !== geometries.sphere) o.geometry.dispose();
      });
    }
    meshes.delete(id);
    previous.delete(id);
  };
  const savePrevious = () => {
    for (const e of session.world.entities.values()) {
      if (!e.transform) continue;
      previous.set(e.id, { position: [...e.transform.position], rotation: [...e.transform.rotation] });
    }
  };

  // ---------- The player's character (stage 1b): its inputs, and the camera that follows it ----------
  const playerControls = mountPlayerControls({ blocked: () => gameConsole?.isOpen ?? false });
  /** Player 1's character, if the world has one (an entity with `character`). */
  const player = () => [...session.world.entities.values()].find((e) => e.character?.player === 1);
  /**
   * Behind the character and a little above, looking at its head. Or, without a character, where it
   * started. (With damping, what is left of a turn keeps being applied after a reset, and the camera
   * drifts away again; without damping, update() applies that rest at once and throws it away: first
   * that, and then the new place.)
   */
  function resetCamera() {
    if (!controls) return;
    controls.enableDamping = false;
    controls.update();
    const hero = player();
    if (hero?.transform && hero.character) {
      const up = upAt(session.world, hero.transform.position);
      const head = new THREE.Vector3(...hero.transform.position).addScaledVector(new THREE.Vector3(...up), 0.6);
      const behind = new THREE.Vector3(...hero.character.facing).multiplyScalar(-5.5);
      controls.target.copy(head);
      camera.position
        .copy(head)
        .add(behind)
        .addScaledVector(new THREE.Vector3(...up), 2.2);
      camera.up.set(...up);
      controls.update();
    } else controls.reset();
    controls.enableDamping = true;
  }

  /** Creates the world (at the start, and on restart), with the registry's current values. */
  function startSession() {
    for (const id of [...meshes.keys()]) removeMesh(id);
    // The old world's physics lives in WebAssembly's memory, which the garbage collector does not see.
    if (started) session.world.dispose();
    started = true;
    session = new Session(cartridge, { registry });
    session.world.takeEvents(); // the ones from its creation: its meshes are created by walking the world
    for (const e of session.world.entities.values()) createMesh(e);
    savePrevious();
    clock = new Clock();
    if (controls && player()) resetCamera();
  }
  function restart() {
    startSession();
  }
  startSession();
  // From now on, changing a startup value (from the console) makes the world start over.
  registry.onStartupChange = restart;

  // How long the physics takes (for show.stats): the steps of the last second, on average.
  let stepTime = 0;
  let stepsTimed = 0;
  let msPerStep = 0;
  function advance() {
    savePrevious();
    const t0 = performance.now();
    session.step();
    stepTime += performance.now() - t0;
    stepsTimed++;
  }

  const qa = new THREE.Quaternion();
  const qb = new THREE.Quaternion();
  let last = performance.now();
  let frames = 0;
  let request = 0;
  let secondStart = performance.now();
  let framesThisSecond = 0;
  let perSecond = 0;

  const frame = (now: number) => {
    request = requestAnimationFrame(frame);
    const dt = (now - last) / 1000;
    last = now;
    // What player 1 asks for: it enters the world at the next step (the session keeps only the changes).
    const hero = player();
    if (hero?.transform) {
      const look = camera.getWorldDirection(new THREE.Vector3());
      session.setInput(1, playerControls.read([look.x, look.y, look.z], upAt(session.world, hero.transform.position)));
    }
    const steps = paused ? 0 : clock.advance(dt * timescale);
    for (let i = 0; i < steps; i++) advance();
    const world = session.world;
    for (const ev of world.takeEvents()) {
      if (ev.type === 'entityCreated') {
        const e = world.entities.get(ev.id);
        if (e) createMesh(e);
      }
      if (ev.type === 'entityRemoved') removeMesh(ev.id);
    }
    const alpha = paused ? 1 : clock.alpha;
    for (const [id, mesh] of meshes) {
      const t = world.entities.get(id)?.transform;
      const before = previous.get(id) ?? t;
      if (!t || !before) continue;
      mesh.position.set(...before.position).lerp(new THREE.Vector3(...t.position), alpha);
      mesh.quaternion.slerpQuaternions(qa.set(...before.rotation), qb.set(...t.rotation), alpha);
    }
    if (physicsLines.visible) {
      const { vertices } = world.physics.debugLines();
      physicsLines.geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    }
    // The camera follows the character: it moves as much as its head moved (the mouse still turns it).
    const heroMesh = hero && meshes.get(hero.id);
    if (controls && follow && heroMesh && hero?.transform) {
      const up = upAt(world, hero.transform.position);
      const head = heroMesh.position.clone().addScaledVector(new THREE.Vector3(...up), 0.6);
      const moved = head.sub(controls.target);
      controls.target.add(moved);
      camera.position.add(moved);
    }
    controls?.update();
    renderer.render(scene, camera);
    framesThisSecond++;
    if (now - secondStart >= 1000) {
      perSecond = Math.round((framesThisSecond * 1000) / (now - secondStart));
      msPerStep = stepsTimed ? stepTime / stepsTimed : 0;
      framesThisSecond = 0;
      stepTime = 0;
      stepsTimed = 0;
      secondStart = now;
    }
    // For the browser tests (Playwright): how many frames were drawn and how many meshes are really
    // in the scene (not in the map: the bug above did not show there).
    if (++frames % 10 === 0) {
      container.dataset.frames = String(frames);
      container.dataset.meshes = String(scene.children.filter((x) => x instanceof THREE.Mesh).length);
      container.dataset.step = String(world.tick);
      if (hero?.transform) container.dataset.player = hero.transform.position.map((n) => n.toFixed(2)).join(' ');
      container.dataset.camera = camera.position
        .toArray()
        .map((n) => n.toFixed(2))
        .join(' ');
      if (!stats.hidden)
        stats.textContent = [
          `step ${world.tick}${paused ? ' (paused)' : ''}`,
          `hash ${hex(stateHash(world))}`,
          `${world.entities.size} entities · ${world.physics.bodyCount} bodies · ${perSecond} fps`,
          `physics ${msPerStep.toFixed(2)} ms per step`,
          timescale !== 1 ? `timescale ${timescale}×` : '',
        ]
          .filter(Boolean)
          .join('\n');
    }
  };
  request = requestAnimationFrame(frame);

  return {
    registry,
    get session() {
      return session;
    },
    console: gameConsole,
    restart,
    stop() {
      cancelAnimationFrame(request);
      observer.disconnect();
      gameConsole?.stop();
      playerControls.stop();
      controls?.dispose();
      session.world.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      stats.remove();
    },
  };
}

const hex = (n: number) => n.toString(16).padStart(8, '0');

/** A number for reading: three decimals at most, and no "-0" or "1e-17". */
const readable = (n: number) => (Math.abs(n) < 5e-4 ? '0' : String(+n.toFixed(3)));

/** A component's value, in one line: numbers rounded, vectors as "x y z", nested parts in braces, colors in hex. */
function describeValue(v: unknown, key = ''): string {
  if (typeof v === 'number') return key === 'color' ? `#${v.toString(16).padStart(6, '0')}` : readable(v);
  if (Array.isArray(v)) return v.map((x) => describeValue(x)).join(' ');
  if (v && typeof v === 'object')
    return Object.entries(v)
      .map(([k, x]) =>
        x && typeof x === 'object' && !Array.isArray(x) ? `${k} {${describeValue(x)}}` : `${k} ${describeValue(x, k)}`,
      )
      .join(' · ');
  return String(v);
}

/** An entity, component by component (whatever components it has: new ones show up by themselves). */
function inspectEntity(world: World, id: number): string {
  const e = world.entities.get(id);
  if (!e) return `no entity ${id} (there are ${world.entities.size}: \`inspect\` counts them)`;
  const lines = [`entity ${id}, at step ${world.tick}`];
  for (const [k, v] of Object.entries(e)) if (k !== 'id') lines.push(`  ${k.padEnd(11)}${describeValue(v)}`);
  return lines.join('\n');
}

/** How many entities there are, by the kind of body they have. */
function countEntities(world: World): string {
  const kinds = new Map<string, number>();
  for (const e of world.entities.values()) {
    const kind = e.body?.type ?? 'without a body';
    kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
  }
  const parts = [...kinds].map(([k, n]) => `${n} ${k}`).join(', ');
  return `${world.entities.size} entities: ${parts}. A click on an object inspects it, or \`inspect 1\`.`;
}
