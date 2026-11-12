/**
 * "¿Quisiste decir…?": el nombre declarado más parecido a uno que no existe.
 *
 * El parecido se mide con la DISTANCIA DE EDICIÓN (de Levenshtein): cuántas letras hay que
 * agregar, quitar o cambiar para pasar de una palabra a la otra. "gravedd" está a 1 de
 * "gravedad". Solo se sugiere si está cerca (a lo sumo un tercio de las letras), y si el nombre
 * escrito es el comienzo de uno solo, ese.
 */
export function parecido(escrito: string, nombres: readonly string[]): string | null {
  const empiezan = nombres.filter((n) => n.startsWith(escrito));
  if (empiezan.length === 1) return empiezan[0]!;
  let mejor: string | null = null;
  let menor = Math.max(1, Math.floor(escrito.length / 3)) + 1;
  for (const n of nombres) {
    // También contra la última parte del nombre: "cubos" se parece a "dojo.cubos".
    const ultima = n.slice(n.lastIndexOf('.') + 1);
    const d = Math.min(distancia(escrito, n), escrito.includes('.') ? Infinity : distancia(escrito, ultima));
    if (d < menor) {
      menor = d;
      mejor = n;
    }
  }
  return mejor;
}

export function distancia(a: string, b: string): number {
  let anterior = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const actual = [i];
    for (let j = 1; j <= b.length; j++) {
      const cambio = a[i - 1] === b[j - 1] ? 0 : 1;
      actual[j] = Math.min(anterior[j]! + 1, actual[j - 1]! + 1, anterior[j - 1]! + cambio);
    }
    anterior = actual;
  }
  return anterior[b.length]!;
}
