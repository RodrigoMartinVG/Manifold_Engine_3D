import { describe, expect, it } from 'vitest';
import { recetaDelEnlace, recetaParaEnlace, tituloDeReceta } from './recetas';

describe('las recetas en un enlace', () => {
  it('se leen a mano: ";" entre líneas y "+" por los espacios; sin los comentarios', () => {
    const receta = '# Mi sala\ndojo.cubos 20\n\n# Lo que se ve\nver.triangulos si\n';
    expect(recetaParaEnlace(receta)).toBe('dojo.cubos+20;ver.triangulos+si');
  });

  it('van y vuelven sin perder nada (un "+" de verdad, comillas, tildes)', () => {
    const receta = 'dojo.nombre "uno + uno"\nayuda física';
    const enlace = `#receta=${recetaParaEnlace(receta)}`;
    expect(enlace).not.toMatch(/\s/);
    expect(recetaDelEnlace(enlace)).toBe(receta);
  });

  it('un fragmento que no es una receta da null; un escape roto no rompe nada', () => {
    expect(recetaDelEnlace('#otra-cosa')).toBeNull();
    expect(recetaDelEnlace('')).toBeNull();
    expect(recetaDelEnlace('#receta=dojo.cubos+%E0;ver.ejes+si')).toBe('dojo.cubos %E0\nver.ejes si');
  });

  it('el título de una receta es su primer comentario', () => {
    expect(tituloDeReceta('\n# Lluvia de cubos\ndojo.cubos 100')).toBe('Lluvia de cubos');
    expect(tituloDeReceta('dojo.cubos 100')).toBeNull();
  });
});
