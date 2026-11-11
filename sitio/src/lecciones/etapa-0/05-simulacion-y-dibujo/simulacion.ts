/**
 * LA SIMULACIÓN: pelotas que rebotan en una caja. Solo DATOS y cuentas: no importa Three.js,
 * no sabe que existe una pantalla. Por eso puede correr sin dibujar (más rápido que el tiempo
 * real, para probar o para un servidor) y dar siempre lo mismo con la misma semilla.
 */

export const PASO = 1 / 60; // segundos por paso: siempre el mismo
const G = 9.81;
export const MEDIO_ANCHO = 3; // la caja va de −3 a 3 en X y en Z

export interface Pelota {
  posicion: [number, number, number];
  velocidad: [number, number, number];
  radio: number;
}

export interface Mundo {
  pelotas: Pelota[];
  pasos: number;
}

export function crearMundo(semilla: number, cantidad: number): Mundo {
  let estado = semilla >>> 0;
  const azar = () => (estado = (Math.imul(estado, 1664525) + 1013904223) >>> 0) / 4294967296;
  const pelotas: Pelota[] = [];
  for (let i = 0; i < cantidad; i++) {
    const radio = 0.12 + azar() * 0.2;
    pelotas.push({
      posicion: [(azar() - 0.5) * 4, 1 + azar() * 3, (azar() - 0.5) * 4],
      velocidad: [(azar() - 0.5) * 6, 0, (azar() - 0.5) * 6],
      radio,
    });
  }
  return { pelotas, pasos: 0 };
}

/** Un paso: la gravedad, el movimiento y los rebotes (contra el piso y las paredes). */
export function avanzar(mundo: Mundo) {
  for (const p of mundo.pelotas) {
    p.velocidad[1] -= G * PASO;
    for (let eje = 0; eje < 3; eje++) p.posicion[eje]! += p.velocidad[eje]! * PASO;
    if (p.posicion[1] < p.radio) {
      p.posicion[1] = p.radio;
      p.velocidad[1] = Math.abs(p.velocidad[1]) * 0.92; // pierde un poco en cada rebote
    }
    for (const eje of [0, 2]) {
      const limite = MEDIO_ANCHO - p.radio;
      if (Math.abs(p.posicion[eje]!) > limite) {
        p.posicion[eje] = Math.sign(p.posicion[eje]!) * limite;
        p.velocidad[eje] = -p.velocidad[eje]!;
      }
    }
  }
  mundo.pasos++;
}

/** Un resumen del mundo (para comparar dos mundos sin mirar cada número). */
export function resumen(mundo: Mundo): string {
  let suma = 0;
  for (const p of mundo.pelotas) suma += p.posicion[0] + 3 * p.posicion[1] + 7 * p.posicion[2];
  return suma.toFixed(9);
}
