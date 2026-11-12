import { describe, expect, test } from 'vitest';
import { nombreDeModulo, reescribirImportaciones, transpilar } from './transpilar';

describe('transpilar', () => {
  test('saca los tipos y deja el resto, con las mismas líneas', () => {
    const ts = [
      'const a: number = 1;',
      'function doble(x: number): number {',
      '  return x * 2;',
      '}',
      'console.log(doble(a));',
    ].join('\n');
    const js = transpilar(ts);
    expect(js).not.toMatch(/: number/);
    expect(js.split('\n')).toHaveLength(5);
    expect(js.split('\n')[4]).toContain('console.log(doble(a))');
  });

  test('borra las importaciones que solo son de tipos (no existen en JavaScript)', () => {
    const js = transpilar(
      "import type { Mesh } from 'three';\nimport { Vector3 } from 'three';\nlet m: Mesh | null = null;\nnew Vector3();",
    );
    expect(js).not.toMatch(/Mesh/);
    expect(js).toMatch(/import \{ Vector3 \} from 'three'/);
  });

  test('las importaciones entre archivos de la lección pasan a leccion/...; las de librerías, no', () => {
    expect(reescribirImportaciones("import { a } from './vista';")).toBe("import { a } from 'leccion/vista';");
    expect(reescribirImportaciones('import { a } from "./vista.ts";')).toBe('import { a } from "leccion/vista";');
    expect(reescribirImportaciones("export * from './util/azar';")).toBe("export * from 'leccion/util/azar';");
    expect(reescribirImportaciones("import './efectos';")).toBe("import 'leccion/efectos';");
    expect(reescribirImportaciones("const m = await import('./vista');")).toBe("const m = await import('leccion/vista');");
    expect(reescribirImportaciones("import * as THREE from 'three';")).toBe("import * as THREE from 'three';");
    expect(reescribirImportaciones("import x from '../afuera';")).toBe("import x from '../afuera';");
  });

  test('el nombre de cada archivo en el mapa de importaciones', () => {
    expect(nombreDeModulo('main.ts')).toBe('leccion/main');
    expect(nombreDeModulo('simulacion.ts')).toBe('leccion/simulacion');
  });
});
