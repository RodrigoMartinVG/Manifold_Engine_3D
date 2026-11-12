import { transform } from 'sucrase';

/**
 * De TypeScript a JavaScript, en el navegador (decisión 0007).
 *
 * El navegador no entiende TypeScript. Sucrase le SACA los tipos (no los revisa: eso lo hace el
 * compilador en el repositorio, y la integración continua) y deja todo lo demás en su lugar,
 * incluso los números de línea: un error en la línea 12 del navegador es la línea 12 del editor.
 */

/** Cómo se llaman los archivos de una lección en el mapa de importaciones: `leccion/main`, `leccion/vista`... */
export const PREFIJO = 'leccion/';

export function nombreDeModulo(archivo: string): string {
  return PREFIJO + archivo.replace(/\.(ts|js)$/, '');
}

/**
 * Las importaciones entre archivos de la lección (`./vista`, `./vista.ts`) pasan a llamarse
 * `leccion/vista`: en el iframe cada archivo es un módulo suelto (un `blob:`), y un `blob:` no
 * tiene carpeta contra la cual resolver `./`. Con un nombre fijo, el mapa de importaciones lo encuentra.
 */
export function reescribirImportaciones(js: string): string {
  return js.replace(
    /(\bfrom\s*|\bimport\s*\(?\s*)(['"])\.\/([\w\-/]+?)(?:\.ts|\.js)?\2/g,
    (_, antes: string, comilla: string, nombre: string) => `${antes}${comilla}${PREFIJO}${nombre}${comilla}`,
  );
}

export function transpilar(codigo: string): string {
  const { code } = transform(codigo, { transforms: ['typescript'], disableESTransforms: true });
  return reescribirImportaciones(code);
}
