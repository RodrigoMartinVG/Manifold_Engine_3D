import * as THREE from 'three';

// 1. El RENDERER dibuja en un <canvas> usando la GPU (WebGL).
const renderer = new THREE.WebGLRenderer({ antialias: true });
// En pantallas Retina hay 2 o 3 píxeles por punto: con más, se ve más nítido... y cuesta
// mucho más (el doble de ancho y de alto = cuatro veces los píxeles). Se pone un tope.
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.append(renderer.domElement);

// 2. La ESCENA: todo lo que se agregue aquí se dibuja.
const escena = new THREE.Scene();
escena.background = new THREE.Color(0x15120f);

// 3. La CÁMARA: campo de visión vertical (60°), proporción ancho/alto, y desde/hasta qué
//    distancia se dibuja (0,1 m y 100 m).
const camara = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
camara.position.set(2.5, 2, 3.5);
camara.lookAt(0, 0, 0);

// 4. Un objeto = GEOMETRÍA (la forma) + MATERIAL (cómo responde a la luz).
const cubo = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0xe0a040 }),
);
escena.add(cubo);

// 5. LUCES: sin ellas, un material "estándar" se ve negro.
escena.add(new THREE.HemisphereLight(0xc8d4ff, 0x3a3028, 1.2)); // cielo y suelo
const sol = new THREE.DirectionalLight(0xffffff, 2); // rayos paralelos, como el sol
sol.position.set(3, 5, 2);
escena.add(sol);

// 6. Que todo se acomode al tamaño de la ventana (y si cambia, también).
function ajustar() {
  renderer.setSize(innerWidth, innerHeight);
  camara.aspect = innerWidth / innerHeight;
  camara.updateProjectionMatrix(); // la cámara recalcula su proyección
}
addEventListener('resize', ajustar);
ajustar();

// 7. El BUCLE: una vez por cuadro de la pantalla.
let antes = performance.now();
function cuadro(ahora: number) {
  // Girar según el TIEMPO que pasó, no "un poco por cuadro": así gira igual a 30 o a 144
  // cuadros por segundo.
  const dt = (ahora - antes) / 1000;
  antes = ahora;
  cubo.rotation.y += 0.8 * dt; // radianes por segundo × segundos
  cubo.rotation.x += 0.3 * dt;
  renderer.render(escena, camara);
  requestAnimationFrame(cuadro);
}
requestAnimationFrame(cuadro);

// Probá: otro color; MeshBasicMaterial en vez de MeshStandardMaterial (ignora las luces);
// sacar la luz del sol; mover la cámara.
