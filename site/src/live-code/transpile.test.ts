import { describe, expect, test } from 'vitest';
import { importedLibraries, moduleName, rewriteImports, transpile } from './transpile';

describe('transpile', () => {
  test('removes the types and leaves the rest, with the same lines', () => {
    const ts = [
      'const a: number = 1;',
      'function double(x: number): number {',
      '  return x * 2;',
      '}',
      'console.log(double(a));',
    ].join('\n');
    const js = transpile(ts);
    expect(js).not.toMatch(/: number/);
    expect(js.split('\n')).toHaveLength(5);
    expect(js.split('\n')[4]).toContain('console.log(double(a))');
  });

  test('removes type-only imports (they do not exist in JavaScript)', () => {
    const js = transpile(
      "import type { Mesh } from 'three';\nimport { Vector3 } from 'three';\nlet m: Mesh | null = null;\nnew Vector3();",
    );
    expect(js).not.toMatch(/Mesh/);
    expect(js).toMatch(/import \{ Vector3 \} from 'three'/);
  });

  test("imports between the lesson's files become lesson/...; library imports do not", () => {
    expect(rewriteImports("import { a } from './view';")).toBe("import { a } from 'lesson/view';");
    expect(rewriteImports('import { a } from "./view.ts";')).toBe('import { a } from "lesson/view";');
    expect(rewriteImports("export * from './util/random';")).toBe("export * from 'lesson/util/random';");
    expect(rewriteImports("import './effects';")).toBe("import 'lesson/effects';");
    expect(rewriteImports("const m = await import('./view');")).toBe("const m = await import('lesson/view');");
    expect(rewriteImports("import * as THREE from 'three';")).toBe("import * as THREE from 'three';");
    expect(rewriteImports("import x from '../outside';")).toBe("import x from '../outside';");
  });

  test("each file's name in the import map", () => {
    expect(moduleName('main.ts')).toBe('lesson/main');
    expect(moduleName('simulation.ts')).toBe('lesson/simulation');
  });

  test('the libraries a lesson imports: only those are fetched (not its own files)', () => {
    const js = transpile(
      [
        "import * as THREE from 'three';",
        "import GUI from 'three/addons/libs/lil-gui.module.min.js';",
        "import RAPIER from '@dimforge/rapier3d-deterministic-compat';",
        "import { createScene } from './scene';",
        "const later = await import('three');",
        // (Used: an import that is never used is removed with the types, as TypeScript does.)
        'console.log(THREE, GUI, RAPIER, createScene, later);',
      ].join('\n'),
    );
    expect(importedLibraries(js)).toEqual([
      '@dimforge/rapier3d-deterministic-compat',
      'three',
      'three/addons/libs/lil-gui.module.min.js',
    ]);
    expect(importedLibraries(transpile("import { a } from './view';"))).toEqual([]);
  });
});
