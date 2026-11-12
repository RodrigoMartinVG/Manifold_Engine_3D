/**
 * MATEMÁTICA SOBRE DATOS PLANOS.
 *
 * Vectores y cuaterniones son tuplas de números (`[x, y, z]`, `[x, y, z, w]`), no objetos con
 * métodos. Así el estado del mundo es solo datos: se copia, se compara, se guarda en una foto
 * y viaja por la red sin convertir nada (decisión 0004). Las funciones devuelven tuplas
 * nuevas; las que llevan `En` al final escriben en una tupla que ya existe (para no crear
 * basura en los bucles que corren 60 veces por segundo).
 *
 * Convención de ejes (la de Three.js, para no traducir en la presentación): X a la derecha,
 * Y arriba, Z hacia la cámara (adelante es −Z). Pero el motor NO supone que "arriba" sea +Y:
 * la gravedad es un campo (decisión 0000), y cada cosa tiene su propio "arriba".
 */
export type Vec3 = [x: number, y: number, z: number];
/** Un cuaternión unitario: una rotación. `w` es la parte real. */
export type Quat = [x: number, y: number, z: number, w: number];

export const vec3 = {
  cero: (): Vec3 => [0, 0, 0],
  sumar: (a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  restar: (a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  escalar: (a: Readonly<Vec3>, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k],
  punto: (a: Readonly<Vec3>, b: Readonly<Vec3>): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cruz: (a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ],
  largo: (a: Readonly<Vec3>): number => Math.hypot(a[0], a[1], a[2]),
  /** El mismo vector con largo 1 (el cero queda cero). */
  normalizar: (a: Readonly<Vec3>): Vec3 => {
    const l = Math.hypot(a[0], a[1], a[2]);
    return l > 0 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0];
  },
};

export const quat = {
  identidad: (): Quat => [0, 0, 0, 1],

  /** La rotación de `angulo` radianes alrededor de `eje` (no hace falta que tenga largo 1). */
  desdeEjeAngulo: (eje: Readonly<Vec3>, angulo: number): Quat => {
    const [x, y, z] = vec3.normalizar(eje);
    const s = Math.sin(angulo / 2);
    return [x * s, y * s, z * s, Math.cos(angulo / 2)];
  },

  /**
   * a × b: primero rota b, después a (como las matrices: el de la derecha se aplica primero).
   * El producto de Hamilton, escrito componente por componente.
   */
  multiplicar: (a: Readonly<Quat>, b: Readonly<Quat>): Quat => [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ],

  /**
   * Vuelve a largo 1. Multiplicar cuaterniones miles de veces acumula error de redondeo y la
   * rotación empezaría a "estirar" las cosas: se renormaliza después de cada integración.
   */
  normalizar: (q: Readonly<Quat>): Quat => {
    const l = Math.hypot(q[0], q[1], q[2], q[3]);
    return l > 0 ? [q[0] / l, q[1] / l, q[2] / l, q[3] / l] : [0, 0, 0, 1];
  },

  /** Rota el vector `v` con `q` (q · v · q⁻¹, escrito sin construir cuaterniones intermedios). */
  rotar: (q: Readonly<Quat>, v: Readonly<Vec3>): Vec3 => {
    const [x, y, z, w] = q;
    // t = 2 · (q.xyz × v)
    const tx = 2 * (y * v[2] - z * v[1]);
    const ty = 2 * (z * v[0] - x * v[2]);
    const tz = 2 * (x * v[1] - y * v[0]);
    // v' = v + w·t + q.xyz × t
    return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)];
  },

  /** El ángulo (radianes, de 0 a π) de la rotación que lleva de `a` a `b`. */
  anguloEntre: (a: Readonly<Quat>, b: Readonly<Quat>): number => {
    const d = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
    return 2 * Math.acos(Math.min(1, d));
  },
};
