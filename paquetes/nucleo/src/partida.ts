import type { Cartucho } from './cartucho';
import { Mundo } from './mundo';

export interface OpcionesPartida {
  semilla: number;
  /** Los parámetros de la dirección (`?sala=...`): el cartucho decide cuáles entiende. */
  opciones?: ReadonlyMap<string, string>;
}

/**
 * UNA PARTIDA: un mundo y el cartucho que lo juega. Es lo único que llama al cartucho, en
 * momentos fijos: al empezar, y después de cada paso, con los eventos de ese paso. Corre sin
 * pantalla: la usan la presentación, las pruebas y (más adelante) el servidor.
 */
export class Partida {
  readonly mundo: Mundo;

  constructor(
    readonly cartucho: Cartucho,
    o: OpcionesPartida,
  ) {
    this.mundo = new Mundo({ semilla: o.semilla });
    cartucho.alIniciar(this.mundo, o.opciones ?? new Map());
  }

  paso() {
    this.mundo.paso();
    this.cartucho.alAvanzar?.(this.mundo, this.mundo.eventosDelPaso);
  }
}
