import { transform } from 'sucrase';

/**
 * From TypeScript to JavaScript, in the browser (decision 0007).
 *
 * The browser does not understand TypeScript. Sucrase REMOVES the types (it does not check them:
 * the compiler does that in the repository, and continuous integration) and leaves everything else
 * in place, even the line numbers: an error on line 12 in the browser is line 12 of the editor.
 */

/** How a lesson's files are named in the import map: `lesson/main`, `lesson/view`... */
export const LESSON_PREFIX = 'lesson/';

export function moduleName(file: string): string {
  return LESSON_PREFIX + file.replace(/\.(ts|js)$/, '');
}

/**
 * Imports between a lesson's files (`./view`, `./view.ts`) are renamed `lesson/view`: in the
 * iframe every file is a loose module (a `blob:`), and a `blob:` has no folder to resolve `./`
 * against. With a fixed name, the import map finds it.
 */
export function rewriteImports(js: string): string {
  return js.replace(
    /(\bfrom\s*|\bimport\s*\(?\s*)(['"])\.\/([\w\-/]+?)(?:\.ts|\.js)?\2/g,
    (_, before: string, quote: string, name: string) => `${before}${quote}${LESSON_PREFIX}${name}${quote}`,
  );
}

/**
 * The libraries a lesson's code imports (stage 1f): `three`, `three/addons/…`, the physics engine…
 * Not its own files (`lesson/…`). Only those are fetched: Rapier weighs 4 MB, and the lessons that do
 * not use it should not wait for it.
 */
export function importedLibraries(js: string): string[] {
  const found = new Set<string>();
  for (const m of js.matchAll(/\b(?:from|import)\s*\(?\s*(['"])([^'"]+)\1/g)) {
    const specifier = m[2]!;
    if (!specifier.startsWith('.') && !specifier.startsWith('/') && !specifier.startsWith(LESSON_PREFIX)) found.add(specifier);
  }
  return [...found].sort();
}

export function transpile(code: string): string {
  const { code: js } = transform(code, { transforms: ['typescript'], disableESTransforms: true });
  return rewriteImports(js);
}
