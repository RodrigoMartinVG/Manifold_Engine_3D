import * as THREE from 'three';
import { MEDIO_ANCHO, type Mundo } from './simulacion';

/**
 * LA VISTA: dibuja lo que la simulación calculó. Lee el mundo y nunca lo cambia.
 * Si mañana cambiamos Three.js por otra cosa, la simulación no se entera.
 */
export function crearVista(escena: THREE.Scene, mundo: Mundo) {
  const caja = new THREE.LineSegments(
    new THREE.EdgesGeometry(
      new THREE.BoxGeometry(MEDIO_ANCHO * 2, 4, MEDIO_ANCHO * 2).translate(0, 2, 0),
    ),
    new THREE.LineBasicMaterial({ color: 0x3e4451 }),
  );
  escena.add(caja);
  const mallas = mundo.pelotas.map((p, i) => {
    const malla = new THREE.Mesh(
      new THREE.SphereGeometry(p.radio, 20, 14),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(i / mundo.pelotas.length, 0.6, 0.6),
      }),
    );
    escena.add(malla);
    return malla;
  });
  return {
    dibujar() {
      mundo.pelotas.forEach((p, i) => mallas[i]!.position.set(...p.posicion));
    },
  };
}
