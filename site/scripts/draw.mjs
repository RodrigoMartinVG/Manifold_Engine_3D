/**
 * THE SITE'S DRAWINGS, made with code: exact, reproducible geometry, with no images copied from
 * anywhere. It writes SVG files in `src/assets/drawings/` (and the tab icon in `public/`). They are
 * kept in the repository; if you change something here, run it again:
 *
 *   npm run draw -w site
 *
 * - background.svg: the background's constructions (compass, golden spiral, astrolabe, an orbit)
 *   and TRUE formulas of the project. It is used as a mask: its color is set by the CSS, so it works
 *   for dark mode and for light mode. (Its text is the site's, in Spanish: "1,618", "acumulador".)
 * - logo.svg and favicon.svg: a gear with a lemniscate (∞) inside.
 * - gear-20.svg and gear-12.svg: two gears that really MESH (same module: the CSS turns them with
 *   speeds in a 12 : 20 ratio).
 * - rust.svg and patina.svg: repeating textures, for the old metal of frames and buttons.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const f = (n) => +n.toFixed(2);
const rad = (degrees) => (degrees * Math.PI) / 180;
const point = (cx, cy, r, degrees) => [cx + r * Math.cos(rad(degrees)), cy + r * Math.sin(rad(degrees))];

// ---------------------------------------------------------------- primitives
const circle = (cx, cy, r, extra = '') => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}"${extra}/>`;
const line = (x1, y1, x2, y2, extra = '') => `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"${extra}/>`;
const path = (points, close = false, extra = '') =>
  `<path d="M${points.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}${close ? 'Z' : ''}"${extra}/>`;
/** A circular arc, from `a0` to `a1` degrees (on screen, angles grow clockwise). */
function arc(cx, cy, r, a0, a1, extra = '') {
  const [x0, y0] = point(cx, cy, r, a0);
  const [x1, y1] = point(cx, cy, r, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  const sweep = a1 > a0 ? 1 : 0;
  return `<path d="M${f(x0)} ${f(y0)}A${f(r)} ${f(r)} 0 ${large} ${sweep} ${f(x1)} ${f(y1)}"${extra}/>`;
}
const text = (x, y, t, { size = 19, rot = 0, anchor = 'start', opacity = 1 } = {}) =>
  `<text x="${f(x)}" y="${f(y)}" font-size="${size}"${anchor !== 'start' ? ` text-anchor="${anchor}"` : ''}${
    rot ? ` transform="rotate(${rot} ${f(x)} ${f(y)})"` : ''
  }${opacity !== 1 ? ` fill-opacity="${opacity}"` : ''}>${t}</text>`;
/** An arrow: the segment and a head at the end. */
function arrow(x1, y1, x2, y2, extra = '') {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const p = (d) => [x2 - 11 * Math.cos(a + d), y2 - 11 * Math.sin(a + d)];
  return line(x1, y1, x2, y2, extra) + path([p(0.4), [x2, y2], p(-0.4)], false, extra);
}
/** A cross with a circle: the mark of a construction point. */
const mark = (x, y) => circle(x, y, 5) + line(x - 9, y, x + 9, y) + line(x, y - 9, x, y + 9);

/**
 * A gear of `teeth` teeth and module `m`: its pitch radius is m·teeth/2 (two gears of the same
 * module mesh if their centers are the sum of those radii apart). Each tooth is a trapezoid: it
 * rises `m` above the pitch radius and drops 1.25·m below it. The first tooth points toward +x.
 */
function gearOutline(teeth, m, cx = 0, cy = 0) {
  const pitch = (m * teeth) / 2;
  const outer = pitch + m;
  const root = pitch - 1.25 * m;
  const step = 360 / teeth;
  const points = [];
  for (let i = 0; i < teeth; i++) {
    const c = i * step;
    points.push(
      point(cx, cy, root, c - step * 0.5),
      point(cx, cy, root, c - step * 0.27),
      point(cx, cy, outer, c - step * 0.14),
      point(cx, cy, outer, c + step * 0.14),
      point(cx, cy, root, c + step * 0.27),
    );
  }
  return { d: `M${points.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`, pitch, outer, root };
}

/** A circle as a subpath (to cut holes with fill-rule="evenodd"). */
const circleAsPath = (cx, cy, r) =>
  `M${f(cx + r)} ${f(cy)}A${f(r)} ${f(r)} 0 1 0 ${f(cx - r)} ${f(cy)}A${f(r)} ${f(r)} 0 1 0 ${f(cx + r)} ${f(cy)}Z`;

// ---------------------------------------------------------------- the background
function background() {
  const strokes = []; // thin lines
  const faint = []; // construction lines, softer
  const letters = []; // the formulas

  // --- A. The golden rectangle and its spiral (top left) -----------------------------------
  // Fibonacci squares (13, 8, 5, 3, 2, 1, 1) inside a 21 × 13 rectangle: each cut leaves a similar
  // rectangle, and a quarter circle per square makes the spiral.
  {
    const u = 17;
    let [x, y, w, h] = [70, 70, 21 * u, 13 * u];
    faint.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`);
    // The spiral's pole is where the rectangle's diagonal and the first remainder's cross.
    faint.push(line(x, y + h, x + w, y, ' stroke-dasharray="6 7"'));
    faint.push(line(x + h, y, x + w, y + h, ' stroke-dasharray="6 7"'));
    const spiral = [];
    for (let i = 0, d = 0; i < 7; i++, d = (d + 1) % 4) {
      const s = d % 2 === 0 ? h : w;
      const [qx, qy] = d === 0 ? [x, y] : d === 1 ? [x, y] : d === 2 ? [x + w - s, y] : [x, y + h - s];
      faint.push(`<rect x="${f(qx)}" y="${f(qy)}" width="${f(s)}" height="${f(s)}"/>`);
      if (s >= 3 * u) letters.push(text(qx + s / 2, qy + s / 2 + 6, String(s / u), { size: 15, anchor: 'middle', opacity: 0.7 }));
      const [cx, cy, a0] =
        d === 0 ? [x + s, y + s, 180] : d === 1 ? [x, y + s, 270] : d === 2 ? [x + w - s, y, 0] : [x + s, y + h - s, 90];
      spiral.push(arc(cx, cy, s, a0, a0 + 90));
      if (d === 0) [x, w] = [x + s, w - s];
      else if (d === 1) [y, h] = [y + s, h - s];
      else if (d === 2) w -= s;
      else h -= s;
    }
    strokes.push(`<g stroke-width="1.6">${spiral.join('')}</g>`);
    letters.push(text(70, 70 + 13 * u + 38, 'φ = (1 + √5) / 2 ≈ 1,618', { size: 21 }));
    letters.push(text(70 + 21 * u, 70 + 13 * u + 38, '21 : 13', { size: 16, anchor: 'end', opacity: 0.7 }));
  }

  // --- B. An astrolabe (top right) ----------------------------------------------------------
  {
    const [cx, cy, R] = [1360, 250, 190];
    strokes.push(circle(cx, cy, R), circle(cx, cy, R - 12), circle(cx, cy, 150), circle(cx, cy, 14));
    for (let g = 0; g < 360; g += 5) {
      const length = g % 30 === 0 ? 22 : g % 10 === 0 ? 10 : 6;
      const [x1, y1] = point(cx, cy, R - 12, g);
      const [x2, y2] = point(cx, cy, R - 12 + length * (g % 30 === 0 ? 1.55 : 1), g);
      (g % 30 === 0 ? strokes : faint).push(line(x1, y1, x2, y2));
      if (g % 30 === 0) {
        const [tx, ty] = point(cx, cy, R + 24, g);
        letters.push(text(tx, ty + 6, String((g + 90) % 360), { size: 14, anchor: 'middle', opacity: 0.75 }));
      }
    }
    // The almucantars: eccentric circles that shrink toward the zenith.
    for (let k = 1; k <= 5; k++) faint.push(circle(cx, cy - 13 * k, 150 - 24 * k));
    faint.push(circle(cx, cy + 38, 112, ' stroke-dasharray="3 6"')); // the ecliptic, off center
    faint.push(line(cx - R, cy, cx + R, cy), line(cx, cy - R, cx, cy + R));
    // The alidade (the rule that turns) and the angle it marks.
    const [ax, ay] = point(cx, cy, R + 8, -35);
    const [bx, by] = point(cx, cy, R + 8, 145);
    strokes.push(line(bx, by, ax, ay, ' stroke-width="2"'));
    strokes.push(arc(cx, cy, 58, -35, 0));
    letters.push(text(cx + 66, cy - 14, 'θ', { size: 20 }));
  }

  // --- C. An orbit: an ellipse with the central body at a focus (top center) ---------------
  {
    const [cx, cy, a, b, turn] = [790, 215, 230, 118, -10];
    const c = Math.sqrt(a * a - b * b);
    const ellipse = [];
    for (let i = 0; i <= 120; i++) {
      const t = (i / 120) * 2 * Math.PI;
      ellipse.push([a * Math.cos(t), b * Math.sin(t)]);
    }
    const rotate = ([x, y]) => [
      cx + x * Math.cos(rad(turn)) - y * Math.sin(rad(turn)),
      cy + x * Math.sin(rad(turn)) + y * Math.cos(rad(turn)),
    ];
    strokes.push(path(ellipse.map(rotate), true));
    faint.push(path([rotate([-a - 30, 0]), rotate([a + 30, 0])], false, ' stroke-dasharray="6 7"'));
    const [fx, fy] = rotate([c, 0]);
    const [gx, gy] = rotate([-c, 0]);
    strokes.push(circle(fx, fy, 9), circle(fx, fy, 3));
    faint.push(circle(gx, gy, 3));
    const t = rad(118);
    const [px, py] = rotate([a * Math.cos(t), b * Math.sin(t)]);
    strokes.push(circle(px, py, 5));
    faint.push(line(fx, fy, px, py, ' stroke-dasharray="4 5"'));
    strokes.push(arrow(px, py, px + (fx - px) * 0.3, py + (fy - py) * 0.3, ' stroke-width="1.6"'));
    letters.push(text((fx + px) / 2 + 6, (fy + py) / 2 - 12, 'r', { size: 20 }));
    letters.push(text(fx + 14, fy + 30, 'M', { size: 17, opacity: 0.8 }));
    letters.push(text(cx - 40, cy + b + 62, 'g = −GM r̂ / r²', { size: 22 }));
    letters.push(text(cx + 210, cy + b + 30, 'Φ = −GM / r', { size: 18, opacity: 0.8 }));
  }

  // --- D. A throw with a fixed step (bottom left) --------------------------------------------
  // The exact parabola, dotted, and the points semi-implicit Euler gives with a fixed Δt: they end
  // up a little below. That distance is the step's error.
  {
    const [x0, y0, vx, vy0, g, dt] = [90, 905, 433, 1000, 1667, 0.1];
    const exact = [];
    for (let i = 0; i <= 60; i++) {
      const t = (i / 60) * 1.2;
      exact.push([x0 + vx * t, y0 - (vy0 * t - (g * t * t) / 2)]);
    }
    faint.push(path(exact, false, ' stroke-dasharray="5 6"'));
    faint.push(line(x0 - 20, y0, x0 + 560, y0));
    const points = [[x0, y0]];
    for (let y = 0, v = vy0, x = x0; ;) {
      v -= g * dt;
      y += v * dt;
      x += vx * dt;
      if (y < 0) break;
      points.push([x, y0 - y]);
    }
    strokes.push(path(points, false, ' stroke-width="1.2"'));
    for (const [x, y] of points) {
      strokes.push(circle(x, y, 4));
      faint.push(line(x, y + 6, x, y0, ' stroke-dasharray="2 5"'), line(x, y0, x, y0 + 8));
    }
    const [p1, p2] = [points[1], points[2]];
    faint.push(line(p1[0], y0 + 22, p2[0], y0 + 22), line(p1[0], y0 + 16, p1[0], y0 + 28), line(p2[0], y0 + 16, p2[0], y0 + 28));
    letters.push(text((p1[0] + p2[0]) / 2, y0 + 50, 'Δt', { size: 18, anchor: 'middle' }));
    strokes.push(arrow(points[0][0], points[0][1], points[0][0] + 40, points[0][1] - 92, ' stroke-width="1.6"'));
    letters.push(text(points[0][0] + 20, points[0][1] - 104, 'v₀', { size: 19 }));
    letters.push(text(392, 610, 'vₙ₊₁ = vₙ + g Δt', { size: 20 }));
    letters.push(text(392, 642, 'xₙ₊₁ = xₙ + vₙ₊₁ Δt', { size: 20 }));
  }

  // --- E. The compass: two equal circles and the equilateral triangle (bottom center) -------
  {
    const [ax, bx, cy, r] = [720, 880, 800, 160];
    const tall = Math.sqrt(r * r - ((bx - ax) / 2) ** 2);
    const m = (ax + bx) / 2;
    faint.push(circle(ax, cy, r), circle(bx, cy, r));
    strokes.push(
      path(
        [
          [ax, cy],
          [bx, cy],
          [m, cy - tall],
        ],
        true,
      ),
    );
    faint.push(line(m, cy - tall - 70, m, cy + tall + 40, ' stroke-dasharray="6 7"'));
    strokes.push(mark(m, cy - tall), mark(m, cy + tall), circle(ax, cy, 3), circle(bx, cy, 3));
    // The compass's short marks, where the crossing was looked for.
    strokes.push(arc(ax, cy, r, -72, -48, ' stroke-width="1.6"'), arc(bx, cy, r, 228, 252, ' stroke-width="1.6"'));
    letters.push(text(m, cy + tall + 74, '(u, v) ∼ (u + 2π, −v)', { size: 19, anchor: 'middle' }));
  }

  // --- F. A turn in space: the sphere, an axis and the angle (bottom right) -----------------
  {
    const [cx, cy, r] = [1300, 760, 118];
    strokes.push(circle(cx, cy, r));
    faint.push(`<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="32"/>`);
    faint.push(`<ellipse cx="${cx}" cy="${cy}" rx="44" ry="${r}" transform="rotate(22 ${cx} ${cy})"/>`);
    const [ex, ey] = [Math.sin(rad(22)), -Math.cos(rad(22))];
    strokes.push(arrow(cx - ex * 150, cy - ey * 150, cx + ex * 175, cy + ey * 175, ' stroke-width="1.6"'));
    // The angle θ around the axis: a small arc near the tip.
    const [tx, ty] = [cx + ex * 128, cy + ey * 128];
    strokes.push(
      `<ellipse cx="${f(tx)}" cy="${f(ty)}" rx="30" ry="9" transform="rotate(22 ${f(tx)} ${f(ty)})" stroke-dasharray="40 14"/>`,
    );
    letters.push(text(tx + 36, ty + 4, 'θ', { size: 20 }));
    letters.push(text(cx - 240, cy + r + 62, 'q = cos θ⁄2 + sin θ⁄2 (x i + y j + z k)', { size: 20 }));
    letters.push(text(cx - 240, cy + r + 92, 'v′ = q v q*     i² = j² = k² = ijk = −1', { size: 18, opacity: 0.85 }));
  }

  // --- G. More of the engine's formulas, loose -------------------------------------------------
  letters.push(text(80, 470, 'α = acumulador / Δt', { size: 19 }));
  letters.push(text(80, 500, 'x = x₀ + (x₁ − x₀) · α', { size: 19, opacity: 0.85 }));
  letters.push(text(80, 530, 'Δt = 1/60 s', { size: 17, opacity: 0.7 }));
  letters.push(text(1085, 520, 'h ← (h ⊕ b) · 16777619', { size: 19 }));
  letters.push(text(1085, 550, 'sₙ₊₁ = (1664525 sₙ + 1013904223) mod 2³²', { size: 16, opacity: 0.8 }));
  letters.push(text(1085, 580, '‖q‖ = 1', { size: 17, opacity: 0.7 }));

  // --- H. Long construction lines, and a ruler at the bottom -----------------------------------
  faint.push(line(0, 655, 1600, 405, ' stroke-dasharray="2 9"'));
  faint.push(line(560, 0, 1040, 1000, ' stroke-dasharray="2 9"'));
  strokes.push(mark(1153, 475), mark(272, 610));
  for (let x = 60; x <= 1540; x += 10) {
    const length = x % 100 === 60 ? 14 : x % 50 === 10 ? 9 : 5;
    faint.push(line(x, 992, x, 992 - length));
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000">
<!-- Made by site/scripts/draw.mjs: used as a mask (its color is set by the CSS). -->
<g fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round">
<g stroke-width="1.1" stroke-opacity="0.85">${strokes.join('')}</g>
<g stroke-width="0.9" stroke-opacity="0.5">${faint.join('')}</g>
</g>
<g fill="#000" font-family="'Iowan Old Style','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif" font-style="italic">${letters.join('')}</g>
</svg>
`;
}

// ---------------------------------------------------------------- the rusted metal
/*
 * The site's metal is OLD bronze: matte, with crusts of green patina and rust stains. The noise
 * comes from `feTurbulence` (Perlin noise, computed by the browser when drawing the SVG) and
 * `feColorMatrix` turns it into stains: one of the noise's channels becomes transparency, with a
 * threshold (there is a stain only where the noise goes over some value). `stitchTiles` makes the
 * texture join with itself, to repeat it like a tile.
 */

/** Reddish rust stains and a fine, dark pitting: it goes on top of the bronze gradient. */
function rustTexture() {
  const side = 220;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}" viewBox="0 0 ${side} ${side}">
<!-- Made by site/scripts/draw.mjs: rust and pitting, to repeat as a texture. -->
<filter id="f" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
<feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="3" seed="7" stitchTiles="stitch" result="stains"/>
<feColorMatrix in="stains" type="matrix" values="0 0 0 0 0.36 0 0 0 0 0.17 0 0 0 0 0.08 3.2 0 0 0 -1.95" result="rust"/>
<feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" seed="3" stitchTiles="stitch" result="grain"/>
<feColorMatrix in="grain" type="matrix" values="0 0 0 0 0.06 0 0 0 0 0.04 0 0 0 0 0.02 0 2.4 0 0 -1.2" result="pits"/>
<feMerge><feMergeNode in="rust"/><feMergeNode in="pits"/></feMerge>
</filter>
<rect width="${side}" height="${side}" filter="url(#f)"/>
</svg>
`;
}

/** Crusts of patina (old copper's green), in big stains and some small ones. */
function patinaTexture() {
  const side = 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}" viewBox="0 0 ${side} ${side}">
<!-- Made by site/scripts/draw.mjs: patina, to repeat as a texture. -->
<filter id="f" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
<feTurbulence type="fractalNoise" baseFrequency="0.014" numOctaves="5" seed="11" stitchTiles="stitch" result="crusts"/>
<feColorMatrix in="crusts" type="matrix" values="0 0 0 0 0.27 0 0 0 0 0.5 0 0 0 0 0.43 0 5 0 0 -3.05" result="patina"/>
<feTurbulence type="fractalNoise" baseFrequency="0.11" numOctaves="2" seed="5" stitchTiles="stitch" result="specks"/>
<feColorMatrix in="specks" type="matrix" values="0 0 0 0 0.42 0 0 0 0 0.62 0 0 0 0 0.54 0 0 7 0 -5.1" result="light"/>
<feMerge><feMergeNode in="patina"/><feMergeNode in="light"/></feMerge>
</filter>
<rect width="${side}" height="${side}" filter="url(#f)"/>
</svg>
`;
}

/**
 * The same rust and the same patina, as a filter inside a shape (the logo, the gears): the stains
 * are cut with the shape (`operator="in"`) and laid on top.
 */
const rustedFilter = (
  scale,
) => `<filter id="rusted" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
<feTurbulence type="fractalNoise" baseFrequency="${f(0.09 * scale)}" numOctaves="3" seed="4" result="n1"/>
<feColorMatrix in="n1" type="matrix" values="0 0 0 0 0.28 0 0 0 0 0.52 0 0 0 0 0.44 0 5.5 0 0 -3.1" result="p"/>
<feComposite in="p" in2="SourceGraphic" operator="in" result="patina"/>
<feTurbulence type="fractalNoise" baseFrequency="${f(0.5 * scale)}" numOctaves="2" seed="9" result="n2"/>
<feColorMatrix in="n2" type="matrix" values="0 0 0 0 0.36 0 0 0 0 0.14 0 0 0 0 0.05 4 0 0 0 -2.2" result="o"/>
<feComposite in="o" in2="SourceGraphic" operator="in" result="rust"/>
<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="rust"/><feMergeNode in="patina"/></feMerge>
</filter>`;

// ---------------------------------------------------------------- the logo
/** A bronze gear with a Bernoulli lemniscate (∞) inside, on a patina disc. */
function siteLogo() {
  const gear = gearOutline(16, 5.2, 0, 0);
  const lemniscate = [];
  for (let i = 0; i <= 160; i++) {
    const t = (i / 160) * 2 * Math.PI;
    const s = 1 + Math.sin(t) ** 2;
    lemniscate.push([(26 * Math.cos(t)) / s, (26 * Math.sin(t) * Math.cos(t)) / s]);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -50 100 100">
<!-- Made by site/scripts/draw.mjs -->
<defs>
<linearGradient id="bronze" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#a07a4c"/><stop offset="0.4" stop-color="#6e4f2e"/><stop offset="0.7" stop-color="#4a331d"/><stop offset="1" stop-color="#7a5a36"/>
</linearGradient>
<radialGradient id="patina" cx="0.4" cy="0.35" r="0.75">
<stop offset="0" stop-color="#2c6658"/><stop offset="1" stop-color="#0d2420"/>
</radialGradient>
${rustedFilter(1)}
</defs>
<path fill="url(#bronze)" fill-rule="evenodd" stroke="#24170a" stroke-width="1.2" filter="url(#rusted)" d="${gear.d}${circleAsPath(0, 0, 34)}"/>
<circle r="34" fill="url(#patina)" stroke="#24170a" stroke-width="1.2"/>
<circle r="29.5" fill="none" stroke="#a88a5c" stroke-opacity="0.4" stroke-width="0.8"/>
${path(lemniscate, true, ' fill="none" stroke="#c9a46a" stroke-width="5" stroke-linejoin="round"')}
</svg>
`;
}

// ---------------------------------------------------------------- the home page's gears
function gearWithSpokes(teeth, m, spokes) {
  const g = gearOutline(teeth, m);
  const edge = g.outer + 2;
  const rim = g.root - m * 1.4; // the rim's inner edge
  const hub = Math.max(m * 1.2, rim * 0.3); // the axle's hub
  const inner = hub + m * 0.6; // where the holes begin
  // The holes between spokes: ring sectors, cut out of the disc.
  const holes = [];
  const width = 360 / spokes;
  for (let i = 0; i < spokes; i++) {
    const a0 = i * width + width * 0.16;
    const a1 = (i + 1) * width - width * 0.16;
    const [x0, y0] = point(0, 0, rim, a0);
    const [x1, y1] = point(0, 0, rim, a1);
    const [x2, y2] = point(0, 0, inner, a1);
    const [x3, y3] = point(0, 0, inner, a0);
    holes.push(
      `M${f(x0)} ${f(y0)}A${f(rim)} ${f(rim)} 0 0 1 ${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}A${f(inner)} ${f(inner)} 0 0 0 ${f(x3)} ${f(y3)}Z`,
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-edge} ${-edge} ${2 * edge} ${2 * edge}">
<!-- Made by site/scripts/draw.mjs: ${teeth} teeth, module ${m} (pitch radius ${g.pitch}). -->
<defs>
<linearGradient id="b" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#8a6a42"/><stop offset="0.45" stop-color="#5a3f24"/><stop offset="0.7" stop-color="#3b2815"/><stop offset="1" stop-color="#6a4d2c"/>
</linearGradient>
${rustedFilter(1)}
</defs>
<path fill="url(#b)" fill-rule="evenodd" stroke="#1f1408" stroke-width="0.8" filter="url(#rusted)" d="${g.d}${holes.join('')}${circleAsPath(0, 0, m * 0.9)}"/>
<circle r="${f(rim)}" fill="none" stroke="#a88a5c" stroke-opacity="0.25" stroke-width="0.6"/>
<circle r="${f(hub)}" fill="none" stroke="#2a1909" stroke-opacity="0.6" stroke-width="0.8"/>
</svg>
`;
}

// ---------------------------------------------------------------- writing
const drawings = `${root}src/assets/drawings/`;
mkdirSync(drawings, { recursive: true });
const write = (file, content) => {
  writeFileSync(file, content);
  console.log(`  ${file.slice(root.length)} (${(content.length / 1024).toFixed(1)} KB)`);
};
console.log('Drawings:');
write(`${drawings}background.svg`, background());
write(`${drawings}logo.svg`, siteLogo());
write(`${root}public/favicon.svg`, siteLogo());
// Same module (4): pitch radii 40 and 24, so they mesh with their centers 64 units apart.
write(`${drawings}gear-20.svg`, gearWithSpokes(20, 4, 5));
write(`${drawings}rust.svg`, rustTexture());
write(`${drawings}patina.svg`, patinaTexture());
write(`${drawings}gear-12.svg`, gearWithSpokes(12, 4, 4));
