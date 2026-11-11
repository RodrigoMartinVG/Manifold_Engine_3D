import { describe, expect, test } from 'vitest';
import { quat } from '@manifold/comun';
import { Mundo, PASO } from './mundo';
import { huella } from './huella';

/** Un mundo con unas cajas que giran, en lugares y velocidades sacados de su azar. */
function mundoDePrueba(semilla: number) {
  const m = new Mundo({ semilla });
  for (let i = 0; i < 5; i++) {
    m.crearEntidad({
      transformacion: { posicion: [m.azar.entre(-5, 5), 1, m.azar.entre(-5, 5)], rotacion: quat.identidad() },
      giro: { velocidadAngular: [m.azar.entre(-2, 2), m.azar.entre(-2, 2), m.azar.entre(-2, 2)] },
    });
  }
  return m;
}

describe('Mundo', () => {
  test('cada mundo tiene sus ids: dos mundos creados uno después del otro empiezan igual', () => {
    const a = new Mundo({ semilla: 1 });
    const b = new Mundo({ semilla: 1 });
    expect(a.crearEntidad({}).id).toBe(1);
    expect(b.crearEntidad({}).id).toBe(1);
    expect(a.crearEntidad({}).id).toBe(2);
  });

  test('determinismo: misma semilla, misma huella en CADA paso; otra semilla, otra huella', () => {
    const a = mundoDePrueba(5);
    const b = mundoDePrueba(5);
    const c = mundoDePrueba(6);
    for (let i = 0; i < 600; i++) {
      a.paso();
      b.paso();
      c.paso();
      expect(huella(b)).toBe(huella(a));
    }
    expect(huella(c)).not.toBe(huella(a));
  });

  test('la huella cambia si cambia cualquier número (también por un redondeo)', () => {
    const a = mundoDePrueba(5);
    const antes = huella(a);
    const e = a.entidades.get(3)!;
    e.transformacion!.posicion[1] += 1e-15;
    expect(huella(a)).not.toBe(antes);
  });

  test('girar: después de t segundos, el ángulo girado es |ω|·t (y la rotación sigue unitaria)', () => {
    const m = new Mundo({ semilla: 1 });
    const e = m.crearEntidad({
      transformacion: { posicion: [0, 0, 0], rotacion: quat.identidad() },
      giro: { velocidadAngular: [0, 0.9, 0] },
    });
    for (let i = 0; i < 120; i++) m.paso(); // 2 s
    const q = e.transformacion!.rotacion;
    expect(quat.anguloEntre(quat.identidad(), q)).toBeCloseTo(0.9 * 120 * PASO, 9);
    expect(Math.hypot(...q)).toBeCloseTo(1, 14);
  });

  test('eventos: el juego ve los de cada paso; la presentación, todos los que no leyó', () => {
    const m = new Mundo({ semilla: 1 });
    m.paso();
    m.crearEntidad({});
    expect(m.eventosDelPaso).toHaveLength(1);
    m.paso(); // un paso nuevo: la lista del juego empieza vacía...
    expect(m.eventosDelPaso).toHaveLength(0);
    m.crearEntidad({});
    // ...pero la presentación, que no leyó en el medio, ve los dos.
    expect(m.tomarEventos().map((e) => e.tipo)).toEqual(['entidadCreada', 'entidadCreada']);
    expect(m.tomarEventos()).toHaveLength(0);
  });
});
