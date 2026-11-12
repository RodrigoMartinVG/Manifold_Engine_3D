import RAPIER from '@dimforge/rapier3d-deterministic-compat';
import type { Quat, Vec3 } from '@manifold/common';
import type { Body, BodySpec, Transform } from './types';

/**
 * THE BOUNDARY WITH THE PHYSICS ENGINE (decision 0000: "Rapier behind a small boundary"). This is
 * the only file of the engine that imports Rapier: the rest talks to `Physics`, in our types.
 *
 * It is Rapier's DETERMINISTIC build (decision 0012): it does its math the same way on every
 * machine, so two browsers can run the same world and get the same hash. It is a little slower than
 * the usual build; in exchange, replays, ghosts by link and networking are possible.
 *
 * Rapier runs in WebAssembly, which loads asynchronously: `await initPhysics()` once, before
 * creating any world (in the browser, in the tests, on a server).
 */
let ready = false;

export async function initPhysics(): Promise<void> {
  if (ready) return;
  await RAPIER.init();
  ready = true;
}

const v = (x: Vec3) => ({ x: x[0], y: x[1], z: x[2] });
const q = (r: Quat) => ({ x: r[0], y: r[1], z: r[2], w: r[3] });
const toVec = (x: { x: number; y: number; z: number }): Vec3 => [x.x, x.y, x.z];
const toQuat = (r: { x: number; y: number; z: number; w: number }): Quat => [r.x, r.y, r.z, r.w];

export class Physics {
  private readonly world: RAPIER.World;

  constructor(gravity: Vec3, timestep: number) {
    if (!ready) throw new Error('The physics is not ready: `await initPhysics()` before creating a world.');
    this.world = new RAPIER.World(v(gravity));
    this.world.timestep = timestep;
  }

  setGravity(g: Vec3) {
    this.world.gravity = v(g);
  }

  /** Creates the body and its collider; returns the complete body component, with its handle. */
  addBody(spec: BodySpec, transform: Transform): Body {
    const body: Body = {
      type: spec.type,
      shape: spec.shape,
      restitution: spec.restitution ?? 0.2,
      friction: spec.friction ?? 0.6,
      linearDamping: spec.linearDamping ?? 0,
      angularDamping: spec.angularDamping ?? 0,
      linearVelocity: [...(spec.linearVelocity ?? [0, 0, 0])],
      angularVelocity: [...(spec.angularVelocity ?? [0, 0, 0])],
      handle: 0,
    };
    // Kinematic bodies are moved by VELOCITY: the physics integrates them (with its deterministic
    // math), and what they touch receives the push.
    const desc =
      body.type === 'dynamic'
        ? RAPIER.RigidBodyDesc.dynamic()
        : body.type === 'kinematic'
          ? RAPIER.RigidBodyDesc.kinematicVelocityBased()
          : RAPIER.RigidBodyDesc.fixed();
    desc.setTranslation(...transform.position).setRotation(q(transform.rotation));
    desc.setLinvel(...body.linearVelocity).setAngvel(v(body.angularVelocity));
    desc.setLinearDamping(body.linearDamping).setAngularDamping(body.angularDamping);
    const rigid = this.world.createRigidBody(desc);
    const shape = body.shape;
    const collider =
      shape.kind === 'ball' ? RAPIER.ColliderDesc.ball(shape.radius) : RAPIER.ColliderDesc.cuboid(...shape.halfExtents);
    collider.setRestitution(body.restitution).setFriction(body.friction);
    this.world.createCollider(collider, rigid);
    body.handle = rigid.handle;
    return body;
  }

  removeBody(handle: number) {
    const rigid = this.world.getRigidBody(handle);
    if (rigid) this.world.removeRigidBody(rigid);
  }

  /** The velocity a kinematic body moves with during the next step. */
  setKinematicVelocity(handle: number, linear: Vec3, angular: Vec3) {
    const rigid = this.world.getRigidBody(handle);
    if (!rigid) return;
    rigid.setLinvel(v(linear), true);
    rigid.setAngvel(v(angular), true);
  }

  step() {
    this.world.step();
  }

  /** Copies where the body is and how it moves into the entity's components (after a step). */
  read(handle: number, transform: Transform, body: Body) {
    const rigid = this.world.getRigidBody(handle);
    if (!rigid) return;
    transform.position = toVec(rigid.translation());
    transform.rotation = toQuat(rigid.rotation());
    body.linearVelocity = toVec(rigid.linvel());
    body.angularVelocity = toVec(rigid.angvel());
  }

  get bodyCount(): number {
    return this.world.bodies.len();
  }

  /** What the physics sees, as line segments (for `show.physics`): xyz per vertex, rgba per vertex. */
  debugLines(): { vertices: Float32Array; colors: Float32Array } {
    const { vertices, colors } = this.world.debugRender();
    return { vertices, colors };
  }

  /** Frees the physics' memory (WebAssembly's, which the garbage collector does not see). */
  dispose() {
    this.world.free();
  }
}
