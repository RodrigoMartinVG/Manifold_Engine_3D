import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Quat, Vec3 } from '@manifold/common';
import { declareHelp, formatValue, type Message, type Registry } from '@manifold/commands';
import {
  registryFor,
  replayFromText,
  replayOf,
  ReplayPlayer,
  replayToText,
  Session,
  sessionFor,
  stateHash,
  upAt,
  gravityAt,
  type Appearance,
  type Replay,
  type Cartridge,
  type Entity,
  type EntityId,
  type World,
} from '@manifold/core';
import { Client, localPair, Server, type Channel, type Match, type ToClient, type ToServer } from '@manifold/net';
import { mountConsole, type ConsoleOptions, type GameConsole } from './console';
import { CHARACTER_KEYS, mountPlayerControls, type ControlScheme, type GameButton } from './player';
import { GHOST_PREFIX, REPLAY_PREFIX, replayToFragment } from './replay-link';
import { joinFromTabs, openToTabs } from './tabs';

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
  /** A replay to play when the world is born (its text): the world is born like it, and at the end it is checked. */
  replay?: string;
  /** A replay to race (its text): it runs as a ghost, next to the live player. */
  ghost?: string;
  /** The keys of the game's own buttons (stage 1d): the game declares the actions, and says what presses them. */
  buttons?: readonly GameButton[];
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
 *   1. the server's clock says how many fixed steps are due (V1's step 1: the simulation does not
 *      depend on FPS), and the server takes them: the match (stage 1e: even alone, through a server);
 *   2. this page's copy takes the same steps, with what the server says entered at each one; before
 *      each, every thing's pose is saved (the "previous" one);
 *   3. (that is the client's session: the one drawn);
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
  /** Lines drawn on top of everything, rebuilt on every frame while they are shown (show.vectors, show.contacts). */
  const overlay = (color: number) => {
    const lines = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.9 }),
    );
    lines.visible = false;
    lines.renderOrder = 2;
    lines.frustumCulled = false;
    scene.add(lines);
    return lines;
  };
  const setLines = (lines: THREE.LineSegments, xyz: number[]) =>
    lines.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(xyz), 3));
  // show.vectors (stage 1f): every moving body's velocity (a quarter of a second ahead), and where each character looks.
  const velocityLines = overlay(0xd8e05a);
  const facingLines = overlay(0x5aa8e0);
  // show.contacts: where bodies touch, and the normal of each contact.
  const contactLines = overlay(0xe0705a);
  const contactPoints = new THREE.Points(
    new THREE.BufferGeometry(),
    new THREE.PointsMaterial({ color: 0xe0705a, size: 6, sizeAttenuation: false, depthTest: false }),
  );
  contactPoints.visible = false;
  contactPoints.renderOrder = 2;
  contactPoints.frustumCulled = false;
  scene.add(contactPoints);
  // show.gravity: the field, as arrows on a grid above the floor (in phase 7 they will point to a planet).
  const gravityArrows = new THREE.Group();
  gravityArrows.visible = false;
  for (let x = -6; x <= 6; x += 3)
    for (let z = -6; z <= 6; z += 3) {
      const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(x, 4, z), 1, 0x8a7ae0, 0.3, 0.15);
      gravityArrows.add(arrow);
    }
  scene.add(gravityArrows);

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

  // ---------- The game's notices (stage 2a): "checkpoint", "the goal in 23.4 s"… ----------
  const noticeBox = document.createElement('div');
  noticeBox.className = 'mg-notice';
  noticeBox.hidden = true;
  Object.assign(noticeBox.style, {
    position: 'absolute',
    top: '18%',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '0.5rem 1.2rem',
    borderRadius: '0.4rem',
    background: 'rgb(18 16 13 / 0.78)',
    color: '#f0d59a',
    font: "600 18px/1.4 'Cinzel Variable', Georgia, serif",
    letterSpacing: '0.04em',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
    transition: 'opacity 0.4s',
  });
  container.append(noticeBox);
  let noticeTimer = 0;
  /** A notice on screen for a few seconds (and in the console, if there is one). */
  const showNotice = (text: string) => {
    noticeBox.textContent = text;
    noticeBox.hidden = false;
    noticeBox.style.opacity = '1';
    container.dataset.notice = text;
    gameConsole?.write(text);
    clearTimeout(noticeTimer);
    noticeTimer = window.setTimeout(() => {
      noticeBox.style.opacity = '0';
      noticeTimer = window.setTimeout(() => (noticeBox.hidden = true), 400);
    }, 2600);
  };

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
  /**
   * THE MATCH (stage 1e). Even playing alone, the page plays THROUGH A SERVER: one that lives in this
   * same page, and keeps the match. What is drawn is this page's own copy, its client's session,
   * simulated with what the server says entered at each step, and checked with its hash every second.
   * So every game, even alone, goes the network's way (and checks its determinism while it is played).
   */
  let session: Session;
  /** The match, if this page hosts it (alone, or open to other tabs); null if it joined another tab's. */
  let server: Server | null = null;
  /** This page's place in the match. */
  let link!: Client;
  /** Its player number. */
  let me = 1;
  /** How this page plays: alone, with its match open to other tabs, or in another tab's match. */
  let net: 'alone' | 'open' | 'joined' = 'alone';
  let tabs: { close(): void } | null = null;
  /** Whether the next welcome is the one of a match just joined (its number comes with it). */
  let joining = false;

  // ---------- What the view lets people change (decision 0010: scope "view") ----------
  let wireframe = false;
  // (Declared here, before the recipes run: a recipe may bring `view.camera free`.)
  let cameraMode: 'follow' | 'chase' | 'aim' | 'free' = 'follow';
  let scheme: ControlScheme = 'camera';
  // (Here too, before the recipes: a link may bring `show.sensors on`, and its onChange needs them.)
  /** The zones, as wire boxes (show.sensors), by entity: they have no appearance, they are only shown on request. */
  const zones = new Map<EntityId, THREE.LineSegments>();
  let showZones = false;
  /** When the camera was last turned by hand (a drag, the right stick): `chase` waits a little before coming back. */
  let turnedByHand = -Infinity;
  let dragging = false;
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
    name: 'show.vectors',
    description:
      "Every moving body's velocity, as a line to where it would be in a quarter of a second (yellow), and where each character looks (blue).",
    scope: 'view',
    type: { kind: 'boolean' },
    default: false,
    onChange: (v) => (velocityLines.visible = facingLines.visible = v === true),
  });
  registry.declareVariable({
    name: 'show.contacts',
    description:
      'Where bodies touch now: each contact point the physics uses, and its normal (from the first body to the second).',
    scope: 'view',
    type: { kind: 'boolean' },
    default: false,
    onChange: (v) => (contactLines.visible = contactPoints.visible = v === true),
  });
  registry.declareVariable({
    name: 'show.sensors',
    description:
      "The level's zones, as wire boxes: checkpoints in green, the goal in gold, the void that brings you back in red (stage 2a).",
    scope: 'view',
    type: { kind: 'boolean' },
    default: false,
    onChange: (v) => {
      showZones = v === true;
      for (const zone of zones.values()) zone.visible = showZones;
    },
  });
  registry.declareVariable({
    name: 'show.gravity',
    description: "The gravity field, as arrows: their length is the strength (1 m for every 6.5 m/s²; the Earth's, 1.5 m).",
    scope: 'view',
    type: { kind: 'boolean' },
    default: false,
    onChange: (v) => (gravityArrows.visible = v === true),
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
  /** The match's clock is its host's: a page that joined another tab's match cannot stop it. */
  const hostsTheClock = (out: { write(t: string, l?: 'warn'): void }) => {
    if (server) return true;
    out.write("the match's clock is its host's: this page joined another tab's match", 'warn');
    return false;
  };
  registry.declareCommand({
    name: 'pause',
    description: 'Stops or resumes the world (the same as `toggle view.paused`).',
    run: (_, out) => {
      if (!hostsTheClock(out)) return;
      for (const m of registry.run(`view.paused ${paused ? 'off' : 'on'}`)) out.write(m.text, m.level);
    },
  });
  registry.declareCommand({
    name: 'step',
    description: 'Advances the world n steps (1, if not said), and leaves it paused.',
    args: [{ name: 'n', type: { kind: 'integer', min: 1, max: 600 }, optional: true }],
    run: ([n], out) => {
      if (!hostsTheClock(out)) return;
      registry.run('view.paused on');
      for (let i = 0; i < (typeof n === 'number' ? n : 1); i++) {
        server!.step();
        drainMatch();
      }
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
  registry.declareVariable({
    name: 'controls.scheme',
    description:
      "How the keys (and a gamepad's left stick) drive the character: `camera` goes by where the camera looks (W forward, A and D to its sides; the character looks where it walks); `tank` goes by where the character looks: W and S forward and back, A and D turn it on its own axis, Q and E (or A and D with Alt held) go to its sides. With `view.camera aim` the mouse turns it, and the keys go by the camera.",
    scope: 'view',
    type: { kind: 'option', options: ['camera', 'tank'] },
    default: 'camera',
    onChange: (v) => (scheme = v as ControlScheme),
  });
  registry.declareCommand({
    name: 'inputs',
    description:
      'What a player can ask for in this game, and what presses it (the core declares what the character reads; each game, its own buttons).',
    run: (_, out) => {
      out.write('what a player can ask for:');
      for (const a of session.actions) {
        const keys =
          CHARACTER_KEYS[a.name] ??
          o.buttons
            ?.find((b) => b.action === a.name)
            ?.keys.map((k) => k.replace(/^Key/, ''))
            .join(' or ');
        out.write(`  \`${a.name}\` (${a.kind}): ${a.description}${keys ? ` — ${keys}` : ''}`);
      }
    },
  });
  if (controls) {
    registry.declareVariable({
      name: 'view.camera',
      description:
        "With a character to drive: `follow` follows it as if on a leash: it keeps its distance, and turns little by little when the character goes to a side (dragging turns it around); `chase` goes back behind the character by itself (dragging looks around, and it comes back when you let go: for `controls.scheme tank`); `aim` takes the mouse with a click, the mouse turns the camera and the character looks where the camera looks, walking sideways without turning (a shooter's way; Esc lets the mouse go); `free` leaves the camera where it is. A gamepad's right stick turns it too.",
      scope: 'view',
      type: { kind: 'option', options: ['follow', 'chase', 'aim', 'free'] },
      default: 'follow',
      onChange: (v) => {
        cameraMode = v as typeof cameraMode;
        // In aim mode, the mouse turns the camera without dragging: OrbitControls does not rotate.
        if (controls) controls.enableRotate = cameraMode !== 'aim';
        if (cameraMode !== 'aim' && document.pointerLockElement === renderer.domElement) document.exitPointerLock();
      },
    });
    controls.addEventListener('start', () => (dragging = true));
    controls.addEventListener('end', () => {
      dragging = false;
      turnedByHand = performance.now();
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
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      // Aiming, a click takes the mouse (instead of inspecting): from then on, it turns the camera.
      if (cameraMode === 'aim' && player()) {
        if (document.pointerLockElement !== renderer.domElement) void renderer.domElement.requestPointerLock();
        return;
      }
      if (!gameConsole) return;
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
  const ZONE_COLORS: Record<string, number> = { checkpoint: 0x5ad87a, goal: 0xe0c05a, fall: 0xd85a5a };
  const createZone = (e: Entity) => {
    if (!e.sensor || !e.transform || zones.has(e.id)) return;
    const [x, y, z] = e.sensor.half;
    const box = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(x * 2, y * 2, z * 2)),
      new THREE.LineBasicMaterial({ color: ZONE_COLORS[e.sensor.kind] ?? 0xb0a890 }),
    );
    box.position.set(...e.transform.position);
    box.quaternion.set(...e.transform.rotation);
    box.visible = showZones;
    scene.add(box);
    zones.set(e.id, box);
  };
  const createMesh = (e: Entity) => {
    createZone(e);
    // Only once per entity. (Bug found in step 0: the ones the cartridge put at the start arrived
    // TWICE, when walking the world and through their `entityCreated` event; the second mesh hid
    // the first one in the map, and the first stayed in the scene, forgotten at the origin.)
    if (!e.appearance || !e.transform || meshes.has(e.id)) return;
    const mesh = meshFor(e.appearance);
    scene.add(mesh);
    meshes.set(e.id, mesh);
  };
  const removeMesh = (id: EntityId) => {
    const zone = zones.get(id);
    if (zone) {
      scene.remove(zone);
      zone.geometry.dispose();
      (zone.material as THREE.Material).dispose();
      zones.delete(id);
    }
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

  // ---------- Aiming: with the mouse taken, it turns the camera around the character's head ----------
  const turnAround = (axis: THREE.Vector3, angle: number) => {
    if (!controls) return;
    const offset = camera.position.clone().sub(controls.target).applyAxisAngle(axis, angle);
    camera.position.copy(controls.target).add(offset);
  };
  /**
   * Turns the camera around what it looks at, to look right (+dx) and down (+dy), in radians. To look
   * down the camera goes up (stage 1c2: it was the other way round, unlike dragging and most games).
   */
  const orbit = (dx: number, dy: number) => {
    if (!controls) return;
    const up = camera.up.clone().normalize();
    turnAround(up, -dx);
    // Without going past the top or the bottom (it would turn upside down).
    const offset = camera.position.clone().sub(controls.target);
    const tilt = offset.angleTo(up) - dy;
    if (tilt > 0.15 && tilt < Math.PI - 0.15) {
      const right = new THREE.Vector3().crossVectors(up, offset).normalize();
      turnAround(right, -dy);
    }
    camera.lookAt(controls.target);
  };
  const onMouseMove = (e: MouseEvent) => {
    if (cameraMode !== 'aim' || !controls || document.pointerLockElement !== renderer.domElement) return;
    orbit(e.movementX * 0.0025, e.movementY * 0.0025);
  };
  document.addEventListener('mousemove', onMouseMove);

  // ---------- The player's character (stage 1b): its inputs, and the camera that follows it ----------
  const playerControls = mountPlayerControls({ blocked: () => gameConsole?.isOpen ?? false, buttons: o.buttons });
  /** This page's player's character, if the world has one (an entity with `character`). */
  const player = () => [...session.world.entities.values()].find((e) => e.character?.player === me);
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

  // ---------- Snapshots (stage 1d): the server's, so everybody in the match goes back ----------
  registry.declareCommand({
    name: 'snapshot',
    description:
      'Saves this moment (`snapshot`), and goes back to it (`snapshot load`), like an emulator\'s "save state": the whole world, its physics included. From there, the same inputs give the same hash, and its replay still holds. In a match with others, everybody goes back.',
    args: [{ name: 'action', type: { kind: 'option', options: ['save', 'load'] }, optional: true }],
    run: ([action]) => link.request({ type: 'snapshot', action: action === 'load' ? 'load' : 'save' }),
  });

  // ---------- Replays and ghosts (stage 1c) ----------
  /** The replay the server is playing (the live player waits until it ends): its last step and hash. */
  let replaying: Match['replay'] | null = null;
  /** A ghost: another world, born like a replay and fed its inputs, run in step with this one. */
  let ghost: { replay: Replay; session: Session; player: ReplayPlayer; mesh: THREE.Mesh | null } | null = null;

  /** The server plays the replay: the match starts over like it, and each copy checks its hash at the end. */
  function playReplayNow(replay: Replay) {
    link.request({ type: 'play', replay: replayToText(replay) });
  }

  function startGhost(replay: Replay) {
    clearGhost();
    ghost = { replay, session: sessionFor(cartridge, replay), player: new ReplayPlayer(replay), mesh: null };
    const body = [...ghost.session.world.entities.values()].find((e) => e.character?.player === 1);
    if (body?.appearance) {
      // The same look, translucent: a ghost.
      ghost.mesh = meshFor(body.appearance);
      ghost.mesh.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        const m = o.material as THREE.MeshLambertMaterial;
        m.transparent = true;
        m.opacity = 0.35;
        m.depthWrite = false;
      });
      scene.add(ghost.mesh);
    }
  }

  function clearGhost() {
    if (!ghost) return;
    ghost.session.world.dispose();
    ghost.mesh?.traverse((o) => {
      if (o instanceof THREE.Mesh) (o.material as THREE.Material).dispose();
    });
    if (ghost.mesh) scene.remove(ghost.mesh);
    ghost = null;
    delete container.dataset.ghost;
  }

  /** A replay as a link, written in the console (and copied, if the browser lets). */
  async function exportReplay(replay: Replay, prefix: string) {
    const text = replayToText(replay);
    const link = `${location.origin}${location.pathname}#${await replayToFragment(text, prefix)}`;
    gameConsole?.write(link);
    gameConsole?.write(`(${replay.end.step} steps, ${replay.inputs.length} input changes: ${link.length} characters)`);
    navigator.clipboard?.writeText(link).then(
      () => gameConsole?.write('(link copied)'),
      () => undefined,
    );
  }

  registry.declareCommand({
    name: 'replay',
    description:
      'The replay of this world since it was born: `replay export` builds a link with it (whoever opens it sees the same, and it checks that it gave the same hash), `replay play` plays it again from the start, `replay stop` gives the control back.',
    args: [{ name: 'action', type: { kind: 'option', options: ['export', 'play', 'stop'] }, optional: true }],
    run: ([action], out) => {
      const replay = replayOf(session);
      if (action === 'export') void exportReplay(replay, REPLAY_PREFIX);
      else if (action === 'play') {
        playReplayNow(replay);
        out.write(`playing the replay: ${replay.end.step} steps`);
      } else if (action === 'stop') {
        if (replaying) {
          replaying = null;
          container.dataset.replay = 'stopped';
        }
        link.request({ type: 'stop' });
      } else
        out.write(
          `recorded since the world was born: ${replay.end.step} steps, ${replay.inputs.length} input changes, ${replay.changes.length} world changes. \`replay export\` builds a link, \`replay play\` plays it again, \`ghost\` races it.`,
        );
    },
  });
  registry.declareCommand({
    name: 'ghost',
    description:
      'Races what you just did: the world starts over, with a ghost doing it again next to you. `ghost export` builds a link with it, for someone else to race; `ghost clear` removes it.',
    args: [{ name: 'action', type: { kind: 'option', options: ['export', 'clear'] }, optional: true }],
    run: ([action], out) => {
      if (action === 'clear') {
        clearGhost();
        out.write('no ghost');
        return;
      }
      const replay = ghost && action === 'export' ? ghost.replay : replayOf(session);
      if (action === 'export') {
        void exportReplay(replay, GHOST_PREFIX);
        return;
      }
      if (replay.end.step === 0) {
        out.write('nothing to race yet: play first (the world records since it was born)');
        return;
      }
      startGhost(replay);
      restart();
      out.write(`a ghost of ${replay.end.step} steps: the world starts over, and it runs next to you`);
    },
  });

  /** The recipe the match is born with: the startup and world values that are not at their defaults. */
  const birthOf = () =>
    registry
      .changed()
      .filter((v) => v.decl.scope !== 'view')
      .map((v) => `${v.decl.name} ${formatValue(v.value)}`)
      .join('\n');

  /** A match hosted in this page: a server here, and this page's client, joined to it in the same page. */
  function hostMatch() {
    leaveMatch();
    server = new Server(cartridge, { birth: birthOf(), now: () => performance.now() });
    const pair = localPair<ToClient, ToServer>();
    server.connect(pair.a);
    net = 'alone';
    connect(pair.b);
  }

  /** This page's client, on a channel to a server (this page's, or another tab's). */
  function connect(channel: Channel<ToServer, ToClient>) {
    link = new Client(cartridge, registry, channel, {
      welcome: onWelcome,
      say: (text, level) => (gameConsole ? gameConsole.write(text, level) : level !== 'info' && console.warn(text)),
      desync: (step, mine, theirs) => {
        container.dataset.desyncs = String(link.desyncs);
        gameConsole?.write(`DESYNC at step ${step}: this copy's hash is ${hex(mine)}, the server's ${hex(theirs)}`, 'error');
      },
    });
    link.hello();
  }

  /** Leaves the current match: this page's client, and its server (and its tabs) if it hosted one. */
  function leaveMatch() {
    link?.close();
    tabs?.close();
    tabs = null;
    server?.dispose();
    server = null;
  }

  /** A match came (at the start, after a restart, a snapshot load, a replay, a join): its copy, drawn. */
  function onWelcome(next: Session, match: Match) {
    const fresh = !match.session;
    session = next;
    me = link.player;
    if (joining) {
      joining = false;
      gameConsole?.write(`you joined the match: you are player ${me}`);
    }
    for (const id of new Set([...meshes.keys(), ...zones.keys()])) removeMesh(id);
    session.world.takeEvents(); // the world is already there: its meshes are created by walking it
    for (const e of session.world.entities.values()) createMesh(e);
    savePrevious();
    replaying = match.replay ?? null;
    if (replaying) container.dataset.replay = 'playing';
    if (controls && player() && (fresh || replaying)) resetCamera();
    // A ghost starts over with the world: both are born at step 0, and run in step.
    if (ghost) {
      if (session.world.tick === 0) startGhost(ghost.replay);
      else clearGhost();
    }
  }

  function restart() {
    replaying = null;
    link.request({ type: 'restart', birth: birthOf() });
  }
  hostMatch();
  // Leaving the page leaves the match (and closes it for the tabs that joined it).
  window.addEventListener('pagehide', leaveMatch);

  // ---------- The match with other tabs (stage 1e) ----------
  registry.declareCommand({
    name: 'net',
    description:
      "The match, and where it lives. Even alone, this page plays through a server of its own. `net open` lets other tabs of this browser join it; `net join` joins a match opened in another tab (you get your own character, if the level has characters); `net leave` goes back to playing alone. Every second, each copy checks its world with the server's hash.",
    args: [{ name: 'action', type: { kind: 'option', options: ['open', 'join', 'leave'] }, optional: true }],
    run: ([action], out) => {
      if (action === 'open') {
        if (!server) return out.write("this page is in another tab's match: `net leave` first", 'warn');
        if (!tabs) tabs = openToTabs(cartridge.id, server);
        net = 'open';
        out.write('the match is open: in another tab of this browser, `net join` joins it');
      } else if (action === 'join') {
        out.write('looking for a match open in another tab…');
        void joinFromTabs(cartridge.id).then((channel) => {
          if (!channel) return gameConsole?.write('no tab answered: open one there with `net open`', 'warn');
          leaveMatch();
          net = 'joined';
          joining = true;
          connect(channel);
          channel.onClose = () => {
            gameConsole?.write('the match was closed: playing alone again', 'warn');
            hostMatch();
          };
        });
      } else if (action === 'leave') {
        if (net === 'joined') hostMatch();
        else {
          tabs?.close();
          tabs = null;
          net = 'alone';
        }
        out.write('playing alone');
      } else {
        const where =
          net === 'joined'
            ? "in another tab's match"
            : net === 'open'
              ? 'hosting a match open to other tabs'
              : 'alone, through a server in this page';
        const players = server ? ` · players ${server.players.join(', ')}` : '';
        out.write(`${where} · you are player ${me}${players} · ${link.checks} hash checks, ${link.desyncs} desyncs`);
      }
    },
  });
  // From now on, changing a startup value (from the console) makes the world start over.
  registry.onStartupChange = restart;
  // A replay or a ghost that came with the page (the game gathered them, from its link).
  const fromPage = (text: string | undefined, what: string, use: (r: Replay) => void) => {
    if (!text) return;
    try {
      use(replayFromText(text));
    } catch (e) {
      if (gameConsole) gameConsole.write(`${what}: ${(e as Error).message}`, 'warn');
      else console.warn(`${what}: ${(e as Error).message}`);
    }
  };
  fromPage(o.replay, "the link's replay", playReplayNow);
  fromPage(o.ghost, "the link's ghost", (r) => {
    startGhost(r);
    restart();
  });

  // How long the physics takes (for show.stats): the steps of the last second, on average.
  let stepTime = 0;
  let stepsTimed = 0;
  let msPerStep = 0;
  let stepStart = 0;
  /** This page's copy takes the steps that came from the server, one by one. */
  function drainMatch() {
    link.drain({
      before() {
        savePrevious();
        if (ghost && !ghost.player.finished(ghost.session)) {
          ghost.player.feed(ghost.session);
          ghost.session.step();
        }
        stepStart = performance.now();
      },
      after() {
        stepTime += performance.now() - stepStart;
        stepsTimed++;
        if (replaying && session.world.tick === replaying.step) {
          const hash = stateHash(session.world);
          const same = hash === replaying.hash;
          container.dataset.replay = same ? 'same' : 'different';
          gameConsole?.write(
            same
              ? `the replay ended at step ${session.world.tick}: the same hash (${hex(hash)}), the same world. The control is yours.`
              : `the replay ended at step ${session.world.tick} with ANOTHER hash: ${hex(hash)} instead of ${hex(replaying.hash)}`,
            same ? 'info' : 'error',
          );
          replaying = null;
        }
      },
    });
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
    if (hero?.transform && !replaying) {
      const look = camera.getWorldDirection(new THREE.Vector3());
      // (Aiming, the mouse turns it: the keys go by the camera, whatever the scheme.)
      const keys = cameraMode === 'aim' ? 'camera' : scheme;
      const asked = playerControls.read([look.x, look.y, look.z], upAt(session.world, hero.transform.position), keys);
      // Aiming, the character looks where the camera looks (the core keeps only its horizontal part).
      link.sendInput(cameraMode === 'aim' ? { ...asked, face: [look.x, look.y, look.z] } : asked);
    }
    // The match's clock is its host's: this page's server advances, and every copy takes those steps.
    if (server && !paused) server.advance(dt * timescale);
    drainMatch();
    const world = session.world;
    for (const ev of world.takeEvents()) {
      if (ev.type === 'entityCreated') {
        const e = world.entities.get(ev.id);
        if (e) createMesh(e);
      }
      if (ev.type === 'entityRemoved') removeMesh(ev.id);
      // The game's notices: for this page's player, or for everybody.
      if (ev.type === 'notice' && (ev.player === undefined || ev.player === me)) showNotice(ev.text);
    }
    // Drawn between the last two steps, by where the server's clock is (a page that joined another
    // tab's match draws the last step: smoothing what comes with lag is for phase 6).
    const alpha = server && !paused ? server.alpha : 1;
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
    if (velocityLines.visible) {
      const velocities: number[] = [];
      const facings: number[] = [];
      for (const e of world.entities.values()) {
        const mesh = meshes.get(e.id);
        if (!e.transform || !e.body || e.body.type === 'fixed') continue;
        const at = mesh ? mesh.position.toArray() : e.transform.position;
        const v = e.character ? e.character.velocity : e.body.linearVelocity;
        velocities.push(...at, at[0]! + v[0] * 0.25, at[1]! + v[1] * 0.25, at[2]! + v[2] * 0.25);
        if (e.character) {
          const f = e.character.facing;
          facings.push(at[0]!, at[1]! + 0.5, at[2]!, at[0]! + f[0], at[1]! + 0.5 + f[1], at[2]! + f[2]);
        }
      }
      setLines(velocityLines, velocities);
      setLines(facingLines, facings);
    }
    if (contactLines.visible) {
      const { points, normals } = world.physics.contacts();
      const lines: number[] = [];
      for (let i = 0; i < points.length; i += 3)
        lines.push(
          points[i]!,
          points[i + 1]!,
          points[i + 2]!,
          points[i]! + normals[i]! * 0.3,
          points[i + 1]! + normals[i + 1]! * 0.3,
          points[i + 2]! + normals[i + 2]! * 0.3,
        );
      setLines(contactLines, lines);
      contactPoints.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(points), 3));
      container.dataset.contacts = String(points.length / 3);
    }
    if (gravityArrows.visible)
      for (const arrow of gravityArrows.children as THREE.ArrowHelper[]) {
        const g = new THREE.Vector3(...gravityAt(world.gravity, arrow.position.toArray()));
        const strength = g.length();
        arrow.visible = strength > 0;
        if (strength > 0) {
          arrow.setDirection(g.divideScalar(strength));
          arrow.setLength(strength / 6.5, 0.3, 0.15);
        }
      }
    // The ghost, where its world has it (its own world: what it pushes does not move here).
    if (ghost?.mesh) {
      const g = [...ghost.session.world.entities.values()].find((e) => e.character?.player === 1)?.transform;
      if (g) {
        ghost.mesh.position.set(...g.position);
        ghost.mesh.quaternion.set(...g.rotation);
      }
    }
    // A gamepad's right stick turns the camera (2.5 radians per second, pushed all the way).
    const [stickX, stickY] = playerControls.cameraStick();
    if (controls && (stickX || stickY)) {
      orbit(stickX * 2.5 * dt, stickY * 2.5 * dt);
      turnedByHand = now;
    }
    const heroMesh = hero && meshes.get(hero.id);
    if (controls && cameraMode !== 'free' && heroMesh && hero?.transform && hero.character) {
      const up = new THREE.Vector3(...upAt(world, hero.transform.position));
      const head = heroMesh.position.clone().addScaledVector(up, 0.6);
      if (cameraMode === 'aim') {
        // Aiming, it moves as much as the head moved (the mouse turns it).
        const moved = head.sub(controls.target);
        controls.target.add(moved);
        camera.position.add(moved);
      } else {
        // ON A LEASH (stage 1c2): the camera keeps its height and its distance (along the ground) to
        // the head, but it stays where it is as long as it can. Going away pulls it along, coming
        // closer pushes it back, and going to a side turns it, little by little (before, it only moved
        // as much as the head: it never turned by itself).
        const offset = camera.position.clone().sub(controls.target);
        const height = offset.dot(up);
        const reach = offset.addScaledVector(up, -height).length();
        const along = camera.position.clone().sub(head);
        along.addScaledVector(up, -along.dot(up));
        if (along.lengthSq() < 1e-6) along.copy(offset);
        // Chasing: and it comes back behind the character, unless it was just turned by hand.
        if (cameraMode === 'chase' && !dragging && now - turnedByHand > 600) {
          const behind = new THREE.Vector3(...hero.character.facing).negate();
          behind.addScaledVector(up, -behind.dot(up));
          const angle = Math.atan2(new THREE.Vector3().crossVectors(along, behind).dot(up), along.dot(behind));
          along.applyAxisAngle(up, angle * (1 - Math.exp(-4 * dt)));
        }
        along.setLength(reach);
        controls.target.copy(head);
        camera.position.copy(head).add(along).addScaledVector(up, height);
      }
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
    // For the browser tests (Playwright). Where the character is, ON EVERY FRAME (stage 2c): every 10
    // frames was too coarse without a GPU, where a frame can take 5 steps, and a whole jump (about 36
    // steps above a meter) could happen between two readings.
    container.dataset.step = String(world.tick);
    if (hero?.transform) container.dataset.player = hero.transform.position.map((n) => n.toFixed(2)).join(' ');
    if (hero?.character) container.dataset.facing = hero.character.facing.map((n) => n.toFixed(2)).join(' ');
    container.dataset.camera = camera.position
      .toArray()
      .map((n) => n.toFixed(2))
      .join(' ');
    // The rest, every 10 frames: how many frames were drawn and how many meshes are really in the scene
    // (not in the map: the bug above did not show there), and the match.
    if (++frames % 10 === 0) {
      container.dataset.frames = String(frames);
      container.dataset.meshes = String(scene.children.filter((x) => x instanceof THREE.Mesh).length);
      container.dataset.net = net;
      container.dataset.me = String(me);
      container.dataset.checks = String(link.checks);
      container.dataset.others = [...world.entities.values()]
        .filter((e) => e.character && e.character.player !== me && e.transform)
        .map((e) => `${e.character!.player}:${e.transform!.position.map((n) => n.toFixed(2)).join(' ')}`)
        .join('|');
      const ghostBody = ghost && [...ghost.session.world.entities.values()].find((e) => e.character?.player === 1);
      if (ghostBody?.transform) container.dataset.ghost = ghostBody.transform.position.map((n) => n.toFixed(2)).join(' ');
      if (!stats.hidden)
        stats.textContent = [
          `step ${world.tick}${paused ? ' (paused)' : ''}`,
          `hash ${hex(stateHash(world))}`,
          `${world.entities.size} entities · ${world.physics.bodyCount} bodies · ${perSecond} fps`,
          `physics ${msPerStep.toFixed(2)} ms per step`,
          `${net === 'joined' ? "in another tab's match" : net === 'open' ? 'match open to other tabs' : 'alone'} · player ${me} · ${link.checks} hash checks${link.desyncs ? ` · ${link.desyncs} DESYNCS` : ''}`,
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
      clearGhost();
      leaveMatch();
      window.removeEventListener('pagehide', leaveMatch);
      document.removeEventListener('mousemove', onMouseMove);
      if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
      controls?.dispose();
      session.world.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      stats.remove();
      clearTimeout(noticeTimer);
      noticeBox.remove();
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
