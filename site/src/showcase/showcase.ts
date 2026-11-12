import * as THREE from 'three';
import {
  CENTER_RADIUS,
  INITIAL_ORBITS,
  SHEET_RADIUS,
  STEP,
  advance as advanceOrbit,
  createOrbit,
  potential,
  type Orbit,
} from './orbits';

/**
 * THE HOME PAGE'S SHOWCASE: a potential well with three bodies in orbit, inside the rings of an
 * instrument (the equator with its degrees and the ecliptic, tilted 23.44°).
 *
 * It is a small Three.js scene, the site's only (it is not the engine), but an honest one: the
 * bodies move with the same physics that is drawn (orbits.ts). The height of each point of the
 * sheet is the potential Φ(r), and the bodies fall down its slope: g = −∇Φ.
 */

const HEIGHT_SCALE = 0.34; // from potential to meters: only for drawing
const TRAIL_LENGTH = 200; // points (3.3 s)

/** The sheet's height at distance `r` from the center (0 at the edge). */
const height = (r: number) => HEIGHT_SCALE * (potential(r) - potential(SHEET_RADIUS));

const VERDIGRIS = new THREE.Color(0x93d9c9);
const DARK_VERDIGRIS = new THREE.Color(0x10302b);
const BRONZE = 0x9a7246; // old bronze, without shine

/** Each body's color and size, in the order of INITIAL_ORBITS. */
const LOOK = [
  { color: 0x93d9c9, radius: 0.075 },
  { color: 0xf0d59a, radius: 0.09 },
  { color: 0xd98a4e, radius: 0.1 },
];

interface Body extends Orbit {
  radius: number;
  mesh: THREE.Mesh;
  trail: Float32Array;
  trailGeometry: THREE.BufferGeometry;
}

export interface ShowcaseOptions {
  /** Called every 10 frames with the simulation's step number. */
  onStep?: (step: number) => void;
}

/** Mounts the showcase in `view` and draws the first frame. Returns a function that stops it. */
export function startShowcase(view: HTMLElement, options: ShowcaseOptions = {}): () => void {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); // thin lines: more does not show, and it costs
  renderer.setClearColor(0x000000, 0); // transparent: the frame's background shows behind
  view.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1.5, 0.1, 60);
  const world = new THREE.Group(); // everything that turns slowly
  scene.add(world);

  scene.add(new THREE.HemisphereLight(0xfff1d6, 0x241a10, 1.1));
  const light = new THREE.DirectionalLight(0xffe2b0, 2.2);
  light.position.set(4, 6, 3);
  scene.add(light);

  // ---------- The sheet: rings and spokes that follow the potential's height ----------
  {
    const positions: number[] = [];
    const colors: number[] = [];
    const color = new THREE.Color();
    const vertex = (r: number, a: number) => {
      positions.push(r * Math.cos(a), height(r), r * Math.sin(a));
      // Brighter inside the well; toward the edge it fades.
      color.lerpColors(DARK_VERDIGRIS, VERDIGRIS, (1 - r / SHEET_RADIUS) ** 1.6);
      colors.push(color.r, color.g, color.b);
    };
    const R0 = 0.35;
    for (let i = 0; i < 14; i++) {
      const r = R0 + ((SHEET_RADIUS - R0) * i) / 13;
      for (let j = 0; j < 128; j++) {
        vertex(r, (j / 128) * 2 * Math.PI);
        vertex(r, ((j + 1) / 128) * 2 * Math.PI);
      }
    }
    for (let k = 0; k < 36; k++) {
      const a = (k / 36) * 2 * Math.PI;
      for (let j = 0; j < 32; j++) {
        vertex(R0 + ((SHEET_RADIUS - R0) * j) / 32, a);
        vertex(R0 + ((SHEET_RADIUS - R0) * (j + 1)) / 32, a);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    world.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ vertexColors: true })));
  }

  // ---------- The central body, with a halo ----------
  const center = new THREE.Mesh(
    new THREE.SphereGeometry(CENTER_RADIUS, 32, 20),
    new THREE.MeshStandardMaterial({ color: 0xc0915a, emissive: 0x4a2a0c, metalness: 0.45, roughness: 0.6 }),
  );
  center.position.y = height(0) + CENTER_RADIUS;
  world.add(center);
  {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const g = canvas.getContext('2d')!;
    const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 214, 150, 0.9)');
    gradient.addColorStop(0.35, 'rgba(240, 170, 90, 0.25)');
    gradient.addColorStop(1, 'rgba(240, 170, 90, 0)');
    g.fillStyle = gradient;
    g.fillRect(0, 0, 64, 64);
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(canvas),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    halo.scale.setScalar(1.9);
    halo.position.copy(center.position);
    world.add(halo);
  }

  // ---------- The instrument's rings ----------
  /** A circle in the XZ plane, with marks every 5° (longer every 30°) if asked. */
  const ring = (radius: number, marks: boolean, opacity: number) => {
    const p: number[] = [];
    for (let j = 0; j < 192; j++) {
      const a0 = (j / 192) * 2 * Math.PI;
      const a1 = ((j + 1) / 192) * 2 * Math.PI;
      p.push(radius * Math.cos(a0), 0, radius * Math.sin(a0), radius * Math.cos(a1), 0, radius * Math.sin(a1));
    }
    if (marks) {
      for (let g = 0; g < 360; g += 5) {
        const a = (g * Math.PI) / 180;
        const length = g % 30 === 0 ? 0.16 : 0.06;
        p.push(radius * Math.cos(a), 0, radius * Math.sin(a));
        p.push((radius + length) * Math.cos(a), 0, (radius + length) * Math.sin(a));
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: BRONZE, transparent: true, opacity }));
  };
  world.add(ring(3.3, true, 0.85));
  world.add(ring(3.15, false, 0.35));
  const ecliptic = new THREE.Group();
  const tiltedRing = ring(3.05, true, 0.6);
  tiltedRing.rotation.x = (23.44 * Math.PI) / 180; // the tilt of the Earth's axis
  ecliptic.add(tiltedRing);
  scene.add(ecliptic);

  // ---------- The orbiting bodies ----------
  const bodies: Body[] = INITIAL_ORBITS.map(({ r, factor, phase }, i) => {
    const { color, radius } = LOOK[i]!;
    const orbit = createOrbit(r, factor, phase);
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 20, 14),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.25, roughness: 0.45 }),
    );
    world.add(mesh);
    const trail = new Float32Array(TRAIL_LENGTH * 3);
    const trailGeometry = new THREE.BufferGeometry();
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(trail, 3));
    // The trail fades backward: the color goes from black (the oldest) to the body's. With ADDITIVE
    // blending (it adds to what is behind), black does not show and the trail glows over the sheet.
    const colors = new Float32Array(TRAIL_LENGTH * 3);
    const c = new THREE.Color();
    const black = new THREE.Color(0x000000);
    const bright = new THREE.Color(color).multiplyScalar(1.4);
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      c.lerpColors(black, bright, (i / (TRAIL_LENGTH - 1)) ** 1.3);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    trailGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const trailMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const trailLine = new THREE.Line(trailGeometry, trailMaterial);
    trailLine.frustumCulled = false; // it moves all the time: its bounding sphere would go stale
    world.add(trailLine);
    const body: Body = { ...orbit, radius, mesh, trail, trailGeometry };
    for (let j = 0; j < TRAIL_LENGTH; j++) putInTrail(body, j, orbit.x, orbit.z);
    return body;
  });

  function putInTrail(b: Body, i: number, x: number, z: number) {
    b.trail[i * 3] = x;
    b.trail[i * 3 + 1] = height(Math.hypot(x, z)) + 0.015;
    b.trail[i * 3 + 2] = z;
  }

  // ---------- The simulation: a fixed step ----------
  let step = 0;
  function advance() {
    for (const b of bodies) {
      advanceOrbit(b);
      b.trail.copyWithin(0, 3); // the trail moves one place...
      putInTrail(b, TRAIL_LENGTH - 1, b.x, b.z); // ...and the new point goes at the end
    }
    step++;
  }

  function draw(alpha: number) {
    for (const b of bodies) {
      const x = b.xBefore + (b.x - b.xBefore) * alpha;
      const z = b.zBefore + (b.z - b.zBefore) * alpha;
      b.mesh.position.set(x, height(Math.hypot(x, z)) + b.radius, z);
      putInTrail(b, TRAIL_LENGTH - 1, x, z); // the trail's tip, stuck to the body
      b.trailGeometry.attributes.position!.needsUpdate = true;
    }
    renderer.render(scene, camera);
  }

  // The loop's state (further down).
  let running = false;
  let request = 0;
  let previous = 0;
  let accumulator = 0;
  let frames = 0;

  // ---------- The camera and the size ----------
  const TARGET = new THREE.Vector3(0, -0.25, 0);
  const ELEVATION = (25 * Math.PI) / 180;
  let distance = 9;
  let tilt = 0; // how much the pointer moves the camera (in radians)
  let wantedTilt = 0;
  const placeCamera = () => {
    const e = ELEVATION + tilt * 0.4;
    camera.position.set(Math.sin(tilt) * distance * Math.cos(e), Math.sin(e) * distance, Math.cos(tilt) * distance * Math.cos(e));
    camera.lookAt(TARGET);
  };
  const fit = () => {
    const width = Math.max(1, view.clientWidth);
    const tall = Math.max(1, view.clientHeight);
    renderer.setSize(width, tall, false);
    camera.aspect = width / tall;
    // Everything must fit across: if the showcase is narrower, the camera moves away.
    distance = Math.max(8.6, 3.75 / (Math.tan((camera.fov * Math.PI) / 360) * camera.aspect));
    camera.updateProjectionMatrix();
    placeCamera();
  };
  const onResize = new ResizeObserver(() => {
    fit();
    if (still || !running) draw(1);
  });
  onResize.observe(view);
  fit();

  // A few seconds of simulation before showing anything: so the trails are already drawn.
  for (let i = 0; i < TRAIL_LENGTH; i++) advance();
  draw(1);

  // ---------- The loop: only while the showcase is in view ----------
  const frame = (now: number) => {
    request = requestAnimationFrame(frame);
    const dt = Math.min((now - previous) / 1000, 0.25);
    previous = now;
    accumulator += dt;
    for (let n = 0; accumulator >= STEP; n++) {
      if (n === 5) {
        accumulator = 0; // far behind (the tab slept): it does not try to catch up
        break;
      }
      advance();
      accumulator -= STEP;
    }
    world.rotation.y += dt * ((2 * Math.PI) / 240); // one turn every 4 minutes
    ecliptic.rotation.y -= dt * ((2 * Math.PI) / 90);
    tilt += (wantedTilt - tilt) * Math.min(1, dt * 3);
    placeCamera();
    draw(accumulator / STEP);
    if (++frames % 10 === 0) {
      view.dataset.frames = String(frames);
      options.onStep?.(step);
    }
  };
  const keepGoing = (yes: boolean) => {
    if (yes === running || still) return;
    running = yes;
    if (yes) {
      previous = performance.now();
      request = requestAnimationFrame(frame);
    } else cancelAnimationFrame(request);
  };
  const onSeen = new IntersectionObserver((entries) => keepGoing(entries.some((e) => e.isIntersecting)));
  onSeen.observe(view);

  // The pointer tilts the camera a little: it shows it is real 3D.
  const onMove = (e: PointerEvent) => {
    const box = view.getBoundingClientRect();
    wantedTilt = ((e.clientX - box.left) / box.width - 0.5) * 0.5;
  };
  const onLeave = () => (wantedTilt = 0);
  view.addEventListener('pointermove', onMove);
  view.addEventListener('pointerleave', onLeave);

  options.onStep?.(step);
  return () => {
    keepGoing(false);
    onSeen.disconnect();
    onResize.disconnect();
    view.removeEventListener('pointermove', onMove);
    view.removeEventListener('pointerleave', onLeave);
    renderer.dispose();
    renderer.domElement.remove();
  };
}
