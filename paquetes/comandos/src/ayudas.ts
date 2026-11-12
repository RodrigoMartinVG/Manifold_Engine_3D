import type { Registro } from './registro';
import { escribirValor } from './valores';

/** Sin tildes ni mayúsculas, para buscar: "física" encuentra "fisica". */
const normalizar = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/**
 * LOS COMANDOS PARA ORIENTARSE en la consola: `ayuda`, `buscar`, `variables`, `cambiadas` y
 * `alternar`. Los declara quien monta una consola (un juego sin consola no los necesita).
 */
export function declararAyudas<M>(registro: Registro<M>) {
  registro.declararComando({
    nombre: 'ayuda',
    descripcion: { es: 'Cómo se usa la consola, o la ayuda de un nombre.' },
    argumentos: [{ nombre: 'nombre', tipo: { tipo: 'texto' }, opcional: true }],
    ejecutar([nombre], salida) {
      if (typeof nombre === 'string') {
        salida.escribir(registro.ayudaDe(nombre.toLowerCase()) ?? `no existe "${nombre}". Probá "buscar ${nombre}".`);
        return;
      }
      salida.escribir(
        [
          'Escribí un nombre para ver su valor, o el nombre y un valor para cambiarlo:',
          '  dojo.cubos            dojo.cubos 20            ver.triangulos si',
          'Tab completa, las flechas recorren lo que escribiste, y Esc cierra.',
          'Para orientarse: buscar <texto>, variables [prefijo], cambiadas, ayuda <nombre>.',
          `Comandos: ${registro
            .listaDeComandos()
            .map((c) => c.nombre)
            .sort()
            .join(', ')}`,
        ].join('\n'),
      );
    },
  });

  registro.declararComando({
    nombre: 'buscar',
    descripcion: { es: 'Busca en los nombres y en las descripciones.' },
    argumentos: [{ nombre: 'texto', tipo: { tipo: 'resto' } }],
    ejecutar([texto], salida) {
      const buscado = normalizar(String(texto));
      const lineas = [
        ...registro.listaDeVariables().map((v) => ({ nombre: v.decl.nombre, d: registro.texto(v.decl.descripcion) })),
        ...registro.listaDeComandos().map((c) => ({ nombre: c.nombre, d: registro.texto(c.descripcion) })),
      ]
        .filter((x) => normalizar(`${x.nombre} ${x.d}`).includes(buscado))
        .map((x) => `${x.nombre.padEnd(22)} ${x.d}`);
      salida.escribir(lineas.length ? lineas.join('\n') : `nada con "${texto}"`);
    },
  });

  registro.declararComando({
    nombre: 'variables',
    descripcion: { es: 'Las variables y sus valores (todas, o las que empiezan con un prefijo: "variables ver.").' },
    argumentos: [{ nombre: 'prefijo', tipo: { tipo: 'texto' }, opcional: true }],
    ejecutar([prefijo], salida) {
      const p = typeof prefijo === 'string' ? prefijo.toLowerCase() : '';
      const lineas = registro
        .listaDeVariables()
        .filter((v) => v.decl.nombre.startsWith(p))
        .map((v) => `${v.decl.nombre.padEnd(22)} ${escribirValor(v.valor)}`);
      salida.escribir(lineas.length ? lineas.join('\n') : `ninguna empieza con "${p}"`);
    },
  });

  registro.declararComando({
    nombre: 'cambiadas',
    descripcion: { es: 'Solo las variables que no tienen su valor por defecto.' },
    ejecutar(_, salida) {
      const lineas = registro.cambiadas().map((v) => `${v.decl.nombre.padEnd(22)} ${escribirValor(v.valor)}`);
      salida.escribir(lineas.length ? lineas.join('\n') : 'nada cambiado: todo está en su valor por defecto');
    },
  });

  registro.declararComando({
    nombre: 'alternar',
    descripcion: { es: 'Da vuelta una variable de si o no: "alternar ver.ejes".' },
    argumentos: [{ nombre: 'nombre', tipo: { tipo: 'texto' } }],
    ejecutar([nombre], salida) {
      const n = String(nombre).toLowerCase();
      const v = registro.listaDeVariables().find((x) => x.decl.nombre === n);
      if (!v || v.decl.tipo.tipo !== 'booleano') {
        salida.escribir(`alternar: "${n}" no es una variable de si o no`, 'error');
        return;
      }
      for (const m of registro.ejecutar(`${n} ${v.valor ? 'no' : 'si'}`)) salida.escribir(m.texto, m.nivel);
    },
  });
}
