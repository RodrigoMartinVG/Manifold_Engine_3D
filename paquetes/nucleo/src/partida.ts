import { Registro } from '@manifold/comandos';
import type { Cartucho } from './cartucho';
import { Mundo } from './mundo';

export interface OpcionesPartida {
  /**
   * Las variables y los comandos (decisión 0010), con las recetas ya aplicadas. Si no se da, uno
   * nuevo con lo que declaran el motor y el cartucho, todo en sus valores por defecto.
   */
  registro?: Registro<Mundo>;
  /** Para las pruebas: la semilla, sin pasar por el registro. */
  semilla?: number;
}

/** Un cambio del mundo que entró en la partida, y en qué paso: la base de una repetición. */
export interface CambioDelMundo {
  paso: number;
  linea: string;
}

/** Un registro con lo que declaran el motor y el cartucho (sin la presentación ni la consola). */
export function registroDe(cartucho: Cartucho): Registro<Mundo> {
  const registro = new Registro<Mundo>();
  declararNucleo(registro);
  cartucho.alDeclarar?.(registro);
  return registro;
}

/** Lo que declara el núcleo, para todos los juegos (cada juego decide si lo deja tocar). */
export function declararNucleo(registro: Registro<Mundo>) {
  registro.declararVariable({
    nombre: 'semilla',
    descripcion: { es: 'La semilla del azar del mundo: con la misma semilla, el mismo mundo.' },
    alcance: 'arranque',
    tipo: { tipo: 'entero', min: 0, max: 4294967295 },
    porDefecto: 1,
  });
}

/**
 * UNA PARTIDA: un mundo y el cartucho que lo juega. Es lo único que llama al cartucho, en
 * momentos fijos: al empezar, y después de cada paso, con los eventos de ese paso. Corre sin
 * pantalla: la usan la presentación, las pruebas y (más adelante) el servidor.
 *
 * También es el CANAL DE LOS CAMBIOS DEL MUNDO (decisión 0010): un cambio que llega de la
 * consola (o, más adelante, de la red) no toca el mundo enseguida. Se programa, y se aplica al
 * empezar el paso siguiente, siempre en el mismo orden, y queda en `historial` con su paso. Así
 * dos partidas que reciben los mismos cambios en los mismos pasos hacen exactamente lo mismo.
 */
export class Partida {
  readonly mundo: Mundo;
  readonly registro: Registro<Mundo>;
  /** Cada cambio del mundo que entró, con el paso en que se aplicó. */
  readonly historial: CambioDelMundo[] = [];
  private programados: { linea: string; aplicar: (mundo: Mundo) => void }[] = [];

  constructor(
    readonly cartucho: Cartucho,
    o: OpcionesPartida = {},
  ) {
    this.registro = o.registro ?? registroDe(cartucho);
    this.mundo = new Mundo({ semilla: o.semilla ?? Number(this.registro.valor('semilla')) });
    cartucho.alIniciar(this.mundo, this.registro);
    // Lo del mundo que ya venía cambiado (de una receta) es parte de cómo nace: paso 0.
    this.registro.aplicarAlMundo(this.mundo);
    // Desde ahora, los cambios del mundo pasan por aquí (si había otra partida con este registro, deja de recibirlos).
    this.registro.programador = (linea, aplicar) => this.programados.push({ linea, aplicar });
  }

  paso() {
    const paso = this.mundo.tick + 1;
    const programados = this.programados;
    this.programados = [];
    for (const p of programados) {
      p.aplicar(this.mundo);
      this.historial.push({ paso, linea: p.linea });
    }
    this.mundo.paso();
    this.cartucho.alAvanzar?.(this.mundo, this.mundo.eventosDelPaso);
  }
}
