import { crearEscena } from './escena';
import { avanzar, crearMundo, PASO, resumen } from './simulacion';
import { crearVista } from './vista';

// 1. SIN PANTALLA: dos mundos con la misma semilla, 600 pasos (10 s de juego) cada uno, ya.
const inicio = performance.now();
const a = crearMundo(7, 25);
const b = crearMundo(7, 25);
for (let i = 0; i < 600; i++) {
  avanzar(a);
  avanzar(b);
}
console.log(`dos mundos, 600 pasos cada uno, en ${(performance.now() - inicio).toFixed(1)} ms`);
console.log(`resumen A: ${resumen(a)}`);
console.log(`resumen B: ${resumen(b)}  → ${resumen(a) === resumen(b) ? 'iguales' : 'DISTINTOS'}`);

// 2. CON PANTALLA: el mismo tipo de mundo, ahora dibujado. El tiempo real se gasta de a pasos fijos.
const { escena, alCuadro } = crearEscena();
const mundo = crearMundo(7, 25);
const vista = crearVista(escena, mundo);
let acumulador = 0;
alCuadro((dt) => {
  acumulador += dt;
  while (acumulador >= PASO) {
    avanzar(mundo);
    acumulador -= PASO;
  }
  vista.dibujar();
});

// Probá: cambiá la semilla de B. Y en simulacion.ts, agregá `import * as THREE from 'three'`:
// funciona, pero ya no podría correr sin pantalla (en el motor, eso no compila).
