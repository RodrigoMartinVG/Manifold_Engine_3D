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

/** How characters move (stage 1b): what they climb, what they snap to, what they push. */
const CHARACTER = {
  /** A thin gap kept between the capsule and what it touches (Rapier's advice: avoid getting stuck). */
  offset: 0.02,
  /** Steps it climbs without jumping: up to 35 cm, if there is at least 15 cm to stand on. */
  stepHeight: 0.35,
  stepWidth: 0.15,
  /** Going down a step or a slope, it stays on the ground if it is closer than this. */
  snapToGround: 0.3,
  /** Slopes it walks up; steeper ones, it slides down. (Radians: π/180 per degree.) */
  maxClimb: (50 * Math.PI) / 180,
  minSlide: (30 * Math.PI) / 180,
};

export class Physics {
  private readonly world: RAPIER.World;
  /** One controller moves every character (its settings are the same for all, for now). */
  private controller: RAPIER.KinematicCharacterController | null = null;

  /** A new physics world; or, with `snapshot`, the one that snapshot keeps (its bodies keep their handles). */
  constructor(gravity: Vec3, timestep: number, snapshot?: Uint8Array) {
    if (!ready) throw new Error('The physics is not ready: `await initPhysics()` before creating a world.');
    this.world = snapshot ? RAPIER.World.restoreSnapshot(snapshot) : new RAPIER.World(v(gravity));
    this.world.gravity = v(gravity);
    this.world.timestep = timestep;
  }

  /** Rapier's snapshot of its world, as bytes: bodies, colliders, contacts and the solver's state. */
  snapshot(): Uint8Array {
    return this.world.takeSnapshot();
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
    // A character's body is moved by POSITION: the controller says where it can go, and it goes there.
    const desc =
      body.type === 'dynamic'
        ? RAPIER.RigidBodyDesc.dynamic()
        : body.type === 'kinematic'
          ? RAPIER.RigidBodyDesc.kinematicVelocityBased()
          : body.type === 'character'
            ? RAPIER.RigidBodyDesc.kinematicPositionBased()
            : RAPIER.RigidBodyDesc.fixed();
    desc.setTranslation(...transform.position).setRotation(q(transform.rotation));
    desc.setLinvel(...body.linearVelocity).setAngvel(v(body.angularVelocity));
    desc.setLinearDamping(body.linearDamping).setAngularDamping(body.angularDamping);
    const rigid = this.world.createRigidBody(desc);
    const shape = body.shape;
    const collider =
      shape.kind === 'ball'
        ? RAPIER.ColliderDesc.ball(shape.radius)
        : shape.kind === 'capsule'
          ? RAPIER.ColliderDesc.capsule(shape.halfHeight, shape.radius)
          : RAPIER.ColliderDesc.cuboid(...shape.halfExtents);
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

  /**
   * Where a character can go this step, if it wants to move `desired` (meters): the controller slides
   * it along walls, climbs it up steps, keeps it on slopes and on the ground, and pushes the dynamic
   * bodies in its way. Returns the movement it can do, whether it ends standing on something, and
   * whether it hit something above: a collision whose normal, on the character's side, points "up"
   * (its head touched it). Brushing a wall while rising is not a ceiling.
   */
  moveCharacter(handle: number, desired: Vec3, up: Vec3): { movement: Vec3; grounded: boolean; ceiling: boolean } {
    const rigid = this.world.getRigidBody(handle);
    const collider = rigid?.collider(0);
    if (!rigid || !collider) return { movement: [0, 0, 0], grounded: false, ceiling: false };
    const c = (this.controller ??= this.createController());
    c.setUp(v(up));
    c.computeColliderMovement(collider, v(desired));
    let ceiling = false;
    for (let i = 0; i < c.numComputedCollisions(); i++) {
      const n = c.computedCollision(i)?.normal2;
      if (n && n.x * up[0] + n.y * up[1] + n.z * up[2] > 0.7) ceiling = true;
    }
    return { movement: toVec(c.computedMovement()), grounded: c.computedGrounded(), ceiling };
  }

  /** Where a character's body will be at the end of the next step (it moves there during the step). */
  setNextPose(handle: number, position: Vec3, rotation: Quat) {
    const rigid = this.world.getRigidBody(handle);
    if (!rigid) return;
    rigid.setNextKinematicTranslation(v(position));
    rigid.setNextKinematicRotation(q(rotation));
  }

  /** Where a body is now, according to the physics (32-bit numbers). */
  position(handle: number): Vec3 {
    const rigid = this.world.getRigidBody(handle);
    return rigid ? toVec(rigid.translation()) : [0, 0, 0];
  }

  private createController() {
    const c = this.world.createCharacterController(CHARACTER.offset);
    c.enableAutostep(CHARACTER.stepHeight, CHARACTER.stepWidth, false);
    c.enableSnapToGround(CHARACTER.snapToGround);
    c.setMaxSlopeClimbAngle(CHARACTER.maxClimb);
    c.setMinSlopeSlideAngle(CHARACTER.minSlide);
    c.setApplyImpulsesToDynamicBodies(true);
    return c;
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
    if (this.controller) this.world.removeCharacterController(this.controller);
    this.world.free();
  }
}
