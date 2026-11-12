import type { Quat, Vec3 } from '@manifold/comun';

/** El número que nombra a una entidad. Único dentro de SU mundo (no en todo el programa). */
export type IdEntidad = number;

/**
 * Una ENTIDAD es un id y sus COMPONENTES: datos planos, sin métodos. Una entidad con
 * `transformacion` está en algún lugar; con `giro`, además gira; con `apariencia`, la
 * presentación sabe cómo dibujarla. Ningún componente tiene objetos de Three.js ni de Rapier:
 * por eso un mundo se puede copiar, comparar y fotografiar (decisión 0004).
 *
 * (Fase 0: los primeros tres. Cada paso del motor agrega los suyos.)
 */
export interface Entidad {
  readonly id: IdEntidad;
  transformacion?: Transformacion;
  giro?: Giro;
  apariencia?: Apariencia;
}

export interface Transformacion {
  posicion: Vec3;
  rotacion: Quat;
}

/** Gira a velocidad constante: `velocidadAngular` es el eje por la rapidez (rad/s). */
export interface Giro {
  velocidadAngular: Vec3;
}

/** Cómo se ve, como DATOS (la presentación decide con qué material, según la calidad). */
export interface Apariencia {
  forma: 'caja';
  tamano: Vec3;
  /** 0xRRGGBB */
  color: number;
}

/** Los componentes con que se crea una entidad (todo menos el id, que lo da el mundo). */
export type Componentes = Omit<Entidad, 'id'>;

/** Lo que PASÓ en un paso, como datos (para la presentación, el juego, la red). */
export type Evento = { tipo: 'entidadCreada'; id: IdEntidad } | { tipo: 'entidadQuitada'; id: IdEntidad };
