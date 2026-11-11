import { quat } from '@manifold/comun';
import type { Cartucho } from '@manifold/nucleo';

/**
 * EL CARTUCHO DEL DOJO (fase 0): un cubo que gira. Parece poco, y prueba lo importante:
 * que un juego, desde AFUERA del motor, pone cosas en un mundo que la simulación hace andar
 * y la presentación dibuja.
 *
 * Las reglas del Dojo no tocan la pantalla (este archivo corre igual en las pruebas): lo que
 * se ve lo decide `index.ts`.
 */
export const CartuchoDojo: Cartucho = {
  id: 'dojo',
  titulo: 'Dojo',
  alIniciar(mundo, opciones) {
    mundo.crearEntidad({
      transformacion: { posicion: [0, 1, 0], rotacion: quat.identidad() },
      // Un eje inclinado: así se ve que gira en 3D, no solo "da vueltas".
      giro: { velocidadAngular: [0.35, 0.9, 0.15] },
      apariencia: { forma: 'caja', tamano: [1, 1, 1], color: 0xe0a040 },
    });
    // Reto del capítulo 0: `?cubos=N`, más cubos, todos sacados del AZAR DEL MUNDO (no de
    // Math.random): con la misma `?semilla=`, siempre los mismos, en el mismo lugar.
    const cubos = Math.min(200, Math.max(0, Math.floor(Number(opciones.get('cubos') ?? 0)) || 0));
    for (let i = 0; i < cubos; i++) {
      const a = mundo.azar;
      const lado = a.entre(0.2, 0.6);
      mundo.crearEntidad({
        transformacion: { posicion: [a.entre(-6, 6), a.entre(0.5, 4), a.entre(-6, 6)], rotacion: quat.identidad() },
        giro: { velocidadAngular: [a.entre(-2, 2), a.entre(-2, 2), a.entre(-2, 2)] },
        apariencia: { forma: 'caja', tamano: [lado, lado, lado], color: Math.floor(a.entre(0.25, 1) * 0xffffff) & 0xf0f0f0 },
      });
    }
  },
};
