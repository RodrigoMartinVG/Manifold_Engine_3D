/**
 * LAS PIEZAS DEL REGISTRO (decisión 0010).
 *
 * Cada parte del sistema (el núcleo, la presentación, cada juego) DECLARA lo que se puede
 * cambiar o hacer: variables y comandos. Nadie lee la dirección ni el teclado por su cuenta.
 * La consola, los enlaces, las salas y las pruebas usan estas declaraciones.
 */

/** Un texto en cada idioma. Por ahora, solo castellano: el inglés se suma después (decisión 0010). */
export interface Texto {
  es: string;
  en?: string;
}

/**
 * Qué toca una variable, y por eso, qué pasa al cambiarla:
 * - `arranque`: cómo nace el mundo (la semilla, cuántos cubos). Cambiarla lo reinicia.
 * - `mundo`: algo del mundo que ya corre (la gravedad, un giro). Entra en un paso concreto,
 *   como una tecla del jugador, y queda en la historia de la partida: no rompe el determinismo.
 * - `vista`: solo lo que se ve (dibujar los triángulos, ir más lento). No toca la simulación.
 */
export type Alcance = 'arranque' | 'mundo' | 'vista';

export type Vec3 = [number, number, number];
export type Valor = number | boolean | string | Vec3;

/** El tipo de un valor, con lo que hace falta para validarlo (y para explicarlo en la ayuda). */
export type Tipo =
  | { tipo: 'numero'; min?: number; max?: number }
  | { tipo: 'entero'; min?: number; max?: number }
  | { tipo: 'booleano' }
  | { tipo: 'vector' }
  | { tipo: 'texto' }
  | { tipo: 'opcion'; opciones: readonly string[] }
  /** El resto de la línea, tal cual (para `atajo f ver.ejes si`). Solo como último argumento. */
  | { tipo: 'resto' };

/** Una variable: un nombre, un valor con su tipo, y qué hacer cuando cambia. `M` es el mundo. */
export interface Variable<M = unknown> {
  /** Con espacio de nombres: `dojo.cubos`, `ver.triangulos`. Minúsculas, números y `_`. */
  nombre: string;
  descripcion: Texto;
  alcance: Alcance;
  tipo: Tipo;
  porDefecto: Valor;
  /** De la vista: qué hacer cuando cambia (enseguida). */
  alCambiar?(valor: Valor): void;
  /**
   * Del mundo: cómo se aplica al mundo. No se llama enseguida: lo llama la partida al empezar el
   * paso siguiente (y al crear el mundo, si el valor no es el de por defecto).
   */
  alMundo?(mundo: M, valor: Valor): void;
}

export interface Argumento {
  nombre: string;
  tipo: Tipo;
  opcional?: boolean;
}

/** Un comando: una acción con argumentos (`reiniciar`, `paso 10`, `dojo.crear 0 5 0`). */
export interface Comando<M = unknown> {
  nombre: string;
  descripcion: Texto;
  argumentos?: readonly Argumento[];
  /**
   * Si una receta (la de un enlace, la de una sala, la de inicio) lo puede ejecutar. Por defecto
   * NO: un enlace ajeno solo puede fijar variables y lo que se declare seguro (decisión 0010).
   */
  enRecetas?: boolean;
  /** Si es una acción del mundo: se aplica en un paso, como las variables del mundo. */
  alMundo?(mundo: M, argumentos: Valor[]): void;
  /** Si no es del mundo: se hace enseguida, y puede escribir en la consola. */
  ejecutar?(argumentos: Valor[], salida: Salida): void;
}

export type Nivel = 'info' | 'aviso' | 'error';

export interface Mensaje {
  nivel: Nivel;
  texto: string;
}

export interface Salida {
  escribir(texto: string, nivel?: Nivel): void;
}

/** De dónde viene una línea: escrita en la consola, o de una receta (un enlace, una sala, la de inicio). */
export type Origen = 'consola' | 'receta';
