import * as THREE from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { crearEscena } from './escena';

const { escena, alCuadro } = crearEscena();

const G = 9.81; // m/s²
const RADIO = 0.25;
const VELOCIDAD_INICIAL = 7; // m/s hacia arriba: en teoría sube RADIO + v²/2g ≈ 2,75 m

/** Una pelota que solo sube y baja: su altura y su velocidad. Rebota sin perder energía. */
interface Pelota {
  y: number;
  vy: number;
  maxima: number; // la altura más alta a la que llegó
}
const nueva = (): Pelota => ({ y: RADIO, vy: VELOCIDAD_INICIAL, maxima: RADIO });

/** Un paso de física de `dt` segundos (Euler semi-implícito: primero la velocidad, después la posición). */
function integrar(p: Pelota, dt: number) {
  p.vy -= G * dt;
  p.y += p.vy * dt;
  p.maxima = Math.max(p.maxima, p.y);
  if (p.y < RADIO) {
    p.y = RADIO;
    p.vy = Math.abs(p.vy);
  }
}

const esfera = (color: number, x: number) => {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(RADIO, 24, 16),
    new THREE.MeshStandardMaterial({ color }),
  );
  m.position.x = x;
  escena.add(m);
  return m;
};
const mallaRoja = esfera(0xe06c75, -1);
const mallaVerde = esfera(0x98c379, 1);

let roja = nueva();
let verde = nueva();
let verdeAnterior = verde.y; // para interpolar
let acumulador = 0;
let tiempoDePantalla = 0;

const opciones = {
  pantalla: 60, // cuadros por segundo que SIMULAMOS (una pantalla lenta)
  paso: 60, // pasos fijos por segundo de la pelota verde
  interpolar: true,
  reiniciar: () => {
    roja = nueva();
    verde = nueva();
    verdeAnterior = verde.y;
    acumulador = 0;
  },
};
const lectura = { roja: 0, verde: 0 };
const gui = new GUI({ title: 'Paso fijo' });
gui.add(opciones, 'pantalla', 5, 120, 1).name('pantalla (cuadros/s)');
gui.add(opciones, 'paso', 5, 120, 1).name('paso verde (por s)');
gui.add(opciones, 'interpolar').name('interpolar la verde');
gui.add(opciones, 'reiniciar');
const alturas = gui.addFolder('Altura máxima (m)');
alturas.add(lectura, 'roja').name('roja (dt de la pantalla)').listen().disable();
alturas.add(lectura, 'verde').name('verde (paso fijo)').listen().disable();

alCuadro((dt) => {
  // Una pantalla LENTA, a propósito: el mundo solo avanza cuando "llega" un cuadro de ella.
  tiempoDePantalla += dt;
  if (tiempoDePantalla < 1 / opciones.pantalla) return;
  const dtPantalla = tiempoDePantalla;
  tiempoDePantalla = 0;

  // ROJA: un paso del tamaño del cuadro. Si la pantalla va lenta, los pasos son grandes, y el
  // resultado (cuánto sube) depende de la pantalla.
  integrar(roja, dtPantalla);

  // VERDE: el tiempo se junta, y se gasta de a pasos IGUALES. Lo que sobra queda para después.
  const paso = 1 / opciones.paso;
  acumulador += dtPantalla;
  while (acumulador >= paso) {
    verdeAnterior = verde.y;
    integrar(verde, paso);
    acumulador -= paso;
  }

  mallaRoja.position.y = roja.y;
  // Interpolar: dibujarla ENTRE el paso anterior y el actual, según cuánto del siguiente ya pasó.
  const alfa = acumulador / paso;
  mallaVerde.position.y = opciones.interpolar
    ? verdeAnterior + (verde.y - verdeAnterior) * alfa
    : verde.y;
  lectura.roja = +roja.maxima.toFixed(2);
  lectura.verde = +verde.maxima.toFixed(2);
});

// Probá: pantalla en 10 → la roja sube distinto (cambió la física). Paso verde en 10 con la
// interpolación apagada → la verde se mueve a saltos; prendela → suave, y sube igual.
