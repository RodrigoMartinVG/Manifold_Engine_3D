import { tituloDeReceta } from '@manifold/comandos';

/**
 * LAS SALAS GUARDADAS DEL DOJO (decisión 0010): recetas en texto plano, en `juegos/dojo/recetas/`.
 * Cada una tiene su propia dirección en el sitio (`…/jugar/dojo/lluvia/`), se carga desde la
 * consola (`cargar lluvia`) y las pruebas la corren sin pantalla. Agregar una sala es agregar un
 * archivo: nada más que mantener.
 */
const archivos = import.meta.glob<string>('../recetas/*.txt', { query: '?raw', import: 'default', eager: true });

export interface RecetaGuardada {
  /** Su primer comentario: "Lluvia de cubos". */
  titulo: string;
  texto: string;
}

/** Por nombre (el del archivo, sin `.txt`). */
export const RECETAS: Readonly<Record<string, RecetaGuardada>> = Object.fromEntries(
  Object.entries(archivos)
    .map(([ruta, texto]) => [ruta.replace(/^.*\/([^/]+)\.txt$/, '$1'), { titulo: tituloDeReceta(texto) ?? '', texto }] as const)
    .sort(([a], [b]) => a.localeCompare(b)),
);
