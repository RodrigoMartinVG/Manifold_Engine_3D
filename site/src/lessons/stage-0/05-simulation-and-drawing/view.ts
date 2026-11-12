import * as THREE from 'three';
import { HALF_WIDTH, type World } from './simulation';

/**
 * THE VIEW: it draws what the simulation computed. It reads the world and never changes it. If
 * tomorrow we swap Three.js for something else, the simulation does not notice.
 */
export function createView(scene: THREE.Scene, world: World) {
  const box = new THREE.LineSegments(
    new THREE.EdgesGeometry(
      new THREE.BoxGeometry(HALF_WIDTH * 2, 4, HALF_WIDTH * 2).translate(0, 2, 0),
    ),
    new THREE.LineBasicMaterial({ color: 0x3e4451 }),
  );
  scene.add(box);
  const meshes = world.balls.map((b, i) => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(b.radius, 20, 14),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(i / world.balls.length, 0.6, 0.6),
      }),
    );
    scene.add(mesh);
    return mesh;
  });
  return {
    draw() {
      world.balls.forEach((b, i) => meshes[i]!.position.set(...b.position));
    },
  };
}
