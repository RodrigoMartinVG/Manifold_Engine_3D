import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { label } from './label';

// The renderer, the scene and the camera: the next lesson builds them one by one.
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.append(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x15120f);
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
camera.position.set(3.2, 2.4, 4.2);

// Dragging turns the camera around a point; the wheel (or a pinch) zooms in and out.
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.6, 0);
controls.enableDamping = true; // it slows down smoothly when released

// 1. THE COORDINATES: three axes coming out of the origin (0, 0, 0). Red = x, green = y, blue = z.
scene.add(new THREE.AxesHelper(2));
scene.add(
  label('x', '#e06c75', 2.25, 0, 0),
  label('y', '#98c379', 0, 2.25, 0),
  label('z', '#61afef', 0, 0, 2.25),
);
scene.add(new THREE.GridHelper(6, 6, 0x5a5044, 0x2e2822)); // the floor: 1-meter squares

// 2. A SHAPE MADE OF TRIANGLES: a sphere (the geometry) with a material that reflects light.
// `flatShading`: each triangle in a single tone, so they show.
const material = new THREE.MeshStandardMaterial({ color: 0xe0a040, flatShading: true });
const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), material);
sphere.position.set(0, 0.8, 0); // in the center, 80 cm above the floor
scene.add(sphere);
// The same triangles, drawn as lines. It is a CHILD of the sphere: it moves with it.
const wireframe = new THREE.LineSegments(
  new THREE.WireframeGeometry(sphere.geometry),
  new THREE.LineBasicMaterial({ color: 0x2a1a0b }),
);
sphere.add(wireframe);

// 3. THE LIGHT: a faint one that comes from everywhere (sky and ground), and a sun.
scene.add(new THREE.HemisphereLight(0xc8d4ff, 0x3a3028, 0.5));
const sun = new THREE.DirectionalLight(0xffffff, 2.5);
sun.position.set(3, 4, 2);
scene.add(sun);

// ---------- The controls ----------
const options = { detail: 8, showTriangles: true, fieldOfView: 50 };
const readout = { triangles: 0, vertices: 0, framesPerSecond: 0 };

/** Rebuilds the sphere with another detail: more divisions = more triangles. */
function rebuild() {
  sphere.geometry.dispose(); // the old geometry takes memory on the GPU: it is freed
  sphere.geometry = new THREE.SphereGeometry(0.8, options.detail, Math.ceil(options.detail * 0.75));
  wireframe.geometry.dispose();
  wireframe.geometry = new THREE.WireframeGeometry(sphere.geometry);
  readout.triangles = sphere.geometry.index!.count / 3; // each triangle is three vertices
  readout.vertices = sphere.geometry.attributes.position!.count;
}
rebuild();

const gui = new GUI({ title: 'From 3D to the screen' });
gui.add(options, 'detail', 3, 64, 1).name('sphere detail').onChange(rebuild);
gui
  .add(options, 'showTriangles')
  .name('show the triangles')
  .onChange((v: boolean) => (wireframe.visible = v));
gui
  .add(options, 'fieldOfView', 15, 110, 1)
  .name('field of view (°)')
  .onChange((degrees: number) => {
    camera.fov = degrees;
    camera.updateProjectionMatrix(); // the camera recomputes how it projects
  });
gui.add(sun, 'intensity', 0, 5, 0.1).name('sun strength');
const counts = gui.addFolder('What the GPU draws');
counts.add(readout, 'triangles').name('triangles').listen().disable();
counts.add(readout, 'vertices').name('vertices').listen().disable();
counts.add(readout, 'framesPerSecond').name('frames per second').listen().disable();

// ---------- The size and the loop ----------
function fit() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', fit);
fit();

// 4. THE FRAMES: everything is drawn again and again. Here they are counted, one second at a time.
let frames = 0;
let since = performance.now();
function frame(now: number) {
  controls.update();
  renderer.render(scene, camera);
  frames++;
  if (now - since >= 1000) {
    readout.framesPerSecond = Math.round((frames * 1000) / (now - since));
    frames = 0;
    since = now;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Try: detail at 3 and at 64 (look at how many triangles). Field of view at 15 and at 110.
// Zoom in with the wheel until you enter the sphere: what happens to its faces?
