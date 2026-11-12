import type { Tipo, Valor, Vec3 } from './tipos';

/**
 * LEER Y ESCRIBIR VALORES. Una línea se parte en "palabras" (con comillas para los textos con
 * espacios), y cada argumento toma las que necesita: un número, una; un vector, tres.
 */

/** Una palabra de la línea, y dónde empieza (para el tipo `resto`, que toma lo que queda tal cual). */
export interface Palabra {
  texto: string;
  inicio: number;
}

/** Parte una línea en palabras. Las comillas juntan un texto con espacios: `"hola mundo"`. */
export function partir(linea: string): Palabra[] {
  const palabras: Palabra[] = [];
  let i = 0;
  while (i < linea.length) {
    while (i < linea.length && /\s/.test(linea[i]!)) i++;
    if (i >= linea.length) break;
    const inicio = i;
    if (linea[i] === '"') {
      const cierre = linea.indexOf('"', i + 1);
      const fin = cierre === -1 ? linea.length : cierre;
      palabras.push({ texto: linea.slice(i + 1, fin), inicio });
      i = fin + 1;
    } else {
      while (i < linea.length && !/\s/.test(linea[i]!)) i++;
      palabras.push({ texto: linea.slice(inicio, i), inicio });
    }
  }
  return palabras;
}

/**
 * Separa un texto en líneas de comando: por renglón y por `;`, sin los comentarios (`#` hasta el
 * final del renglón). Lo que está entre comillas no se corta.
 */
export function separarLineas(texto: string): string[] {
  const lineas: string[] = [];
  for (const renglon of texto.split(/\r?\n/)) {
    let actual = '';
    let entreComillas = false;
    for (const c of renglon) {
      if (c === '"') entreComillas = !entreComillas;
      if (!entreComillas && c === '#') break;
      if (!entreComillas && c === ';') {
        lineas.push(actual);
        actual = '';
      } else actual += c;
    }
    lineas.push(actual);
  }
  return lineas.map((l) => l.trim()).filter((l) => l !== '');
}

const NUMERO = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i;
const CON_COMA = /^[-+]?\d+,\d+$/;

/** Cuántas palabras usa un tipo (el resto, todas las que queden). */
export const palabrasQueUsa = (t: Tipo) => (t.tipo === 'vector' ? 3 : 1);

export type Leido = { ok: true; valor: Valor } | { ok: false; error: string };

/** Lee un valor de su tipo a partir de sus palabras. El error explica qué se esperaba. */
export function leerValor(t: Tipo, palabras: readonly string[]): Leido {
  const numero = (texto: string, entero: boolean): number | string => {
    if (CON_COMA.test(texto)) return `los decimales van con punto (${texto.replace(',', '.')}), no con coma`;
    if (!NUMERO.test(texto) || (entero && !/^[-+]?\d+$/.test(texto))) return `esperaba ${describirTipo(t)}, y llegó "${texto}"`;
    return Number(texto);
  };
  switch (t.tipo) {
    case 'numero':
    case 'entero': {
      const n = numero(palabras[0] ?? '', t.tipo === 'entero');
      if (typeof n === 'string') return { ok: false, error: n };
      if ((t.min !== undefined && n < t.min) || (t.max !== undefined && n > t.max))
        return { ok: false, error: `esperaba ${describirTipo(t)}, y llegó ${n}` };
      return { ok: true, valor: n };
    }
    case 'booleano': {
      const p = (palabras[0] ?? '').toLowerCase();
      if (['si', 'sí', 'yes', '1'].includes(p)) return { ok: true, valor: true };
      if (['no', '0'].includes(p)) return { ok: true, valor: false };
      return { ok: false, error: `esperaba si o no, y llegó "${palabras[0] ?? ''}"` };
    }
    case 'vector': {
      if (palabras.length < 3) return { ok: false, error: 'esperaba un vector: tres números (x y z)' };
      const v: number[] = [];
      for (const p of palabras.slice(0, 3)) {
        const n = numero(p, false);
        if (typeof n === 'string') return { ok: false, error: n };
        v.push(n);
      }
      return { ok: true, valor: v as Vec3 };
    }
    case 'opcion': {
      const p = (palabras[0] ?? '').toLowerCase();
      if (t.opciones.includes(p)) return { ok: true, valor: p };
      return { ok: false, error: `esperaba una de estas: ${t.opciones.join(', ')}; y llegó "${palabras[0] ?? ''}"` };
    }
    case 'texto':
    case 'resto':
      return { ok: true, valor: palabras.join(' ') };
  }
}

/** Escribe un valor como se tipea en la consola (y como queda en una receta). */
export function escribirValor(v: Valor): string {
  if (typeof v === 'boolean') return v ? 'si' : 'no';
  if (Array.isArray(v)) return v.join(' ');
  if (typeof v === 'string') return /\s/.test(v) || v === '' ? `"${v}"` : v;
  return String(v);
}

export function mismoValor(a: Valor, b: Valor): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.every((x, i) => x === b[i]);
  return a === b;
}

/** "un entero de 0 a 200", para la ayuda y los errores. */
export function describirTipo(t: Tipo): string {
  const rango = (min?: number, max?: number) =>
    min !== undefined && max !== undefined
      ? ` de ${min} a ${max}`
      : min !== undefined
        ? ` desde ${min}`
        : max !== undefined
          ? ` hasta ${max}`
          : '';
  switch (t.tipo) {
    case 'numero':
      return `un número${rango(t.min, t.max)}`;
    case 'entero':
      return `un entero${rango(t.min, t.max)}`;
    case 'booleano':
      return 'si o no';
    case 'vector':
      return 'tres números (x y z)';
    case 'texto':
      return 'un texto';
    case 'opcion':
      return `una de estas: ${t.opciones.join(', ')}`;
    case 'resto':
      return 'el resto de la línea';
  }
}
