/**
 * LA FÍSICA DE LA VITRINA, sin Three.js ni pantalla (así se prueba con Vitest).
 *
 * Un campo central "ablandado": el potencial es Φ(r) = −GM / √(r² + ε²), y la aceleración,
 * g = −∇Φ = −GM r / (r² + ε²)^(3/2). La ε evita que el pozo sea infinito en el centro. Por ella
 * las órbitas no se cierran (no es exactamente 1/r²): giran de a poco y dibujan rosetas.
 *
 * Se integra con paso fijo y Euler semi-implícito, como en la lección del paso fijo: primero la
 * velocidad, después la posición con la velocidad NUEVA. Ese orden importa: así la energía oscila
 * un poco pero no se va, y las órbitas no se abren con el tiempo (con el orden al revés, sí).
 */

export const PASO = 1 / 60;
export const GM = 1.5;
export const EPS2 = 0.45 ** 2;
/** Hasta dónde llega la lámina que se dibuja. */
export const RADIO_LAMINA = 3;
/** El radio del cuerpo central. */
export const RADIO_CENTRO = 0.3;

export const potencial = (r: number) => -GM / Math.sqrt(r * r + EPS2);

/** La rapidez de una órbita circular de radio `r`: la justa para que g la haga doblar. */
export const rapidezCircular = (r: number) => Math.sqrt((GM * r * r) / (r * r + EPS2) ** 1.5);

export interface Orbita {
  x: number;
  z: number;
  vx: number;
  vz: number;
  /** La posición del paso anterior, para dibujar entre los dos (interpolar). */
  xAntes: number;
  zAntes: number;
}

/**
 * Las tres órbitas de la vitrina: cada una empieza a la distancia `r`, en el ángulo `fase`, con
 * velocidad perpendicular igual a la circular por `factor` (menos de 1: una elipse que se acerca).
 */
export const ORBITAS_INICIALES = [
  { r: 1.15, factor: 0.82, fase: 0 },
  { r: 1.85, factor: 1, fase: 2.1 },
  { r: 2.6, factor: 0.86, fase: 4.2 },
] as const;

export function crearOrbita(r: number, factor: number, fase: number): Orbita {
  const v = rapidezCircular(r) * factor;
  const x = r * Math.cos(fase);
  const z = r * Math.sin(fase);
  return { x, z, vx: -v * Math.sin(fase), vz: v * Math.cos(fase), xAntes: x, zAntes: z };
}

/** Un paso fijo de Euler semi-implícito. */
export function avanzar(o: Orbita) {
  o.xAntes = o.x;
  o.zAntes = o.z;
  const k = -GM / (o.x * o.x + o.z * o.z + EPS2) ** 1.5; // g = k · (x, z)
  o.vx += k * o.x * PASO;
  o.vz += k * o.z * PASO;
  o.x += o.vx * PASO;
  o.z += o.vz * PASO;
}

/** La energía por unidad de masa: cinética más potencial. Si el integrador es bueno, casi no cambia. */
export const energia = (o: Orbita) => 0.5 * (o.vx * o.vx + o.vz * o.vz) + potencial(Math.hypot(o.x, o.z));
