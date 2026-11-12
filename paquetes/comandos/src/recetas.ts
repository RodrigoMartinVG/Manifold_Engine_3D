import { separarLineas } from './valores';

/**
 * LAS RECETAS EN UN ENLACE (decisión 0010). Una receta es texto plano: una línea por comando,
 * con comentarios (`#`). En un enlace va después de `#receta=`: las líneas se separan con `;` y
 * los espacios se escriben `+`, así el enlace se lee y se corrige a mano. Lo demás se escapa como
 * en cualquier dirección (un `+` de verdad queda como `%2B`).
 *
 *   dojo.cubos 20            →   #receta=dojo.cubos+20;ver.triangulos+si
 *   ver.triangulos si
 *
 * Va en el FRAGMENTO (`#`), que no viaja al servidor: no hace falta ninguno que lo entienda.
 */
export const PREFIJO_DEL_ENLACE = 'receta=';

/** La receta para un enlace: sin comentarios ni líneas vacías. */
export function recetaParaEnlace(texto: string): string {
  return separarLineas(texto)
    .map((linea) => encodeURIComponent(linea).replace(/%20/g, '+'))
    .join(';');
}

/** De vuelta a texto, una línea por comando. Si el fragmento no trae una receta, null. */
export function recetaDelEnlace(fragmento: string): string | null {
  const sinNumeral = fragmento.replace(/^#/, '');
  if (!sinNumeral.startsWith(PREFIJO_DEL_ENLACE)) return null;
  return sinNumeral
    .slice(PREFIJO_DEL_ENLACE.length)
    .split(';')
    .map((parte) => {
      const conEspacios = parte.replace(/\+/g, ' ');
      try {
        return decodeURIComponent(conEspacios);
      } catch {
        return conEspacios; // un escape roto: la línea se intenta igual, y si no se entiende, se avisa
      }
    })
    .filter((linea) => linea.trim() !== '')
    .join('\n');
}

/** El título de una receta: su primer comentario (`# Lluvia de cubos`). */
export function tituloDeReceta(texto: string): string | null {
  const primero = texto.split(/\r?\n/).find((l) => l.trim() !== '');
  return primero?.trim().startsWith('#') ? primero.trim().replace(/^#\s*/, '') : null;
}
