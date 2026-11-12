import type { Registro } from '@manifold/comandos';
import type { Evento } from './tipos';
import type { Mundo } from './mundo';

/**
 * EL CONTRATO ENTRE EL MOTOR Y UN JUEGO (decisión 0000: "mecanismo y política").
 *
 * El motor simula; no sabe a qué se juega. Un juego (el Dojo es el primero) es un CARTUCHO
 * que el motor recibe: dice qué hay en el mundo al empezar y qué significa lo que pasa.
 * El motor nunca importa un juego (lo vigilan el compilador y el linter: decisión 0003).
 *
 * Fase 0: lo mínimo. Va a crecer con lo que pidan los juegos (en la V1 hicieron falta:
 * capacidades, armas, guardar la partida, viajar entre niveles, el fin, los equipos...), y
 * cada cosa nueva entra con su prueba y su capítulo del tutorial.
 */
export interface Cartucho {
  /** Para las direcciones y las repeticiones: "dojo". */
  readonly id: string;
  readonly titulo: string;
  /**
   * Sus variables y comandos (decisión 0010): lo que este juego deja cambiar y hacer. Cada juego
   * decide qué expone: el Dojo, todo; un juego competitivo, quizás nada. Se llama una vez por
   * registro, antes de crear el mundo.
   */
  alDeclarar?(registro: Registro<Mundo>): void;
  /**
   * Una vez, con el mundo recién creado: poner lo que haya al empezar. Lo de ARRANQUE (cuántos
   * cubos, qué sala) se lee del registro, que ya tiene aplicadas las recetas.
   */
  alIniciar(mundo: Mundo, registro: Registro<Mundo>): void;
  /** En cada paso, después de que el mundo avanzó, con los eventos de ese paso. */
  alAvanzar?(mundo: Mundo, eventos: readonly Evento[]): void;
}
