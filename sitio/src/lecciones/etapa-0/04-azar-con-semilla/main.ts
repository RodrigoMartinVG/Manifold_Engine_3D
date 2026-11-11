import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { crearEscena } from './escena';
import { crearAzar } from './azar';

const { escena, alCuadro } = crearEscena();

const opciones = { semilla: 42, usarMathRandom: false, regenerar: () => generar() };
const cubos = new THREE.Group();
escena.add(cubos);

/** Un "nivel" generado al azar: 60 cubos con lugar, tamaño, color y giro sacados del azar. */
function generar() {
  cubos.clear();
  const azar = opciones.usarMathRandom ? Math.random : crearAzar(opciones.semilla);
  console.log(`primeros números: ${[azar(), azar(), azar()].map((x) => x.toFixed(4)).join(', ')}`);
  for (let i = 0; i < 60; i++) {
    const lado = 0.15 + azar() * 0.45;
    const cubo = new THREE.Mesh(
      new THREE.BoxGeometry(lado, lado, lado),
      new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(azar(), 0.55, 0.55) }),
    );
    cubo.position.set((azar() - 0.5) * 8, lado / 2 + azar() * 2.5, (azar() - 0.5) * 8);
    cubo.rotation.set(azar() * Math.PI, azar() * Math.PI, 0);
    cubos.add(cubo);
  }
}
generar();

const gui = new GUI({ title: 'Azar' });
gui.add(opciones, 'semilla', 0, 999, 1).onChange(generar);
gui.add(opciones, 'usarMathRandom').name('usar Math.random').onChange(generar);
gui.add(opciones, 'regenerar');

alCuadro((dt) => {
  cubos.rotation.y += 0.1 * dt;
});

// Probá: "regenerar" con semilla → siempre lo mismo. Con Math.random → cada vez otro.
// Mirá la consola: los primeros números de la semilla 42 son siempre los mismos.
