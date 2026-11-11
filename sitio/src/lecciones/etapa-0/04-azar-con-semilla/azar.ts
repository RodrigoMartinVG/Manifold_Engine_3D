/**
 * Un generador de azar CON SEMILLA, el más simple que hay: un "congruencial lineal".
 *
 *     estado = (a · estado + c) módulo 2³²
 *
 * Cada número sale del anterior con una multiplicación y una suma. El mismo estado inicial (la
 * SEMILLA) da siempre la misma secuencia: parece azar, pero se puede repetir.
 *
 * Sutileza: este es muy simple y sus bits bajos se repiten seguido (para un juego alcanza; el
 * motor usa uno mejor, SFC32). Y para criptografía, ninguno de los dos sirve.
 */
export function crearAzar(semilla: number): () => number {
  let estado = semilla >>> 0; // `>>> 0`: un entero de 32 bits sin signo
  return () => {
    // Math.imul multiplica como un procesador de 32 bits (una multiplicación común se pasaría de rango).
    estado = (Math.imul(estado, 1664525) + 1013904223) >>> 0;
    return estado / 4294967296; // entre 0 y 1, como Math.random()
  };
}
