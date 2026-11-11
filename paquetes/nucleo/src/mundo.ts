import { Azar, quat } from '@manifold/comun';
import type { Componentes, Entidad, Evento, IdEntidad } from './tipos';

/** El paso fijo: la simulación avanza siempre de a 1/60 de segundo, sin importar los FPS. */
export const PASO = 1 / 60;

export interface OpcionesMundo {
  /** La semilla de su azar: el mismo mundo con la misma semilla hace exactamente lo mismo. */
  semilla: number;
}

/**
 * UN MUNDO: todo el estado de una simulación, y nada afuera.
 *
 * Lección de la V1 (decisión 0000): un contador de ids o un azar "del programa" hace que dos
 * mundos en el mismo proceso (un servidor con dos salas, una partida y su repetición, una
 * prueba con servidor y cliente) se roben números entre sí. Aquí cada mundo tiene SU reloj,
 * SU contador de ids y SU azar. Se pueden crear cien mundos a la vez sin que se enteren.
 */
export class Mundo {
  /** Cuántos pasos dio. */
  tick = 0;
  readonly azar: Azar;
  readonly entidades = new Map<IdEntidad, Entidad>();
  private ultimoId = 0;
  /**
   * Los eventos tienen DOS lectores, a dos ritmos:
   * - el juego (el cartucho), una vez por PASO: `eventosDelPaso`, que se vacía al empezar cada paso;
   * - la presentación, una vez por CUADRO de la pantalla: `tomarEventos()`. Esos NO se vacían en
   *   cada paso: si en un cuadro se dan dos pasos, la presentación tiene que ver los eventos de
   *   los dos (lección de la V1, que la propuesta de arquitectura olvidaba).
   */
  eventosDelPaso: Evento[] = [];
  private pendientes: Evento[] = [];

  constructor(o: OpcionesMundo) {
    this.azar = new Azar(o.semilla);
  }

  crearEntidad(componentes: Componentes): Entidad {
    const entidad: Entidad = { id: ++this.ultimoId, ...componentes };
    this.entidades.set(entidad.id, entidad);
    this.emitir({ tipo: 'entidadCreada', id: entidad.id });
    return entidad;
  }

  quitarEntidad(id: IdEntidad) {
    if (this.entidades.delete(id)) this.emitir({ tipo: 'entidadQuitada', id });
  }

  /**
   * Un paso fijo. Los sistemas corren SIEMPRE en el mismo orden, y las entidades se recorren
   * en orden de creación (un `Map` conserva el orden de inserción): el orden es parte del
   * determinismo.
   */
  paso() {
    this.eventosDelPaso = [];
    this.tick++;
    this.girar();
  }

  /** Anotar que pasó algo (para los dos lectores). */
  emitir(evento: Evento) {
    this.eventosDelPaso.push(evento);
    this.pendientes.push(evento);
  }

  /** Para la presentación: los eventos desde la última vez que preguntó (y los olvida). */
  tomarEventos(): Evento[] {
    const eventos = this.pendientes;
    this.pendientes = [];
    return eventos;
  }

  /**
   * Sistema GIRO: la rotación avanza el ángulo de este paso alrededor del eje de su velocidad
   * angular. Con un eje fijo esto es exacto (las rotaciones alrededor del mismo eje se suman);
   * se renormaliza para que el redondeo no se acumule.
   */
  private girar() {
    for (const e of this.entidades.values()) {
      if (!e.giro || !e.transformacion) continue;
      const w = e.giro.velocidadAngular;
      const rapidez = Math.hypot(w[0], w[1], w[2]);
      if (rapidez === 0) continue;
      const delta = quat.desdeEjeAngulo(w, rapidez * PASO);
      e.transformacion.rotacion = quat.normalizar(quat.multiplicar(delta, e.transformacion.rotacion));
    }
  }
}
