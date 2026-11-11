import { expect, test } from 'vitest';
import { PASO } from './mundo';
import { Reloj } from './reloj';

test('a 60 cuadros por segundo, un paso por cuadro; a 30, dos; a 144, a veces ninguno', () => {
  const contar = (fps: number, segundos: number) => {
    const reloj = new Reloj();
    let pasos = 0;
    for (let i = 0; i < fps * segundos; i++) pasos += reloj.avanzar(1 / fps);
    return pasos;
  };
  // En 10 segundos, siempre 600 pasos (±1 por lo que quedó en el acumulador).
  for (const fps of [30, 60, 144, 75]) expect(Math.abs(contar(fps, 10) - 600)).toBeLessThanOrEqual(1);
});

test('alfa: cuánto del paso siguiente ya pasó (para dibujar a mitad de camino)', () => {
  const reloj = new Reloj();
  expect(reloj.avanzar(PASO * 2.25)).toBe(2);
  expect(reloj.alfa).toBeCloseTo(0.25, 9);
});

test('una pausa larga no hace correr cientos de pasos de golpe', () => {
  const reloj = new Reloj();
  expect(reloj.avanzar(10)).toBe(5);
  expect(reloj.alfa).toBe(0);
});
