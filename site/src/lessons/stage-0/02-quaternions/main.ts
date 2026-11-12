import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { crearEscena } from './escena';

const { escena, camara, alCuadro } = crearEscena();
camara.position.set(2.6, 2.4, 3.6); // más cerca que de costumbre: la nave es chica
camara.lookAt(0, 1.2, 0);

// Una "nave": la punta dice hacia dónde mira, y la aleta roja, cuál es su "arriba".
const material = (color: number) => new THREE.MeshStandardMaterial({ color });
const nave = new THREE.Group();
nave.add(
  new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 1.6), material(0x4f86c6)), // cuerpo
  new THREE.Mesh(
    new THREE.ConeGeometry(0.3, 0.6, 16).rotateX(-Math.PI / 2).translate(0, 0, -1.1),
    material(0xe0a040),
  ), // punta
  new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.5).translate(0, 0.35, 0.5), material(0xe06c75)), // aleta
  new THREE.Mesh(new THREE.BoxGeometry(2, 0.06, 0.5).translate(0, 0, 0.2), material(0x8aa0b8)), // alas
);
nave.position.y = 1.2;
escena.add(nave);

const rad = THREE.MathUtils.degToRad;
const gui = new GUI({ title: 'Orientación' });

// --- Con ÁNGULOS (Euler): tres giros, uno después del otro, alrededor de ejes fijos ---
// Orden 'YXZ': primero guiñada (alrededor de Y), después cabeceo (X), después alabeo (Z).
const angulos = { guinada: 0, cabeceo: 0, alabeo: 0 };
const aplicarAngulos = () =>
  nave.rotation.set(rad(angulos.cabeceo), rad(angulos.guinada), rad(angulos.alabeo), 'YXZ');
const euler = gui.addFolder('Con ángulos (grados)');
euler.add(angulos, 'guinada', -180, 180, 1).name('guiñada (Y)').onChange(aplicarAngulos);
euler.add(angulos, 'cabeceo', -90, 90, 1).name('cabeceo (X)').onChange(aplicarAngulos);
euler.add(angulos, 'alabeo', -180, 180, 1).name('alabeo (Z)').onChange(aplicarAngulos);

// --- Con un CUATERNIÓN: girar alrededor de los ejes PROPIOS de la nave, desde donde esté ---
// Multiplicar por la derecha = girar en el marco de la nave (su "derecha", su "arriba").
const girarPropio = (eje: THREE.Vector3) => () =>
  nave.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(eje, rad(15)));
const cuaternion = gui.addFolder('Con un cuaternión (15° cada vez)');
cuaternion.add({ f: girarPropio(new THREE.Vector3(1, 0, 0)) }, 'f').name('cabecear (su X)');
cuaternion.add({ f: girarPropio(new THREE.Vector3(0, 1, 0)) }, 'f').name('guiñar (su Y)');
cuaternion.add({ f: girarPropio(new THREE.Vector3(0, 0, 1)) }, 'f').name('alabear (su Z)');
cuaternion.add({ f: () => nave.quaternion.identity() }, 'f').name('volver al principio');

// Los cuatro números del cuaternión, en vivo (siempre suman 1 al cuadrado: es una rotación).
const lectura = { x: 0, y: 0, z: 0, w: 1 };
const numeros = gui.addFolder('El cuaternión (x, y, z, w)');
for (const k of ['x', 'y', 'z', 'w'] as const) numeros.add(lectura, k).listen().disable();

alCuadro(() => {
  const q = nave.quaternion;
  lectura.x = +q.x.toFixed(3);
  lectura.y = +q.y.toFixed(3);
  lectura.z = +q.z.toFixed(3);
  lectura.w = +q.w.toFixed(3);
});

// Probá: cabeceo en 90 y después mové la guiñada y el alabeo. ¿Hacen lo mismo?
