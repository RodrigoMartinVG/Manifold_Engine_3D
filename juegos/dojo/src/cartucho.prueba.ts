import { expect, test } from 'vitest';
import { quat } from '@manifold/comun';
import { huella, Partida, PASO } from '@manifold/nucleo';
import { CartuchoDojo } from './cartucho';

test('el Dojo pone un cubo que gira a |ω| rad/s, igual en dos partidas con la misma semilla', () => {
  const a = new Partida(CartuchoDojo, { semilla: 1 });
  const b = new Partida(CartuchoDojo, { semilla: 1 });
  expect(a.mundo.entidades.size).toBe(1);
  for (let i = 0; i < 300; i++) {
    a.paso();
    b.paso();
  }
  expect(huella(b.mundo)).toBe(huella(a.mundo));
  const cubo = [...a.mundo.entidades.values()][0]!;
  // Girado: |ω|·t (5 s a 0,99 rad/s = 4,95 rad). `anguloEntre` da el camino más corto (de 0 a π).
  const girado = (Math.hypot(0.35, 0.9, 0.15) * 300 * PASO) % (2 * Math.PI);
  const masCorto = Math.min(girado, 2 * Math.PI - girado);
  expect(quat.anguloEntre(quat.identidad(), cubo.transformacion!.rotacion)).toBeCloseTo(masCorto, 9);
});

test('reto: ?cubos=N agrega N cubos del azar del mundo; misma semilla, mismos cubos', () => {
  const opciones = new Map([['cubos', '10']]);
  const a = new Partida(CartuchoDojo, { semilla: 7, opciones });
  const b = new Partida(CartuchoDojo, { semilla: 7, opciones });
  const c = new Partida(CartuchoDojo, { semilla: 8, opciones });
  expect(a.mundo.entidades.size).toBe(11);
  expect(huella(b.mundo)).toBe(huella(a.mundo));
  expect(huella(c.mundo)).not.toBe(huella(a.mundo));
  // Un valor que no es un número no rompe nada: solo el cubo de siempre.
  expect(new Partida(CartuchoDojo, { semilla: 1, opciones: new Map([['cubos', 'muchos']]) }).mundo.entidades.size).toBe(1);
});
