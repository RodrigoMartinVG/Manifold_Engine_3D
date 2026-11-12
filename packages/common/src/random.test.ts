import { describe, expect, test } from 'vitest';
import { Azar } from './azar';

describe('Azar con semilla', () => {
  test('la misma semilla da la misma secuencia; otra semilla, otra', () => {
    const a = new Azar(42);
    const b = new Azar(42);
    const c = new Azar(43);
    const sa = Array.from({ length: 100 }, () => a.entero());
    const sb = Array.from({ length: 100 }, () => b.entero());
    const sc = Array.from({ length: 100 }, () => c.entero());
    expect(sb).toEqual(sa);
    expect(sc).not.toEqual(sa);
  });

  test('semillas vecinas (1, 2, 3) dan secuencias que no se parecen', () => {
    const primeros = [1, 2, 3].map((s) => new Azar(s).siguiente());
    // Si el reparto de la semilla fuera malo, los tres primeros números serían casi iguales.
    expect(Math.abs(primeros[0]! - primeros[1]!)).toBeGreaterThan(0.01);
    expect(Math.abs(primeros[1]! - primeros[2]!)).toBeGreaterThan(0.01);
  });

  test('reparte parejo: 100.000 números en 10 casilleros, cada uno con su 10 % (±0,5 %)', () => {
    const azar = new Azar(7);
    const casilleros = new Array(10).fill(0);
    for (let i = 0; i < 100_000; i++) casilleros[Math.floor(azar.siguiente() * 10)]++;
    for (const c of casilleros) expect(Math.abs(c / 100_000 - 0.1)).toBeLessThan(0.005);
  });

  test('siguiente() siempre en [0, 1); entre() y elegir() respetan sus límites', () => {
    const azar = new Azar(1);
    for (let i = 0; i < 10_000; i++) {
      const x = azar.siguiente();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      const y = azar.entre(-2, 3);
      expect(y).toBeGreaterThanOrEqual(-2);
      expect(y).toBeLessThan(3);
    }
    expect(['a', 'b', 'c']).toContain(azar.elegir(['a', 'b', 'c']));
    expect(() => azar.elegir([])).toThrow();
  });

  test('guardar el estado y restaurarlo repite la secuencia desde ese punto', () => {
    const azar = new Azar(99);
    for (let i = 0; i < 37; i++) azar.entero();
    const foto = azar.estado;
    const despues = Array.from({ length: 20 }, () => azar.entero());
    azar.restaurar(foto);
    expect(Array.from({ length: 20 }, () => azar.entero())).toEqual(despues);
  });
});
