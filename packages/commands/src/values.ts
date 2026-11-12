import type { Type, Value, Vec3 } from './types';

/**
 * READING AND WRITING VALUES. A line is split into "words" (with quotes for texts with spaces),
 * and every argument takes the ones it needs: a number, one; a vector, three.
 */

/** A word of the line, and where it starts (for the `rest` type, which takes what is left as is). */
export interface Word {
  text: string;
  start: number;
}

/** Splits a line into words. Quotes keep a text with spaces together: `"hello world"`. */
export function tokenize(line: string): Word[] {
  const words: Word[] = [];
  let i = 0;
  while (i < line.length) {
    while (i < line.length && /\s/.test(line[i]!)) i++;
    if (i >= line.length) break;
    const start = i;
    if (line[i] === '"') {
      const close = line.indexOf('"', i + 1);
      const end = close === -1 ? line.length : close;
      words.push({ text: line.slice(i + 1, end), start });
      i = end + 1;
    } else {
      while (i < line.length && !/\s/.test(line[i]!)) i++;
      words.push({ text: line.slice(start, i), start });
    }
  }
  return words;
}

/**
 * Splits a text into command lines: by line break and by `;`, without the comments (`#` to the
 * end of the line). What is inside quotes is not cut.
 */
export function splitLines(text: string): string[] {
  const lines: string[] = [];
  for (const row of text.split(/\r?\n/)) {
    let current = '';
    let inQuotes = false;
    for (const c of row) {
      if (c === '"') inQuotes = !inQuotes;
      if (!inQuotes && c === '#') break;
      if (!inQuotes && c === ';') {
        lines.push(current);
        current = '';
      } else current += c;
    }
    lines.push(current);
  }
  return lines.map((l) => l.trim()).filter((l) => l !== '');
}

const NUMBER = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i;
const WITH_COMMA = /^[-+]?\d+,\d+$/;
const ON = ['on', '1', 'true', 'yes'];
const OFF = ['off', '0', 'false', 'no'];

/** How many words a type uses (`rest`, all that are left). */
export const wordsUsed = (t: Type) => (t.kind === 'vector' ? 3 : 1);

export type Parsed = { ok: true; value: Value } | { ok: false; error: string };

/** Reads a value of its type from its words. The error says what was expected. */
export function parseValue(t: Type, words: readonly string[]): Parsed {
  const number = (text: string, integer: boolean): number | string => {
    if (WITH_COMMA.test(text)) return `decimals use a point (${text.replace(',', '.')}), not a comma`;
    if (!NUMBER.test(text) || (integer && !/^[-+]?\d+$/.test(text))) return `expected ${describeType(t)}, got "${text}"`;
    return Number(text);
  };
  switch (t.kind) {
    case 'number':
    case 'integer': {
      const n = number(words[0] ?? '', t.kind === 'integer');
      if (typeof n === 'string') return { ok: false, error: n };
      if ((t.min !== undefined && n < t.min) || (t.max !== undefined && n > t.max))
        return { ok: false, error: `expected ${describeType(t)}, got ${n}` };
      return { ok: true, value: n };
    }
    case 'boolean': {
      const w = (words[0] ?? '').toLowerCase();
      if (ON.includes(w)) return { ok: true, value: true };
      if (OFF.includes(w)) return { ok: true, value: false };
      return { ok: false, error: `expected on or off, got "${words[0] ?? ''}"` };
    }
    case 'vector': {
      if (words.length < 3) return { ok: false, error: 'expected a vector: three numbers (x y z)' };
      const v: number[] = [];
      for (const w of words.slice(0, 3)) {
        const n = number(w, false);
        if (typeof n === 'string') return { ok: false, error: n };
        v.push(n);
      }
      return { ok: true, value: v as Vec3 };
    }
    case 'option': {
      const w = (words[0] ?? '').toLowerCase();
      if (t.options.includes(w)) return { ok: true, value: w };
      return { ok: false, error: `expected one of: ${t.options.join(', ')}; got "${words[0] ?? ''}"` };
    }
    case 'text':
    case 'rest':
      return { ok: true, value: words.join(' ') };
  }
}

/** Writes a value the way it is typed in the console (and kept in a recipe). */
export function formatValue(v: Value): string {
  if (typeof v === 'boolean') return v ? 'on' : 'off';
  if (Array.isArray(v)) return v.join(' ');
  if (typeof v === 'string') return /\s/.test(v) || v === '' ? `"${v}"` : v;
  return String(v);
}

export function sameValue(a: Value, b: Value): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.every((x, i) => x === b[i]);
  return a === b;
}

/** "an integer from 0 to 200", for the help and the errors. */
export function describeType(t: Type): string {
  const range = (min?: number, max?: number) =>
    min !== undefined && max !== undefined
      ? ` from ${min} to ${max}`
      : min !== undefined
        ? ` from ${min}`
        : max !== undefined
          ? ` up to ${max}`
          : '';
  switch (t.kind) {
    case 'number':
      return `a number${range(t.min, t.max)}`;
    case 'integer':
      return `an integer${range(t.min, t.max)}`;
    case 'boolean':
      return 'on or off';
    case 'vector':
      return 'three numbers (x y z)';
    case 'text':
      return 'a text';
    case 'option':
      return `one of: ${t.options.join(', ')}`;
    case 'rest':
      return 'the rest of the line';
  }
}
