import { quat } from '@manifold/comun';
import type { Vec3 } from '@manifold/comandos';
import type { Cartucho, Mundo } from '@manifold/nucleo';

/** El giro del cubo grande al empezar (un eje inclinado: así se ve que gira en 3D, no solo "da vueltas"). */
const GIRO_INICIAL: Vec3 = [0.35, 0.9, 0.15];

/** Un cubo chico con lugar, tamaño, giro y color sacados del AZAR DEL MUNDO (no de Math.random). */
function cuboAlAzar(mundo: Mundo, posicion?: Vec3) {
  const a = mundo.azar;
  const lado = a.entre(0.2, 0.6);
  const lugar: Vec3 = posicion ?? [a.entre(-6, 6), a.entre(0.5, 4), a.entre(-6, 6)];
  mundo.crearEntidad({
    transformacion: { posicion: lugar, rotacion: quat.identidad() },
    giro: { velocidadAngular: [a.entre(-2, 2), a.entre(-2, 2), a.entre(-2, 2)] },
    apariencia: { forma: 'caja', tamano: [lado, lado, lado], color: Math.floor(a.entre(0.25, 1) * 0xffffff) & 0xf0f0f0 },
  });
}

/**
 * EL CARTUCHO DEL DOJO: el primer juego, el laboratorio del motor. Por ahora, un cubo que gira y
 * cubos chicos al azar. Parece poco, y prueba lo importante: que un juego, desde AFUERA del
 * motor, pone cosas en un mundo que la simulación hace andar y la presentación dibuja.
 *
 * Lo que el Dojo deja cambiar lo DECLARA (decisión 0010), con un alcance cada cosa:
 * - `dojo.cubos` es de ARRANQUE: cuántos cubos hay al nacer el mundo (cambiarlo lo reinicia);
 * - `dojo.giro` es del MUNDO: el giro del cubo grande, que cambia en un paso concreto;
 * - `dojo.crear x y z` es una acción del MUNDO: un cubo nuevo, en un paso concreto.
 *
 * Las reglas del Dojo no tocan la pantalla (este archivo corre igual en las pruebas): lo que se
 * ve lo decide `index.ts`.
 */
export const CartuchoDojo: Cartucho = {
  id: 'dojo',
  titulo: 'Dojo',

  alDeclarar(registro) {
    registro.declararVariable({
      nombre: 'dojo.cubos',
      descripcion: {
        es: 'Cubos chicos al empezar, en lugares sacados del azar del mundo: con la misma semilla, siempre los mismos.',
      },
      alcance: 'arranque',
      tipo: { tipo: 'entero', min: 0, max: 200 },
      porDefecto: 0,
    });
    registro.declararVariable({
      nombre: 'dojo.giro',
      descripcion: { es: 'Cómo gira el cubo grande: radianes por segundo alrededor de cada eje (x y z).' },
      alcance: 'mundo',
      tipo: { tipo: 'vector' },
      porDefecto: GIRO_INICIAL,
      alMundo(mundo, valor) {
        // El cubo grande es la primera entidad del mundo (id 1): la crea `alIniciar`, antes que nada.
        const cubo = mundo.entidades.get(1);
        if (cubo?.giro) cubo.giro.velocidadAngular = [...(valor as Vec3)];
      },
    });
    registro.declararComando({
      nombre: 'dojo.crear',
      descripcion: { es: 'Crea un cubo chico en (x, y, z), con tamaño, giro y color sacados del azar del mundo.' },
      argumentos: [{ nombre: 'lugar', tipo: { tipo: 'vector' } }],
      alMundo(mundo, [lugar]) {
        cuboAlAzar(mundo, lugar as Vec3);
      },
    });
  },

  alIniciar(mundo, registro) {
    mundo.crearEntidad({
      transformacion: { posicion: [0, 1, 0], rotacion: quat.identidad() },
      giro: { velocidadAngular: [...GIRO_INICIAL] },
      apariencia: { forma: 'caja', tamano: [1, 1, 1], color: 0xe0a040 },
    });
    const cubos = Number(registro.valor('dojo.cubos'));
    for (let i = 0; i < cubos; i++) cuboAlAzar(mundo);
  },
};
