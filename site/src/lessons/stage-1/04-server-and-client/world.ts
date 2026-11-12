import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-deterministic-compat';
import { createRandom } from './random';

/** What the player asks for at a step: a direction on the floor, x and z, each −1, 0 or 1. */
export type Input = [number, number];
export const STEP = 1 / 60;

/**
 * A world, always born the same (the one of the replays lesson): a floor, boxes from a seeded
 * randomness, and the player's ball. Drawn `shift` meters to the side, so two can be seen at once.
 */
export function createWorld(scene: THREE.Scene, shift: number, ballColor: number) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = STEP;
  const floor = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(3, 0.5, 4), floor);
  const meshes: [RAPIER.RigidBody, THREE.Mesh][] = [];
  // Low walls around the floor, so nothing leaves it.
  for (const [x, z, hx, hz] of [
    [0, -4, 3, 0.15],
    [0, 4, 3, 0.15],
    [-3, 0, 0.15, 4],
    [3, 0, 0.15, 4],
  ]) {
    const wall = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x!, 0.3, z!));
    world.createCollider(RAPIER.ColliderDesc.cuboid(hx!, 0.3, hz!), wall);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(hx! * 2, 0.6, hz! * 2),
      new THREE.MeshStandardMaterial({ color: 0x5a4a38 }),
    );
    mesh.position.set(x! + shift, 0.3, z!);
    scene.add(mesh);
  }
  const random = createRandom(7);
  for (let i = 0; i < 10; i++) {
    const at = { x: random() * 4 - 2, y: 0.3 + random() * 2, z: random() * 5 - 3 };
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(at.x, at.y, at.z),
    );
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.3, 0.3, 0.3), body);
    const material = new THREE.MeshStandardMaterial({ color: 0x8a6a42 });
    meshes.push([body, new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), material)]);
  }
  const ball = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 0.4, 3).setLinearDamping(1.5),
  );
  world.createCollider(RAPIER.ColliderDesc.ball(0.4), ball);
  const ballMaterial = new THREE.MeshStandardMaterial({ color: ballColor });
  meshes.push([ball, new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 16), ballMaterial)]);
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(6, 0.02, 8),
    new THREE.MeshStandardMaterial({ color: 0x2a2620 }),
  );
  ground.position.set(shift, -0.01, 0);
  scene.add(ground);
  for (const [, mesh] of meshes) scene.add(mesh);
  return {
    world,
    /** One step: what is asked for pushes the ball, and the world advances. */
    step(input: Input) {
      // A small push every step (the ball weighs about 270 g): up to about 4.5 m/s, with the damping.
      ball.applyImpulse({ x: input[0] * 0.03, y: 0, z: input[1] * 0.03 }, true);
      world.step();
    },
    draw() {
      for (const [body, mesh] of meshes) {
        const p = body.translation();
        const r = body.rotation();
        mesh.position.set(p.x + shift, p.y, p.z);
        mesh.quaternion.set(r.x, r.y, r.z, r.w);
      }
    },
  };
}
