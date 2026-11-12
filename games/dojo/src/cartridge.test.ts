import { expect, test } from 'vitest';
import { quat } from '@manifold/comun';
import { huella, Partida, PASO, registroDe } from '@manifold/nucleo';
import { CartuchoDojo } from './cartucho';
import { RECETAS } from './recetas';

/** Un registro del Dojo con una receta aplicada (como la de un enlace o una sala). */
function registroCon(receta = '') {
  const registro = registroDe(CartuchoDojo);
  const errores = registro.ejecutar(receta, 'receta').filter((m) => m.nivel === 'error');
  expect(errores).toEqual([]);
  return registro;
}

test('el Dojo pone un cubo que gira a |ω| rad/s, igual en dos partidas con la misma semilla', () => {
  const a = new Partida(CartuchoDojo);
  const b = new Partida(CartuchoDojo);
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

test('dojo.cubos (de arranque) agrega cubos del azar del mundo; misma semilla, mismos cubos', () => {
  const a = new Partida(CartuchoDojo, { registro: registroCon('semilla 7; dojo.cubos 10') });
  const b = new Partida(CartuchoDojo, { registro: registroCon('semilla 7; dojo.cubos 10') });
  const c = new Partida(CartuchoDojo, { registro: registroCon('semilla 8; dojo.cubos 10') });
  expect(a.mundo.entidades.size).toBe(11);
  expect(huella(b.mundo)).toBe(huella(a.mundo));
  expect(huella(c.mundo)).not.toBe(huella(a.mundo));
  // Un valor que no sirve no cambia nada (y avisa): solo el cubo de siempre.
  const registro = registroDe(CartuchoDojo);
  expect(registro.ejecutar('dojo.cubos muchos', 'receta')[0]?.nivel).toBe('error');
  expect(new Partida(CartuchoDojo, { registro }).mundo.entidades.size).toBe(1);
});

test('un cambio del MUNDO entra en el paso siguiente, queda en la historia, y es determinista', () => {
  const jugar = () => {
    const partida = new Partida(CartuchoDojo, { registro: registroCon('dojo.cubos 3') });
    const huellas: number[] = [];
    for (let i = 1; i <= 120; i++) {
      if (i === 30) partida.registro.ejecutar('dojo.giro 0 3 0');
      if (i === 60) partida.registro.ejecutar('dojo.crear 0 2 0');
      partida.paso();
      huellas.push(huella(partida.mundo));
    }
    return { partida, huellas };
  };
  const a = jugar();
  const b = jugar();
  // Lo escrito antes del paso 30 entra AL EMPEZAR el paso 30 (no "a mitad" de otro).
  expect(a.partida.historial).toEqual([
    { paso: 30, linea: 'dojo.giro 0 3 0' },
    { paso: 60, linea: 'dojo.crear 0 2 0' },
  ]);
  expect(a.partida.mundo.entidades.get(1)!.giro!.velocidadAngular).toEqual([0, 3, 0]);
  expect(a.partida.mundo.entidades.size).toBe(5);
  // Los mismos cambios en los mismos pasos: la misma huella, paso por paso.
  expect(b.huellas).toEqual(a.huellas);
  // Y el cambio sí cambia el mundo: sin él, otra huella desde el paso 30.
  const sinCambios = new Partida(CartuchoDojo, { registro: registroCon('dojo.cubos 3') });
  for (let i = 1; i <= 30; i++) sinCambios.paso();
  expect(huella(sinCambios.mundo)).not.toBe(a.huellas[29]);
});

test('lo del mundo que viene en una receta es parte de cómo nace el mundo (paso 0)', () => {
  const partida = new Partida(CartuchoDojo, { registro: registroCon('dojo.giro 1 0 0') });
  expect(partida.mundo.entidades.get(1)!.giro!.velocidadAngular).toEqual([1, 0, 0]);
  expect(partida.historial).toEqual([]); // no es un cambio: así nació
});

test('una receta no puede crear cubos (dojo.crear es una acción, no un ajuste)', () => {
  const registro = registroDe(CartuchoDojo);
  const mensajes = registro.ejecutar('dojo.crear 0 2 0', 'receta');
  expect(mensajes[0]?.texto).toContain('no se puede usar en una receta');
});

test('cada sala guardada del Dojo se carga sin errores, y tiene título', () => {
  expect(Object.keys(RECETAS).length).toBeGreaterThan(0);
  for (const [nombre, receta] of Object.entries(RECETAS)) {
    expect(receta.titulo, nombre).toBeTruthy();
    const registro = registroDe(CartuchoDojo);
    // Lo de la vista lo declara la presentación: aquí solo importa lo del juego y el motor.
    const errores = registro
      .ejecutar(receta.texto, 'receta')
      .filter((m) => m.nivel === 'error' && !/no existe "(ver|vista)\./.test(m.texto));
    expect(errores, nombre).toEqual([]);
  }
});
