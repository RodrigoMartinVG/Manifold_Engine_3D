import type { Mundo } from './mundo';

const buffer = new DataView(new ArrayBuffer(8));

/**
 * LA HUELLA de un mundo: un número de 32 bits que resume TODO su estado (el reloj, el azar y
 * cada número de cada entidad). Dos mundos con la misma huella están, casi seguro, en el mismo
 * estado; con huellas distintas, seguro que no.
 *
 * Sirve para el determinismo: en vez de comparar miles de números a mano, se compara una
 * huella por paso, y si dos simulaciones se separan, se sabe EN QUÉ PASO (decisión 0000, de
 * la evaluación estratégica).
 *
 * Es FNV-1a sobre los BYTES de cada número (como `Float64`): así 0,1 + 0,2 y 0,3 dan huellas
 * distintas, como tiene que ser. Recorre las entidades en orden de id y sus componentes en un
 * orden fijo de claves.
 */
export function huella(mundo: Mundo): number {
  let h = 0x811c9dc5;
  const byte = (b: number) => {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  };
  const numero = (n: number) => {
    buffer.setFloat64(0, n);
    for (let i = 0; i < 8; i++) byte(buffer.getUint8(i));
  };
  const texto = (t: string) => {
    for (let i = 0; i < t.length; i++) numero(t.charCodeAt(i));
  };
  const valor = (v: unknown): void => {
    if (typeof v === 'number') numero(v);
    else if (typeof v === 'string') texto(v);
    else if (typeof v === 'boolean') byte(v ? 1 : 0);
    else if (Array.isArray(v)) {
      numero(v.length);
      for (const x of v) valor(x);
    } else if (v && typeof v === 'object') {
      for (const clave of Object.keys(v).sort()) {
        texto(clave);
        valor((v as Record<string, unknown>)[clave]);
      }
    } else byte(0);
  };
  numero(mundo.tick);
  for (const n of mundo.azar.estado) numero(n);
  const ids = [...mundo.entidades.keys()].sort((a, b) => a - b);
  for (const id of ids) valor(mundo.entidades.get(id));
  return h >>> 0;
}
