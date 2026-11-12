import { describe, expect, test } from 'vitest';
import { quat, vec3, type Vec3 } from './matematica';

const cerca = (a: readonly number[], b: readonly number[], tolerancia = 1e-12) =>
  a.forEach((x, i) => expect(Math.abs(x - b[i]!)).toBeLessThan(tolerancia));

describe('vectores', () => {
  test('producto cruz: X × Y = Z (mano derecha), y es perpendicular a los dos', () => {
    cerca(vec3.cruz([1, 0, 0], [0, 1, 0]), [0, 0, 1]);
    const a: Vec3 = [1, 2, 3];
    const b: Vec3 = [-4, 0.5, 2];
    const c = vec3.cruz(a, b);
    expect(Math.abs(vec3.punto(c, a))).toBeLessThan(1e-12);
    expect(Math.abs(vec3.punto(c, b))).toBeLessThan(1e-12);
  });

  test('normalizar deja largo 1 (y el cero queda cero, sin dividir por cero)', () => {
    expect(vec3.largo(vec3.normalizar([3, 4, 12]))).toBeCloseTo(1, 15);
    expect(vec3.normalizar([0, 0, 0])).toEqual([0, 0, 0]);
  });
});

describe('cuaterniones', () => {
  test('90° alrededor de Y llevan +X a −Z (regla de la mano derecha)', () => {
    const q = quat.desdeEjeAngulo([0, 1, 0], Math.PI / 2);
    cerca(quat.rotar(q, [1, 0, 0]), [0, 0, -1]);
  });

  test('la identidad no rota; multiplicar por ella no cambia nada', () => {
    const q = quat.desdeEjeAngulo([1, 2, 3], 0.7);
    cerca(quat.multiplicar(quat.identidad(), q), q);
    cerca(quat.multiplicar(q, quat.identidad()), q);
    cerca(quat.rotar(quat.identidad(), [4, 5, 6]), [4, 5, 6]);
  });

  test('componer: a × b rota primero con b y después con a', () => {
    const a = quat.desdeEjeAngulo([0, 0, 1], 0.4);
    const b = quat.desdeEjeAngulo([1, 0, 0], 1.1);
    const v: Vec3 = [0.3, -2, 5];
    cerca(quat.rotar(quat.multiplicar(a, b), v), quat.rotar(a, quat.rotar(b, v)));
  });

  test('alrededor del mismo eje, los ángulos se suman', () => {
    const eje: Vec3 = [1, 1, 0];
    const q = quat.multiplicar(quat.desdeEjeAngulo(eje, 0.3), quat.desdeEjeAngulo(eje, 0.5));
    cerca(q, quat.desdeEjeAngulo(eje, 0.8));
    expect(quat.anguloEntre(quat.identidad(), q)).toBeCloseTo(0.8, 12);
  });

  test('rotar conserva el largo de los vectores', () => {
    const q = quat.desdeEjeAngulo([-2, 1, 4], 2.3);
    const v: Vec3 = [7, -1, 0.5];
    expect(vec3.largo(quat.rotar(q, v))).toBeCloseTo(vec3.largo(v), 12);
  });
});
