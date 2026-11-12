import { PASO } from './mundo';

/** Como mucho, cuántos pasos se dan en un cuadro (si la pestaña estuvo dormida, no se intenta alcanzar todo). */
const MAXIMO_PASOS = 5;

/**
 * EL RELOJ DEL PASO FIJO. La pantalla dibuja cuando puede (60, 30 o 144 veces por segundo);
 * la simulación avanza siempre de a `PASO`. El reloj junta el tiempo real que pasó y dice
 * cuántos pasos enteros "se compraron"; lo que sobra queda para el cuadro siguiente.
 *
 * `alfa` (entre 0 y 1) es cuánto del paso siguiente ya transcurrió: la presentación lo usa
 * para dibujar las cosas a mitad de camino entre el paso anterior y el actual (interpolar),
 * y que se vean suaves aunque la pantalla vaya a otro ritmo.
 */
export class Reloj {
  private acumulado = 0;

  /** Suma `segundos` de tiempo real y devuelve cuántos pasos hay que dar ahora. */
  avanzar(segundos: number): number {
    this.acumulado += Math.max(0, segundos);
    let pasos = Math.floor(this.acumulado / PASO + 1e-9);
    if (pasos > MAXIMO_PASOS) {
      // Una pausa larga (otra pestaña, el depurador): se descarta, en vez de correr cientos
      // de pasos de golpe y trabar todo (la "espiral de la muerte").
      pasos = MAXIMO_PASOS;
      this.acumulado = 0;
      return pasos;
    }
    this.acumulado -= pasos * PASO;
    if (this.acumulado < 0) this.acumulado = 0;
    return pasos;
  }

  get alfa(): number {
    return Math.min(1, this.acumulado / PASO);
  }
}
