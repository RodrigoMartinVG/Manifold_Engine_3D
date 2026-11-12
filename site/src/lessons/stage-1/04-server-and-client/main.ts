import GUI from 'three/addons/libs/lil-gui.module.min.js';
import RAPIER from '@dimforge/rapier3d-deterministic-compat';
import { createScene } from './scene';
import { createRandom } from './random';
import { hashOf } from './hash';
import { createWorld, STEP, type Input } from './world';

await RAPIER.init();
const { scene, onFrame } = createScene({ camera: [0, 7, 12], target: [0, 1.8, 0] });

/** What the server says about each step: what entered at it, and, every 60 steps, its hash. */
interface Tick {
  step: number;
  input?: Input;
  hash?: number;
}

const options = { lag: 150, loseAnInput: () => (bug = true) };
let bug = false;

/** A wire that delivers each message `lag` milliseconds later, and IN ORDER, like a network connection. */
function wire<T>(deliver: (message: T) => void) {
  const queue: { at: number; message: T }[] = [];
  return {
    send(message: T) {
      const after = queue.at(-1)?.at ?? 0;
      queue.push({ at: Math.max(performance.now() + options.lag, after), message });
    },
    deliverDue() {
      while (queue.length && queue[0]!.at <= performance.now()) deliver(queue.shift()!.message);
    },
  };
}

// ---------- THE SERVER (left): it keeps THE match, and tells what entered at each step ----------
const server = createWorld(scene, -3.5, 0xd8904a);
let serverStep = 0;
let received: Input = [0, 0]; // the last thing the player asked for, as it arrived
let applied: Input = [0, 0];
const toServer = wire<Input>((input) => (received = input));
const toClient = wire<Tick>((tick) => ticks.push(tick));

function serverStepOnce() {
  serverStep++;
  const tick: Tick = { step: serverStep };
  if (received[0] !== applied[0] || received[1] !== applied[1]) tick.input = applied = received;
  server.step(applied);
  if (serverStep % 60 === 0) tick.hash = hashOf(server.world);
  toClient.send(tick);
}

// ---------- THE CLIENT (right): it asks, and simulates ITS OWN COPY with what the server says ----------
const client = createWorld(scene, 3.5, 0x93d9c9);
const ticks: Tick[] = [];
let clientInput: Input = [0, 0];
let sent: Input = [0, 0];
const readout = { serverStep: 0, behind: 0, checks: 0, desyncs: 0, firstDesync: '-' };

function clientSteps() {
  while (ticks.length) {
    const tick = ticks.shift()!;
    if (tick.input) {
      if (bug)
        bug = false; // a bug, simulated: this copy loses one input
      else clientInput = tick.input;
    }
    client.step(clientInput);
    if (tick.hash !== undefined) {
      if (hashOf(client.world) === tick.hash) readout.checks++;
      else {
        readout.desyncs++;
        if (readout.firstDesync === '-') readout.firstDesync = String(tick.step);
      }
    }
    readout.behind = serverStep - tick.step;
  }
}

// What the player asks for: an autopilot (or WASD, after a click on the drawing).
const held = new Set<string>();
addEventListener('keydown', (e) => held.add(e.code));
addEventListener('keyup', (e) => held.delete(e.code));
const pilot = createRandom(3);
let pilotInput: Input = [0, 0];
let frames = 0;
function ask(): Input {
  const keys: Input = [
    (held.has('KeyD') ? 1 : 0) - (held.has('KeyA') ? 1 : 0),
    (held.has('KeyS') ? 1 : 0) - (held.has('KeyW') ? 1 : 0),
  ];
  if (keys[0] || keys[1]) return keys;
  if (frames++ % 50 === 0) pilotInput = [Math.floor(pilot() * 3) - 1, Math.floor(pilot() * 3) - 1];
  return pilotInput;
}

const gui = new GUI({ title: 'Server and client' });
gui.add(options, 'lag', 0, 1000, 10).name('lag (ms, each way)');
gui.add(options, 'loseAnInput').name('the client loses an input (a bug)');
gui.add(readout, 'serverStep').name('server step').listen().disable();
gui.add(readout, 'behind').name('client steps behind').listen().disable();
gui.add(readout, 'checks').name('hash checks, the same').listen().disable();
gui.add(readout, 'desyncs').name('desyncs').listen().disable();
gui.add(readout, 'firstDesync').name('first desync at step').listen().disable();

let accumulator = 0;
onFrame((dt) => {
  // The client asks (only when it changes), and the request travels.
  const input = ask();
  if (input[0] !== sent[0] || input[1] !== sent[1]) toServer.send((sent = input));
  toServer.deliverDue();
  // The server advances on ITS clock, and tells each step.
  accumulator += dt;
  while (accumulator >= STEP) {
    serverStepOnce();
    accumulator -= STEP;
  }
  // What arrived reaches the client, which takes those steps.
  toClient.deliverDue();
  clientSteps();
  server.draw();
  client.draw();
  readout.serverStep = serverStep;
});
