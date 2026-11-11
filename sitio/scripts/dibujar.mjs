/**
 * LOS DIBUJOS DEL SITIO, hechos con código: geometría exacta y reproducible, sin imágenes
 * copiadas de ningún lado. Escribe archivos SVG en `src/assets/dibujos/` (y el ícono de la
 * pestaña en `public/`). Se guardan en el repositorio; si cambias algo aquí, vuelve a correrlo:
 *
 *   npm run dibujar -w sitio
 *
 * - fondo.svg: las construcciones del fondo (compás, espiral áurea, astrolabio, una órbita) y
 *   fórmulas VERDADERAS del proyecto. Se usa como máscara: su color lo pone el CSS, así sirve
 *   para el modo oscuro y para el claro.
 * - marca.svg y favicon.svg: un engranaje con una lemniscata (∞) adentro.
 * - engranaje-20.svg y engranaje-12.svg: dos engranajes que ENGRANAN de verdad (mismo módulo:
 *   el CSS los gira con velocidades en razón 12 : 20).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const f = (n) => +n.toFixed(2);
const rad = (g) => (g * Math.PI) / 180;
const punto = (cx, cy, r, grados) => [cx + r * Math.cos(rad(grados)), cy + r * Math.sin(rad(grados))];

// ---------------------------------------------------------------- primitivas
const circulo = (cx, cy, r, extra = '') => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}"${extra}/>`;
const linea = (x1, y1, x2, y2, extra = '') => `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"${extra}/>`;
const camino = (puntos, cerrar = false, extra = '') =>
  `<path d="M${puntos.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}${cerrar ? 'Z' : ''}"${extra}/>`;
/** Un arco de circunferencia, de `a0` a `a1` grados (en la pantalla, los ángulos crecen en sentido horario). */
function arco(cx, cy, r, a0, a1, extra = '') {
  const [x0, y0] = punto(cx, cy, r, a0);
  const [x1, y1] = punto(cx, cy, r, a1);
  const grande = Math.abs(a1 - a0) > 180 ? 1 : 0;
  const sentido = a1 > a0 ? 1 : 0;
  return `<path d="M${f(x0)} ${f(y0)}A${f(r)} ${f(r)} 0 ${grande} ${sentido} ${f(x1)} ${f(y1)}"${extra}/>`;
}
const texto = (x, y, t, { tam = 19, rot = 0, ancla = 'start', opacidad = 1 } = {}) =>
  `<text x="${f(x)}" y="${f(y)}" font-size="${tam}"${ancla !== 'start' ? ` text-anchor="${ancla}"` : ''}${
    rot ? ` transform="rotate(${rot} ${f(x)} ${f(y)})"` : ''
  }${opacidad !== 1 ? ` fill-opacity="${opacidad}"` : ''}>${t}</text>`;
/** Una flecha: el segmento y una punta en el extremo. */
function flecha(x1, y1, x2, y2, extra = '') {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const p = (d) => [x2 - 11 * Math.cos(a + d), y2 - 11 * Math.sin(a + d)];
  return linea(x1, y1, x2, y2, extra) + camino([p(0.4), [x2, y2], p(-0.4)], false, extra);
}
/** Una cruz con un círculo: la marca de un punto de construcción. */
const marca = (x, y) => circulo(x, y, 5) + linea(x - 9, y, x + 9, y) + linea(x, y - 9, x, y + 9);

/**
 * Un engranaje de `dientes` dientes y módulo `m`: su radio primitivo es m·dientes/2 (dos
 * engranajes del mismo módulo engranan si sus centros están a la suma de esos radios). Cada
 * diente es un trapecio: sube `m` sobre el radio primitivo y baja 1,25·m por debajo. El primer
 * diente apunta hacia +x.
 */
function contornoDeEngranaje(dientes, m, cx = 0, cy = 0) {
  const primitivo = (m * dientes) / 2;
  const exterior = primitivo + m;
  const pie = primitivo - 1.25 * m;
  const paso = 360 / dientes;
  const puntos = [];
  for (let i = 0; i < dientes; i++) {
    const c = i * paso;
    puntos.push(
      punto(cx, cy, pie, c - paso * 0.5),
      punto(cx, cy, pie, c - paso * 0.27),
      punto(cx, cy, exterior, c - paso * 0.14),
      punto(cx, cy, exterior, c + paso * 0.14),
      punto(cx, cy, pie, c + paso * 0.27),
    );
  }
  return { d: `M${puntos.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`, primitivo, exterior, pie };
}

/** Un círculo como subcamino (para recortar agujeros con fill-rule="evenodd"). */
const circuloComoCamino = (cx, cy, r) =>
  `M${f(cx + r)} ${f(cy)}A${f(r)} ${f(r)} 0 1 0 ${f(cx - r)} ${f(cy)}A${f(r)} ${f(r)} 0 1 0 ${f(cx + r)} ${f(cy)}Z`;

// ---------------------------------------------------------------- el fondo
function fondo() {
  const trazos = []; // líneas finas
  const tenues = []; // líneas de construcción, más suaves
  const letras = []; // las fórmulas

  // --- A. El rectángulo áureo y su espiral (arriba a la izquierda) -------------------------
  // Cuadrados de Fibonacci (13, 8, 5, 3, 2, 1, 1) adentro de un rectángulo de 21 × 13: cada
  // corte deja un rectángulo semejante, y un cuarto de circunferencia por cuadrado forma la espiral.
  {
    const u = 17;
    let [x, y, w, h] = [70, 70, 21 * u, 13 * u];
    tenues.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`);
    // El polo de la espiral está donde se cruzan la diagonal del rectángulo y la del primer resto.
    tenues.push(linea(x, y + h, x + w, y, ' stroke-dasharray="6 7"'));
    tenues.push(linea(x + h, y, x + w, y + h, ' stroke-dasharray="6 7"'));
    const espiral = [];
    for (let i = 0, d = 0; i < 7; i++, d = (d + 1) % 4) {
      const s = d % 2 === 0 ? h : w;
      const [qx, qy] = d === 0 ? [x, y] : d === 1 ? [x, y] : d === 2 ? [x + w - s, y] : [x, y + h - s];
      tenues.push(`<rect x="${f(qx)}" y="${f(qy)}" width="${f(s)}" height="${f(s)}"/>`);
      if (s >= 3 * u) letras.push(texto(qx + s / 2, qy + s / 2 + 6, String(s / u), { tam: 15, ancla: 'middle', opacidad: 0.7 }));
      const [cx, cy, a0] =
        d === 0 ? [x + s, y + s, 180] : d === 1 ? [x, y + s, 270] : d === 2 ? [x + w - s, y, 0] : [x + s, y + h - s, 90];
      espiral.push(arco(cx, cy, s, a0, a0 + 90));
      if (d === 0) [x, w] = [x + s, w - s];
      else if (d === 1) [y, h] = [y + s, h - s];
      else if (d === 2) w -= s;
      else h -= s;
    }
    trazos.push(`<g stroke-width="1.6">${espiral.join('')}</g>`);
    letras.push(texto(70, 70 + 13 * u + 38, 'φ = (1 + √5) / 2 ≈ 1,618', { tam: 21 }));
    letras.push(texto(70 + 21 * u, 70 + 13 * u + 38, '21 : 13', { tam: 16, ancla: 'end', opacidad: 0.7 }));
  }

  // --- B. Un astrolabio (arriba a la derecha) ----------------------------------------------
  {
    const [cx, cy, R] = [1360, 250, 190];
    trazos.push(circulo(cx, cy, R), circulo(cx, cy, R - 12), circulo(cx, cy, 150), circulo(cx, cy, 14));
    for (let g = 0; g < 360; g += 5) {
      const largo = g % 30 === 0 ? 22 : g % 10 === 0 ? 10 : 6;
      const [x1, y1] = punto(cx, cy, R - 12, g);
      const [x2, y2] = punto(cx, cy, R - 12 + largo * (g % 30 === 0 ? 1.55 : 1), g);
      (g % 30 === 0 ? trazos : tenues).push(linea(x1, y1, x2, y2));
      if (g % 30 === 0) {
        const [tx, ty] = punto(cx, cy, R + 24, g);
        letras.push(texto(tx, ty + 6, String((g + 90) % 360), { tam: 14, ancla: 'middle', opacidad: 0.75 }));
      }
    }
    // Los almucantarates: círculos excéntricos que se achican hacia el cénit.
    for (let k = 1; k <= 5; k++) tenues.push(circulo(cx, cy - 13 * k, 150 - 24 * k));
    tenues.push(circulo(cx, cy + 38, 112, ' stroke-dasharray="3 6"')); // la eclíptica, corrida del centro
    tenues.push(linea(cx - R, cy, cx + R, cy), linea(cx, cy - R, cx, cy + R));
    // La alidada (la regla que gira) y el ángulo que marca.
    const [ax, ay] = punto(cx, cy, R + 8, -35);
    const [bx, by] = punto(cx, cy, R + 8, 145);
    trazos.push(linea(bx, by, ax, ay, ' stroke-width="2"'));
    trazos.push(arco(cx, cy, 58, -35, 0));
    letras.push(texto(cx + 66, cy - 14, 'θ', { tam: 20 }));
  }

  // --- C. Una órbita: elipse con el cuerpo central en un foco (arriba al centro) -----------
  {
    const [cx, cy, a, b, giro] = [790, 215, 230, 118, -10];
    const c = Math.sqrt(a * a - b * b);
    const elipse = [];
    for (let i = 0; i <= 120; i++) {
      const t = (i / 120) * 2 * Math.PI;
      elipse.push([a * Math.cos(t), b * Math.sin(t)]);
    }
    const girar = ([x, y]) => [
      cx + x * Math.cos(rad(giro)) - y * Math.sin(rad(giro)),
      cy + x * Math.sin(rad(giro)) + y * Math.cos(rad(giro)),
    ];
    trazos.push(camino(elipse.map(girar), true));
    tenues.push(camino([girar([-a - 30, 0]), girar([a + 30, 0])], false, ' stroke-dasharray="6 7"'));
    const [fx, fy] = girar([c, 0]);
    const [gx, gy] = girar([-c, 0]);
    trazos.push(circulo(fx, fy, 9), circulo(fx, fy, 3));
    tenues.push(circulo(gx, gy, 3));
    const t = rad(118);
    const [px, py] = girar([a * Math.cos(t), b * Math.sin(t)]);
    trazos.push(circulo(px, py, 5));
    tenues.push(linea(fx, fy, px, py, ' stroke-dasharray="4 5"'));
    trazos.push(flecha(px, py, px + (fx - px) * 0.3, py + (fy - py) * 0.3, ' stroke-width="1.6"'));
    letras.push(texto((fx + px) / 2 + 6, (fy + py) / 2 - 12, 'r', { tam: 20 }));
    letras.push(texto(fx + 14, fy + 30, 'M', { tam: 17, opacidad: 0.8 }));
    letras.push(texto(cx - 40, cy + b + 62, 'g = −GM r̂ / r²', { tam: 22 }));
    letras.push(texto(cx + 210, cy + b + 30, 'Φ = −GM / r', { tam: 18, opacidad: 0.8 }));
  }

  // --- D. Un tiro con paso fijo (abajo a la izquierda) --------------------------------------
  // La parábola exacta, punteada, y los puntos que da Euler semi-implícito con Δt fijo: quedan un
  // poco por debajo. Esa distancia es el error del paso.
  {
    const [x0, y0, vx, vy0, g, dt] = [90, 905, 433, 1000, 1667, 0.1];
    const exacta = [];
    for (let i = 0; i <= 60; i++) {
      const t = (i / 60) * 1.2;
      exacta.push([x0 + vx * t, y0 - (vy0 * t - (g * t * t) / 2)]);
    }
    tenues.push(camino(exacta, false, ' stroke-dasharray="5 6"'));
    tenues.push(linea(x0 - 20, y0, x0 + 560, y0));
    const puntos = [[x0, y0]];
    for (let y = 0, v = vy0, x = x0; ;) {
      v -= g * dt;
      y += v * dt;
      x += vx * dt;
      if (y < 0) break;
      puntos.push([x, y0 - y]);
    }
    trazos.push(camino(puntos, false, ' stroke-width="1.2"'));
    for (const [x, y] of puntos) {
      trazos.push(circulo(x, y, 4));
      tenues.push(linea(x, y + 6, x, y0, ' stroke-dasharray="2 5"'), linea(x, y0, x, y0 + 8));
    }
    const [p1, p2] = [puntos[1], puntos[2]];
    tenues.push(
      linea(p1[0], y0 + 22, p2[0], y0 + 22),
      linea(p1[0], y0 + 16, p1[0], y0 + 28),
      linea(p2[0], y0 + 16, p2[0], y0 + 28),
    );
    letras.push(texto((p1[0] + p2[0]) / 2, y0 + 50, 'Δt', { tam: 18, ancla: 'middle' }));
    trazos.push(flecha(puntos[0][0], puntos[0][1], puntos[0][0] + 40, puntos[0][1] - 92, ' stroke-width="1.6"'));
    letras.push(texto(puntos[0][0] + 20, puntos[0][1] - 104, 'v₀', { tam: 19 }));
    letras.push(texto(392, 610, 'vₙ₊₁ = vₙ + g Δt', { tam: 20 }));
    letras.push(texto(392, 642, 'xₙ₊₁ = xₙ + vₙ₊₁ Δt', { tam: 20 }));
  }

  // --- E. El compás: dos circunferencias iguales y el triángulo equilátero (abajo al centro) -
  {
    const [ax, bx, cy, r] = [720, 880, 800, 160];
    const alto = Math.sqrt(r * r - ((bx - ax) / 2) ** 2);
    const m = (ax + bx) / 2;
    tenues.push(circulo(ax, cy, r), circulo(bx, cy, r));
    trazos.push(
      camino(
        [
          [ax, cy],
          [bx, cy],
          [m, cy - alto],
        ],
        true,
      ),
    );
    tenues.push(linea(m, cy - alto - 70, m, cy + alto + 40, ' stroke-dasharray="6 7"'));
    trazos.push(marca(m, cy - alto), marca(m, cy + alto), circulo(ax, cy, 3), circulo(bx, cy, 3));
    // Las marcas cortas del compás, donde se buscó el cruce.
    trazos.push(arco(ax, cy, r, -72, -48, ' stroke-width="1.6"'), arco(bx, cy, r, 228, 252, ' stroke-width="1.6"'));
    letras.push(texto(m, cy + alto + 74, '(u, v) ∼ (u + 2π, −v)', { tam: 19, ancla: 'middle' }));
  }

  // --- F. Un giro en el espacio: la esfera, un eje y el ángulo (abajo a la derecha) ---------
  {
    const [cx, cy, r] = [1300, 760, 118];
    trazos.push(circulo(cx, cy, r));
    tenues.push(`<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="32"/>`);
    tenues.push(`<ellipse cx="${cx}" cy="${cy}" rx="44" ry="${r}" transform="rotate(22 ${cx} ${cy})"/>`);
    const [ex, ey] = [Math.sin(rad(22)), -Math.cos(rad(22))];
    trazos.push(flecha(cx - ex * 150, cy - ey * 150, cx + ex * 175, cy + ey * 175, ' stroke-width="1.6"'));
    // El ángulo θ alrededor del eje: un arco chico cerca de la punta.
    const [tx, ty] = [cx + ex * 128, cy + ey * 128];
    trazos.push(
      `<ellipse cx="${f(tx)}" cy="${f(ty)}" rx="30" ry="9" transform="rotate(22 ${f(tx)} ${f(ty)})" stroke-dasharray="40 14"/>`,
    );
    letras.push(texto(tx + 36, ty + 4, 'θ', { tam: 20 }));
    letras.push(texto(cx - 240, cy + r + 62, 'q = cos θ⁄2 + sin θ⁄2 (x i + y j + z k)', { tam: 20 }));
    letras.push(texto(cx - 240, cy + r + 92, 'v′ = q v q*     i² = j² = k² = ijk = −1', { tam: 18, opacidad: 0.85 }));
  }

  // --- G. Más fórmulas del motor, sueltas ----------------------------------------------------
  letras.push(texto(80, 470, 'α = acumulador / Δt', { tam: 19 }));
  letras.push(texto(80, 500, 'x = x₀ + (x₁ − x₀) · α', { tam: 19, opacidad: 0.85 }));
  letras.push(texto(80, 530, 'Δt = 1/60 s', { tam: 17, opacidad: 0.7 }));
  letras.push(texto(1085, 520, 'h ← (h ⊕ b) · 16777619', { tam: 19 }));
  letras.push(texto(1085, 550, 'sₙ₊₁ = (1664525 sₙ + 1013904223) mod 2³²', { tam: 16, opacidad: 0.8 }));
  letras.push(texto(1085, 580, '‖q‖ = 1', { tam: 17, opacidad: 0.7 }));

  // --- H. Líneas de construcción largas, y una regla abajo -----------------------------------
  tenues.push(linea(0, 655, 1600, 405, ' stroke-dasharray="2 9"'));
  tenues.push(linea(560, 0, 1040, 1000, ' stroke-dasharray="2 9"'));
  trazos.push(marca(1153, 475), marca(272, 610));
  for (let x = 60; x <= 1540; x += 10) {
    const largo = x % 100 === 60 ? 14 : x % 50 === 10 ? 9 : 5;
    tenues.push(linea(x, 992, x, 992 - largo));
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000">
<!-- Generado por sitio/scripts/dibujar.mjs: se usa como máscara (su color lo pone el CSS). -->
<g fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round">
<g stroke-width="1.1" stroke-opacity="0.85">${trazos.join('')}</g>
<g stroke-width="0.9" stroke-opacity="0.5">${tenues.join('')}</g>
</g>
<g fill="#000" font-family="'Iowan Old Style','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif" font-style="italic">${letras.join('')}</g>
</svg>
`;
}

// ---------------------------------------------------------------- la marca
/** Un engranaje de bronce con una lemniscata de Bernoulli (∞) adentro, sobre un disco de pátina. */
function marcaDelSitio() {
  const engranaje = contornoDeEngranaje(16, 5.2, 0, 0);
  const lemniscata = [];
  for (let i = 0; i <= 160; i++) {
    const t = (i / 160) * 2 * Math.PI;
    const s = 1 + Math.sin(t) ** 2;
    lemniscata.push([(26 * Math.cos(t)) / s, (26 * Math.sin(t) * Math.cos(t)) / s]);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -50 100 100">
<!-- Generado por sitio/scripts/dibujar.mjs -->
<defs>
<linearGradient id="bronce" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#f3d39b"/><stop offset="0.35" stop-color="#c38a4a"/><stop offset="0.6" stop-color="#8a5a2b"/><stop offset="1" stop-color="#d7a564"/>
</linearGradient>
<radialGradient id="patina" cx="0.4" cy="0.35" r="0.75">
<stop offset="0" stop-color="#2f7c6e"/><stop offset="1" stop-color="#0f2925"/>
</radialGradient>
</defs>
<path fill="url(#bronce)" fill-rule="evenodd" stroke="#3a2410" stroke-width="1.2" d="${engranaje.d}${circuloComoCamino(0, 0, 34)}"/>
<circle r="34" fill="url(#patina)" stroke="#3a2410" stroke-width="1.2"/>
<circle r="29.5" fill="none" stroke="#e2b77a" stroke-opacity="0.45" stroke-width="0.8"/>
${camino(lemniscata, true, ' fill="none" stroke="#f0d59a" stroke-width="5" stroke-linejoin="round"')}
</svg>
`;
}

// ---------------------------------------------------------------- los engranajes del inicio
function engranajeConRayos(dientes, m, rayos) {
  const e = contornoDeEngranaje(dientes, m);
  const borde = e.exterior + 2;
  const aro = e.pie - m * 1.4; // el borde interno del aro
  const cubo = Math.max(m * 1.2, aro * 0.3); // el cubo del eje
  const interior = cubo + m * 0.6; // donde empiezan los huecos
  // Los huecos entre rayos: sectores de corona, recortados del disco.
  const huecos = [];
  const ancho = 360 / rayos;
  for (let i = 0; i < rayos; i++) {
    const a0 = i * ancho + ancho * 0.16;
    const a1 = (i + 1) * ancho - ancho * 0.16;
    const [x0, y0] = punto(0, 0, aro, a0);
    const [x1, y1] = punto(0, 0, aro, a1);
    const [x2, y2] = punto(0, 0, interior, a1);
    const [x3, y3] = punto(0, 0, interior, a0);
    huecos.push(
      `M${f(x0)} ${f(y0)}A${f(aro)} ${f(aro)} 0 0 1 ${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}A${f(interior)} ${f(interior)} 0 0 0 ${f(x3)} ${f(y3)}Z`,
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-borde} ${-borde} ${2 * borde} ${2 * borde}">
<!-- Generado por sitio/scripts/dibujar.mjs: ${dientes} dientes, módulo ${m} (radio primitivo ${e.primitivo}). -->
<defs>
<linearGradient id="b" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#d9a964"/><stop offset="0.45" stop-color="#8f5e2e"/><stop offset="0.7" stop-color="#5e3c1d"/><stop offset="1" stop-color="#a9763f"/>
</linearGradient>
</defs>
<path fill="url(#b)" fill-rule="evenodd" stroke="#2a1909" stroke-width="0.8" d="${e.d}${huecos.join('')}${circuloComoCamino(0, 0, m * 0.9)}"/>
<circle r="${f(aro)}" fill="none" stroke="#f0d59a" stroke-opacity="0.35" stroke-width="0.6"/>
<circle r="${f(cubo)}" fill="none" stroke="#2a1909" stroke-opacity="0.6" stroke-width="0.8"/>
</svg>
`;
}

// ---------------------------------------------------------------- escribir
const dibujos = `${raiz}src/assets/dibujos/`;
mkdirSync(dibujos, { recursive: true });
const escribir = (ruta, contenido) => {
  writeFileSync(ruta, contenido);
  console.log(`  ${ruta.slice(raiz.length)} (${(contenido.length / 1024).toFixed(1)} KB)`);
};
console.log('Dibujos:');
escribir(`${dibujos}fondo.svg`, fondo());
escribir(`${dibujos}marca.svg`, marcaDelSitio());
escribir(`${raiz}public/favicon.svg`, marcaDelSitio());
// Mismo módulo (4): radios primitivos 40 y 24, así que engranan con los centros a 64 unidades.
escribir(`${dibujos}engranaje-20.svg`, engranajeConRayos(20, 4, 5));
escribir(`${dibujos}engranaje-12.svg`, engranajeConRayos(12, 4, 4));
