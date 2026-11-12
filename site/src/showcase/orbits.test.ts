import { describe, expect, it } from 'vitest';
import { ORBITAS_INICIALES, RADIO_CENTRO, RADIO_LAMINA, avanzar, crearOrbita, energia } from './orbitas';

describe('las órbitas de la vitrina', () => {
  // Diez minutos de vitrina abierta, a 60 pasos por segundo.
  const PASOS = 10 * 60 * 60;

  it.each(ORBITAS_INICIALES)('la de r = $r no se escapa de la lámina ni toca el centro', ({ r, factor, fase }) => {
    const o = crearOrbita(r, factor, fase);
    let cerca = Infinity;
    let lejos = 0;
    for (let i = 0; i < PASOS; i++) {
      avanzar(o);
      const d = Math.hypot(o.x, o.z);
      cerca = Math.min(cerca, d);
      lejos = Math.max(lejos, d);
    }
    expect(cerca).toBeGreaterThan(RADIO_CENTRO + 0.15);
    expect(lejos).toBeLessThan(RADIO_LAMINA);
  });

  it.each(ORBITAS_INICIALES)('la de r = $r conserva la energía (oscila, pero no se va)', ({ r, factor, fase }) => {
    const o = crearOrbita(r, factor, fase);
    const inicial = energia(o);
    let peor = 0;
    for (let i = 0; i < PASOS; i++) {
      avanzar(o);
      peor = Math.max(peor, Math.abs((energia(o) - inicial) / inicial));
    }
    // Medido: 0,46 % la que más se acerca al centro (allí el paso es más grueso respecto de la
    // curva). Con Euler explícito, en cambio, crece sin parar y las órbitas se abren.
    expect(peor).toBeLessThan(0.01);
  });
});
