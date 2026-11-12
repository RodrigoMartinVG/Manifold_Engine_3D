import * as THREE from 'three';
import type { Quat, Vec3 } from '@manifold/common';
import { declareHelp, type Message, type Registry } from '@manifold/commands';
import { Clock, registryFor, Session, stateHash, type Cartridge, type Entity, type EntityId, type World } from '@manifold/core';
import { mountConsole, type ConsoleOptions, type GameConsole } from './console';

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
  camera.position.set(3.2, 2.4, 4.2);
  camera.lookAt(0, 1, 0);
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
  let session: Session;
  let started = false;
  let clock = new Clock();

  // ---------- What the view lets people change (decision 0010: scope "view") ----------
  let wireframe = false;
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
      for (const mesh of meshes.values()) (mesh.material as THREE.MeshLambertMaterial).wireframe = wireframe;
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
    description: 'Stop the world (with "step" it advances one at a time).',
    scope: 'view',
    type: { kind: 'boolean' },
    default: false,
    onChange: (v) => (paused = v === true),
  });
  registry.declareCommand({
    name: 'pause',
    description: 'Stops or resumes the world (the same as toggle view.paused).',
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
  if (gameConsole) declareHelp(registry);

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
    const geometry = geometries[e.appearance.shape];
    const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color: e.appearance.color, wireframe }));
    mesh.scale.set(...e.appearance.size);
    scene.add(mesh);
    meshes.set(e.id, mesh);
  };
  const removeMesh = (id: EntityId) => {
    const mesh = meshes.get(id);
    if (mesh) {
      scene.remove(mesh);
      (mesh.material as THREE.Material).dispose();
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
  }
  function restart() {
    startSession();
  }
  startSession();
  // From now on, changing a startup value (from the console) makes the world start over.
  registry.onStartupChange = restart;

  function advance() {
    savePrevious();
    session.step();
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
    renderer.render(scene, camera);
    framesThisSecond++;
    if (now - secondStart >= 1000) {
      perSecond = Math.round((framesThisSecond * 1000) / (now - secondStart));
      framesThisSecond = 0;
      secondStart = now;
    }
    // For the browser tests (Playwright): how many frames were drawn and how many meshes are really
    // in the scene (not in the map: the bug above did not show there).
    if (++frames % 10 === 0) {
      container.dataset.frames = String(frames);
      container.dataset.meshes = String(scene.children.filter((x) => x instanceof THREE.Mesh).length);
      container.dataset.step = String(world.tick);
      if (!stats.hidden)
        stats.textContent = [
          `step ${world.tick}${paused ? ' (paused)' : ''}`,
          `hash ${hex(stateHash(world))}`,
          `${world.entities.size} entities · ${perSecond} fps`,
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
      session.world.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      stats.remove();
    },
  };
}

const hex = (n: number) => n.toString(16).padStart(8, '0');
