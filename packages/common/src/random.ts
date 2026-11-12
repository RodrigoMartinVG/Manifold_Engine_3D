/**
 * AZAR CON SEMILLA.
 *
 * `Math.random()` da otra secuencia en cada ejecución. Para que una simulación se pueda
 * repetir (la misma partida, un experimento compartido, el servidor y el cliente de acuerdo),
 * todo el azar que cambie el mundo sale de un generador con SEMILLA: el mismo número inicial
 * da siempre la misma secuencia.
 *
 * Este es SFC32 ("small fast counter", de Chris Doty-Humphrey): cuatro números de 32 bits de
 * estado, que cada llamada mezcla con sumas, desplazamientos y rotaciones. Es rápido, pasa
 * las baterías de pruebas estadísticas habituales y no es para criptografía. Uno de sus
 * cuatro números es un contador que solo crece de a uno: garantiza que la secuencia no
 * caiga en un ciclo corto.
 *
 * La semilla (un solo número) se reparte en los cuatro de estado con SPLITMIX32, otro
 * generador chico que convierte números parecidos (1, 2, 3...) en estados muy distintos.
 *
 * El estado se puede leer y restaurar (`estado`, `restaurar`): así una foto del mundo
 * incluye "en qué punto del azar íbamos".
 */
export class Azar {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(semilla: number) {
    let s = semilla >>> 0;
    const splitmix = () => {
      s = (s + 0x9e3779b9) >>> 0;
      let z = s;
      z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
      z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
      return (z ^ (z >>> 16)) >>> 0;
    };
    this.a = splitmix();
    this.b = splitmix();
    this.c = splitmix();
    this.d = 1; // el contador
    // Unas vueltas en vacío: los primeros números de un estado recién sembrado se parecen.
    for (let i = 0; i < 12; i++) this.entero();
  }

  /** Un entero de 32 bits sin signo. */
  entero(): number {
    const t = (((this.a + this.b) >>> 0) + this.d) >>> 0;
    this.d = (this.d + 1) >>> 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) >>> 0;
    this.c = ((this.c << 21) | (this.c >>> 11)) >>> 0;
    this.c = (this.c + t) >>> 0;
    return t;
  }

  /** Un número en [0, 1), como `Math.random()`. */
  siguiente(): number {
    return this.entero() / 4294967296;
  }

  /** Un número en [min, max). */
  entre(min: number, max: number): number {
    return min + (max - min) * this.siguiente();
  }

  /** Un elemento de la lista, cada uno con la misma probabilidad. */
  elegir<T>(lista: readonly T[]): T {
    if (lista.length === 0) throw new Error('No se puede elegir de una lista vacía');
    return lista[Math.floor(this.siguiente() * lista.length)] as T;
  }

  /** El estado, para guardarlo en una foto del mundo. */
  get estado(): readonly [number, number, number, number] {
    return [this.a, this.b, this.c, this.d];
  }

  /** Volver a un estado guardado: la secuencia sigue desde ahí. */
  restaurar(e: readonly [number, number, number, number]) {
    [this.a, this.b, this.c, this.d] = e;
  }
}
