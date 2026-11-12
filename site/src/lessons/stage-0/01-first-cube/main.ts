import * as THREE from 'three';

// 1. The RENDERER draws on a <canvas> using the GPU (WebGL).
const renderer = new THREE.WebGLRenderer({ antialias: true });
// On Retina screens there are 2 or 3 pixels per point: with more, it looks sharper... and it costs
// much more (twice the width and the height = four times the pixels). A cap is set.
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.append(renderer.domElement);

// 2. The SCENE: everything added here gets drawn.
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x15120f);

// 3. The CAMERA: vertical field of view (60°), width/height ratio, and from/to what distance it
//    draws (0.1 m and 100 m).
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
camera.position.set(2.5, 2, 3.5);
camera.lookAt(0, 0, 0);

// 4. An object = GEOMETRY (the shape) + MATERIAL (how it responds to light).
const cube = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0xe0a040 }),
);
scene.add(cube);

// 5. LIGHTS: without them, a "standard" material looks black.
scene.add(new THREE.HemisphereLight(0xc8d4ff, 0x3a3028, 1.2)); // sky and ground
const sun = new THREE.DirectionalLight(0xffffff, 2); // parallel rays, like the sun
sun.position.set(3, 5, 2);
scene.add(sun);

// 6. Everything fits the window's size (and if it changes, too).
function fit() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix(); // the camera recomputes its projection
}
addEventListener('resize', fit);
fit();

// 7. The LOOP: once per screen frame.
let before = performance.now();
function frame(now: number) {
  // Turn by the TIME that went by, not "a little per frame": so it turns the same at 30 or at 144
  // frames per second.
  const dt = (now - before) / 1000;
  before = now;
  cube.rotation.y += 0.8 * dt; // radians per second × seconds
  cube.rotation.x += 0.3 * dt;
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Try: another color; MeshBasicMaterial instead of MeshStandardMaterial (it ignores the lights);
// removing the sunlight; moving the camera.
