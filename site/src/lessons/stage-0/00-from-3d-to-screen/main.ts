import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { etiqueta } from './etiqueta';

// El renderer, la escena y la cámara: la lección siguiente los arma uno por uno.
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.append(renderer.domElement);
const escena = new THREE.Scene();
escena.background = new THREE.Color(0x15120f);
const camara = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
camara.position.set(3.2, 2.4, 4.2);

// Arrastrar gira la cámara alrededor de un punto; la rueda (o pellizcar) acerca y aleja.
const controles = new OrbitControls(camara, renderer.domElement);
controles.target.set(0, 0.6, 0);
controles.enableDamping = true; // que frene suave al soltar

// 1. LAS COORDENADAS: tres ejes que salen del origen (0, 0, 0). Rojo = x, verde = y, azul = z.
escena.add(new THREE.AxesHelper(2));
escena.add(
  etiqueta('x', '#e06c75', 2.25, 0, 0),
  etiqueta('y', '#98c379', 0, 2.25, 0),
  etiqueta('z', '#61afef', 0, 0, 2.25),
);
escena.add(new THREE.GridHelper(6, 6, 0x5a5044, 0x2e2822)); // el piso: cuadrados de 1 metro

// 2. UNA FORMA HECHA DE TRIÁNGULOS: una esfera (la geometría) con un material que refleja la luz.
// `flatShading`: cada triángulo de un solo tono, para que se vean.
const material = new THREE.MeshStandardMaterial({ color: 0xe0a040, flatShading: true });
const esfera = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), material);
esfera.position.set(0, 0.8, 0); // en el centro, 80 cm arriba del piso
escena.add(esfera);
// Los mismos triángulos, dibujados como líneas. Es HIJA de la esfera: se mueve con ella.
const alambre = new THREE.LineSegments(
  new THREE.WireframeGeometry(esfera.geometry),
  new THREE.LineBasicMaterial({ color: 0x2a1a0b }),
);
esfera.add(alambre);

// 3. LA LUZ: una tenue que viene de todos lados (cielo y suelo), y un sol.
escena.add(new THREE.HemisphereLight(0xc8d4ff, 0x3a3028, 0.5));
const sol = new THREE.DirectionalLight(0xffffff, 2.5);
sol.position.set(3, 4, 2);
escena.add(sol);

// ---------- Los controles ----------
const opciones = { detalle: 8, verTriangulos: true, campoDeVision: 50 };
const lectura = { triangulos: 0, vertices: 0, cuadrosPorSegundo: 0 };

/** Rehace la esfera con otro detalle: más divisiones = más triángulos. */
function rehacer() {
  esfera.geometry.dispose(); // la geometría vieja ocupa memoria en la GPU: se libera
  esfera.geometry = new THREE.SphereGeometry(
    0.8,
    opciones.detalle,
    Math.ceil(opciones.detalle * 0.75),
  );
  alambre.geometry.dispose();
  alambre.geometry = new THREE.WireframeGeometry(esfera.geometry);
  lectura.triangulos = esfera.geometry.index!.count / 3; // cada triángulo son tres vértices
  lectura.vertices = esfera.geometry.attributes.position!.count;
}
rehacer();

const gui = new GUI({ title: 'Del 3D a la pantalla' });
gui.add(opciones, 'detalle', 3, 64, 1).name('detalle de la esfera').onChange(rehacer);
gui
  .add(opciones, 'verTriangulos')
  .name('ver los triángulos')
  .onChange((v: boolean) => (alambre.visible = v));
gui
  .add(opciones, 'campoDeVision', 15, 110, 1)
  .name('campo de visión (°)')
  .onChange((grados: number) => {
    camara.fov = grados;
    camara.updateProjectionMatrix(); // la cámara recalcula cómo proyecta
  });
gui.add(sol, 'intensity', 0, 5, 0.1).name('fuerza del sol');
const cuentas = gui.addFolder('Lo que dibuja la GPU');
cuentas.add(lectura, 'triangulos').name('triángulos').listen().disable();
cuentas.add(lectura, 'vertices').name('vértices').listen().disable();
cuentas.add(lectura, 'cuadrosPorSegundo').name('cuadros por segundo').listen().disable();

// ---------- El tamaño y el bucle ----------
function ajustar() {
  renderer.setSize(innerWidth, innerHeight);
  camara.aspect = innerWidth / innerHeight;
  camara.updateProjectionMatrix();
}
addEventListener('resize', ajustar);
ajustar();

// 4. LOS CUADROS: todo se vuelve a dibujar una y otra vez. Aquí se cuentan, de a un segundo.
let cuadros = 0;
let desde = performance.now();
function cuadro(ahora: number) {
  controles.update();
  renderer.render(escena, camara);
  cuadros++;
  if (ahora - desde >= 1000) {
    lectura.cuadrosPorSegundo = Math.round((cuadros * 1000) / (ahora - desde));
    cuadros = 0;
    desde = ahora;
  }
  requestAnimationFrame(cuadro);
}
requestAnimationFrame(cuadro);

// Probá: detalle en 3 y en 64 (mirá cuántos triángulos). Campo de visión en 15 y en 110.
// Acercate con la rueda hasta entrar en la esfera: ¿qué pasa con sus caras?
