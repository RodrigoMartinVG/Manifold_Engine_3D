import { describe, expect, it, vi } from 'vitest';
import { declararAyudas } from './ayudas';
import { Registro } from './registro';
import type { Valor } from './tipos';

/** Un mundo de mentira para las pruebas: solo anota lo que le hacen. */
interface MundoDePrueba {
  hechos: string[];
}

function armar() {
  const r = new Registro<MundoDePrueba>();
  const vista = vi.fn();
  r.declararVariable({
    nombre: 'semilla',
    descripcion: { es: 'La semilla del azar.' },
    alcance: 'arranque',
    tipo: { tipo: 'entero', min: 0 },
    porDefecto: 1,
  });
  r.declararVariable({
    nombre: 'dojo.cubos',
    descripcion: { es: 'Cubos extra.' },
    alcance: 'arranque',
    tipo: { tipo: 'entero', min: 0, max: 200 },
    porDefecto: 0,
  });
  r.declararVariable({
    nombre: 'fisica.gravedad',
    descripcion: { es: 'La gravedad.' },
    alcance: 'mundo',
    tipo: { tipo: 'vector' },
    porDefecto: [0, -9.81, 0],
    alMundo: (m, v) => m.hechos.push(`gravedad ${String(v)}`),
  });
  r.declararVariable({
    nombre: 'ver.ejes',
    descripcion: { es: 'Los ejes.' },
    alcance: 'vista',
    tipo: { tipo: 'booleano' },
    porDefecto: false,
    alCambiar: vista,
  });
  r.declararVariable({
    nombre: 'vista.lento',
    descripcion: { es: 'Más lento.' },
    alcance: 'vista',
    tipo: { tipo: 'numero', min: 0.05, max: 4 },
    porDefecto: 1,
  });
  r.declararVariable({
    nombre: 'vista.calidad',
    descripcion: { es: 'La calidad.' },
    alcance: 'vista',
    tipo: { tipo: 'opcion', opciones: ['baja', 'media', 'alta'] },
    porDefecto: 'media',
  });
  const hecho = vi.fn<(args: Valor[]) => void>();
  r.declararComando({
    nombre: 'paso',
    descripcion: { es: 'Avanza pasos.' },
    argumentos: [{ nombre: 'n', tipo: { tipo: 'entero', min: 1 }, opcional: true }],
    ejecutar: (args) => hecho(args),
  });
  r.declararComando({
    nombre: 'crear',
    descripcion: { es: 'Crea algo en x y z.' },
    argumentos: [{ nombre: 'lugar', tipo: { tipo: 'vector' } }],
    alMundo: (m, [lugar]) => m.hechos.push(`crear ${String(lugar)}`),
  });
  r.declararComando({
    nombre: 'atajo',
    descripcion: { es: 'Un atajo.' },
    argumentos: [
      { nombre: 'tecla', tipo: { tipo: 'texto' } },
      { nombre: 'linea', tipo: { tipo: 'resto' } },
    ],
    ejecutar: (args) => hecho(args),
  });
  return { r, vista, hecho };
}

const textos = (ms: { texto: string }[]) => ms.map((m) => m.texto).join('\n');
const errores = (ms: { nivel: string }[]) => ms.filter((m) => m.nivel === 'error').length;

describe('el registro', () => {
  it('declara y lee; un nombre inválido, repetido o con un valor por defecto que no es de su tipo, no se acepta', () => {
    const { r } = armar();
    expect(r.valor('dojo.cubos')).toBe(0);
    expect(r.valor('fisica.gravedad')).toEqual([0, -9.81, 0]);
    const base = { descripcion: { es: '' }, alcance: 'vista', tipo: { tipo: 'booleano' }, porDefecto: false } as const;
    expect(() => r.declararVariable({ ...base, nombre: 'Ver.Ejes' })).toThrow(/no válido/);
    expect(() => r.declararVariable({ ...base, nombre: 'ver.ejes' })).toThrow(/ya está declarado/);
    expect(() => r.declararVariable({ ...base, nombre: 'ver.otra', porDefecto: 3 })).toThrow(/por defecto/);
  });

  it('sin argumentos, una variable se muestra: valor, valor por defecto, tipo, alcance y para qué sirve', () => {
    const { r } = armar();
    const t = textos(r.ejecutar('dojo.cubos'));
    expect(t).toContain('dojo.cubos = 0');
    expect(t).toContain('un entero de 0 a 200');
    expect(t).toContain('de arranque');
    expect(t).toContain('Cubos extra.');
  });

  it('lee cada tipo, y si el valor no sirve, dice qué esperaba', () => {
    const { r } = armar();
    r.ejecutar('dojo.cubos 20');
    expect(r.valor('dojo.cubos')).toBe(20);
    expect(textos(r.ejecutar('dojo.cubos 300'))).toContain('esperaba un entero de 0 a 200, y llegó 300');
    expect(textos(r.ejecutar('dojo.cubos muchos'))).toContain('llegó "muchos"');
    expect(textos(r.ejecutar('dojo.cubos 2.5'))).toContain('esperaba un entero');
    expect(textos(r.ejecutar('vista.lento 0,25'))).toContain('los decimales van con punto (0.25)');
    expect(textos(r.ejecutar('dojo.cubos 3 4'))).toContain('sobra "4"');
    expect(r.valor('dojo.cubos')).toBe(20); // nada de eso lo cambió

    for (const [escrito, valor] of [
      ['si', true],
      ['no', false],
      ['1', true],
      ['0', false],
      ['yes', true],
      ['sí', true],
    ] as const) {
      r.ejecutar(`ver.ejes ${escrito}`);
      expect(r.valor('ver.ejes')).toBe(valor);
    }
    r.ejecutar('vista.lento .25');
    expect(r.valor('vista.lento')).toBe(0.25);
    r.ejecutar('vista.calidad ALTA');
    expect(r.valor('vista.calidad')).toBe('alta');
    expect(textos(r.ejecutar('vista.calidad ultra'))).toContain('baja, media, alta');
    expect(textos(r.ejecutar('fisica.gravedad 0 -3'))).toContain('tres números');
  });

  it('un nombre que no existe sugiere el más parecido', () => {
    const { r } = armar();
    expect(textos(r.ejecutar('fisica.gravedd 0 -3 0'))).toContain('¿Quisiste decir "fisica.gravedad"?');
    expect(textos(r.ejecutar('cubos 3'))).toContain('"dojo.cubos"');
    expect(textos(r.ejecutar('xyzzy'))).toContain('Probá "buscar xyzzy"');
  });

  it('lo de ARRANQUE avisa una sola vez por texto ejecutado, y solo si algo cambió', () => {
    const { r } = armar();
    const reiniciar = vi.fn();
    r.alCambiarArranque = reiniciar;
    r.ejecutar('semilla 7; dojo.cubos 20');
    expect(reiniciar).toHaveBeenCalledTimes(1);
    r.ejecutar('semilla 7');
    expect(reiniciar).toHaveBeenCalledTimes(1); // mismo valor: no vuelve a empezar
  });

  it('lo del MUNDO no se aplica enseguida: va al programador (la partida) con su línea', () => {
    const { r } = armar();
    const mundo: MundoDePrueba = { hechos: [] };
    // Sin partida todavía: solo se anota, y el mundo nace con ese valor.
    r.ejecutar('fisica.gravedad 0 -3 0');
    expect(mundo.hechos).toEqual([]);
    r.aplicarAlMundo(mundo);
    expect(mundo.hechos).toEqual(['gravedad 0,-3,0']);

    const programados: { linea: string; aplicar: (m: MundoDePrueba) => void }[] = [];
    r.programador = (linea, aplicar) => programados.push({ linea, aplicar });
    expect(textos(r.ejecutar('fisica.gravedad 0 -1 0'))).toContain('desde el paso siguiente');
    r.ejecutar('crear 1 2 3');
    expect(programados.map((p) => p.linea)).toEqual(['fisica.gravedad 0 -1 0', 'crear 1 2 3']);
    expect(mundo.hechos).toHaveLength(1); // todavía nada: lo aplica la partida, en su paso
    for (const p of programados) p.aplicar(mundo);
    expect(mundo.hechos).toEqual(['gravedad 0,-3,0', 'gravedad 0,-1,0', 'crear 1,2,3']);
  });

  it('lo de la VISTA se aplica enseguida', () => {
    const { r, vista } = armar();
    r.ejecutar('ver.ejes si');
    expect(vista).toHaveBeenCalledWith(true);
  });

  it('los comandos leen sus argumentos (opcionales, que faltan, que sobran, el resto de la línea)', () => {
    const { r, hecho } = armar();
    r.ejecutar('paso');
    expect(hecho).toHaveBeenLastCalledWith([]);
    r.ejecutar('paso 10');
    expect(hecho).toHaveBeenLastCalledWith([10]);
    expect(textos(r.ejecutar('paso 10 20'))).toContain('Se usa así: paso [n]');
    expect(textos(r.ejecutar('crear 1 2'))).toContain('tres números');
    r.ejecutar('atajo f "ver.ejes si; vista.lento 0.5"');
    expect(hecho).toHaveBeenLastCalledWith(['f', '"ver.ejes si; vista.lento 0.5"']);
  });

  it('una RECETA no puede ejecutar comandos que no son seguros para recetas (decisión 0010)', () => {
    const { r, hecho } = armar();
    const ms = r.ejecutar('dojo.cubos 5\natajo f ver.ejes si', 'receta');
    expect(r.valor('dojo.cubos')).toBe(5); // las variables, sí
    expect(errores(ms)).toBe(1);
    expect(textos(ms)).toContain('"atajo" no se puede usar en una receta');
    expect(hecho).not.toHaveBeenCalled();
  });

  it('separa por renglón y por ";", y saltea los comentarios', () => {
    const { r } = armar();
    const ms = r.ejecutar('# un comentario\ndojo.cubos 3 # al final\n\nsemilla 9; ver.ejes si');
    expect(errores(ms)).toBe(0);
    expect([r.valor('dojo.cubos'), r.valor('semilla'), r.valor('ver.ejes')]).toEqual([3, 9, true]);
  });

  it('la receta exportada tiene solo lo cambiado, y lo de la vista en una sección aparte', () => {
    const { r } = armar();
    r.ejecutar('dojo.cubos 20; fisica.gravedad 0 -3 0; ver.ejes si; vista.lento 0.5');
    expect(r.receta('Mi sala')).toBe(
      '# Mi sala\ndojo.cubos 20\nfisica.gravedad 0 -3 0\n\n# Lo que se ve\nver.ejes si\nvista.lento 0.5\n',
    );
    // Y vuelve a dar lo mismo al cargarla en un registro nuevo.
    const otro = armar().r;
    expect(errores(otro.ejecutar(r.receta(), 'receta'))).toBe(0);
    expect(otro.receta('Mi sala')).toBe(r.receta('Mi sala'));
  });

  it('restablecer vuelve todo a su valor por defecto (y lo de la vista se aplica)', () => {
    const { r, vista } = armar();
    r.ejecutar('dojo.cubos 20; ver.ejes si');
    r.restablecer();
    expect(r.cambiadas()).toEqual([]);
    expect(vista).toHaveBeenLastCalledWith(false);
  });

  it('completa nombres y valores', () => {
    const { r } = armar();
    declararAyudas(r);
    expect(r.completar('dojo.c').linea).toBe('dojo.cubos ');
    expect(r.completar('vista.').candidatos).toEqual(['vista.calidad', 'vista.lento']);
    expect(r.completar('ver.ejes ').candidatos).toEqual(['si', 'no']);
    expect(r.completar('vista.calidad a').linea).toBe('vista.calidad alta ');
    expect(r.completar('ayuda dojo').linea).toBe('ayuda dojo.cubos ');
  });

  it('un alias ejecuta el original, pero la receta se escribe con el nombre original', () => {
    const { r } = armar();
    r.declararAlias('physics.gravity', 'fisica.gravedad');
    r.ejecutar('physics.gravity 0 -2 0');
    expect(r.valor('fisica.gravedad')).toEqual([0, -2, 0]);
    expect(r.receta()).toContain('fisica.gravedad 0 -2 0');
  });
});

describe('las ayudas', () => {
  it('buscar ignora tildes y mayúsculas; alternar da vuelta un si o no; cambiadas muestra solo lo cambiado', () => {
    const { r } = armar();
    declararAyudas(r);
    expect(textos(r.ejecutar('buscar GRAVEDAD'))).toContain('fisica.gravedad');
    r.ejecutar('alternar ver.ejes');
    expect(r.valor('ver.ejes')).toBe(true);
    expect(textos(r.ejecutar('alternar dojo.cubos'))).toContain('no es una variable de si o no');
    expect(textos(r.ejecutar('cambiadas'))).toContain('ver.ejes');
    expect(textos(r.ejecutar('cambiadas'))).not.toContain('dojo.cubos');
    expect(textos(r.ejecutar('ayuda'))).toContain('Comandos:');
    expect(textos(r.ejecutar('ayuda crear'))).toContain('crear lugar');
  });
});
