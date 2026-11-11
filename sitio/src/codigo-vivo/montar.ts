import { EditorView, basicSetup } from 'codemirror';
import { EditorState, Prec } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { documentoDelIframe } from './iframe';
import { nombreDeModulo, transpilar } from './transpilar';

/**
 * UN EJEMPLO VIVO (decisión 0007): un editor con un archivo por pestaña, y al ejecutar, el
 * código corre en un iframe aislado debajo, con su consola.
 *
 * Solo uno corre a la vez en toda la página: cada ejemplo con 3D usa un contexto de WebGL (los
 * navegadores permiten unos 16, y una gráfica integrada sufre con varios). Al ejecutar uno, el
 * que estaba corriendo se detiene: su iframe se borra, y con él su contexto.
 *
 * Para las pruebas en el navegador, el elemento anota su estado en atributos `data-`:
 * `estado` (corriendo / detenido), `cuadros` (cuántos dibujó) y `errores`.
 */

/**
 * Los colores del taller encima de One Dark: carbón cálido en vez de gris azulado, y el cursor de
 * bronce. Los colores del código (palabras clave, textos, números) siguen siendo los de One Dark.
 * `Prec.high`: entre dos temas gana el de más precedencia.
 */
const taller = Prec.high(
  EditorView.theme(
    {
      '&': { backgroundColor: '#1a1714', color: '#dcd2c3' },
      '.cm-content': { caretColor: '#e9c48c' },
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#e9c48c' },
      '.cm-gutters': { backgroundColor: '#1a1714', color: '#6f6454', borderRight: '1px solid #2c2620' },
      '.cm-activeLine': { backgroundColor: '#221e19' },
      '.cm-activeLineGutter': { backgroundColor: '#221e19', color: '#b9a98f' },
      '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
        { backgroundColor: '#41362a' },
    },
    { dark: true },
  ),
);

interface Archivo {
  nombre: string;
  codigo: string;
}

interface Control {
  detener(): void;
}

let activo: Control | null = null;

/** Las librerías (Three.js...): se piden una sola vez por página, la primera vez que algo se ejecuta. */
let librerias: Promise<Record<string, string>> | null = null;

function cargarLibrerias(base: string): Promise<Record<string, string>> {
  librerias ??= (async () => {
    const pedir = async (archivo: string) => {
      const respuesta = await fetch(`${base}/vendor/${archivo}`);
      if (!respuesta.ok) throw new Error(`No se pudo cargar ${archivo} (${respuesta.status})`);
      return respuesta;
    };
    const manifiesto = (await (await pedir('manifiesto.json')).json()) as Record<string, string>;
    const textos = await Promise.all(
      Object.entries(manifiesto).map(
        async ([especificador, archivo]) => [especificador, await (await pedir(archivo)).text()] as const,
      ),
    );
    return Object.fromEntries(textos);
  })();
  return librerias;
}

export function montarCodigoVivo(raiz: HTMLElement) {
  if (raiz.dataset.montado) return;
  raiz.dataset.montado = '1';
  const archivos = JSON.parse(raiz.dataset.archivos ?? '[]') as Archivo[];
  const base = (raiz.dataset.base ?? '/').replace(/\/$/, '');
  const pestanas = raiz.querySelector<HTMLElement>('.cv-pestanas')!;
  const lugarDelEditor = raiz.querySelector<HTMLElement>('.cv-editor')!;
  const resultado = raiz.querySelector<HTMLElement>('.cv-resultado')!;
  const portada = raiz.querySelector<HTMLButtonElement>('.cv-portada')!;
  const consola = raiz.querySelector<HTMLElement>('.cv-consola')!;
  const control: Control = { detener };

  // ---------- El editor: un estado por archivo; la vista muestra el de la pestaña elegida ----------
  const extensiones = [
    Prec.highest(keymap.of([{ key: 'Mod-Enter', run: () => (void ejecutar(), true) }])),
    basicSetup,
    javascript({ typescript: true }),
    oneDark,
    taller,
    EditorView.lineWrapping, // el editor es angosto: las líneas largas siguen abajo, sin barra horizontal
  ];
  const crearEstado = (codigo: string) => EditorState.create({ doc: codigo, extensions: extensiones });
  let estados = archivos.map((a) => crearEstado(a.codigo));
  let actual = 0;
  const vista = new EditorView({ state: estados[0], parent: lugarDelEditor });

  const marcarPestana = () =>
    pestanas.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-selected', String(i === actual)));
  archivos.forEach((a, i) => {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.role = 'tab';
    boton.textContent = a.nombre;
    boton.addEventListener('click', () => {
      estados[actual] = vista.state;
      actual = i;
      vista.setState(estados[i]!);
      marcarPestana();
    });
    pestanas.append(boton);
  });
  marcarPestana();

  // ---------- La consola ----------
  let errores = 0;
  const escribir = (nivel: string, texto: string) => {
    const linea = document.createElement('div');
    linea.className = `cv-linea cv-${nivel}`;
    linea.textContent = texto;
    consola.append(linea);
    while (consola.childElementCount > 200) consola.firstElementChild?.remove();
    consola.hidden = false;
    consola.scrollTop = consola.scrollHeight;
  };
  const anotarError = (texto: string) => {
    raiz.dataset.errores = String(++errores);
    escribir('error', `✖ ${texto}`);
  };

  // ---------- Ejecutar ----------
  let iframe: HTMLIFrameElement | null = null;
  let modulos: Record<string, string> | null = null;

  window.addEventListener('message', (e: MessageEvent) => {
    if (!iframe || e.source !== iframe.contentWindow || !e.data?.deCodigoVivo) return;
    const m = e.data as { tipo: string; nivel?: string; texto?: string; n?: number };
    if (m.tipo === 'listo' && modulos) iframe.contentWindow?.postMessage({ tipo: 'ejecutar', modulos }, '*');
    else if (m.tipo === 'consola') escribir(m.nivel ?? 'log', m.texto ?? '');
    else if (m.tipo === 'error') anotarError(m.texto ?? 'error');
    else if (m.tipo === 'cuadros') raiz.dataset.cuadros = String(m.n ?? 0);
  });

  async function ejecutar() {
    estados[actual] = vista.state;
    activo?.detener();
    consola.replaceChildren();
    consola.hidden = true;
    errores = 0;
    raiz.dataset.errores = '0';
    raiz.dataset.cuadros = '0';
    try {
      const propios = Object.fromEntries(
        archivos.map((a, i) => [nombreDeModulo(a.nombre), transpilar(estados[i]!.doc.toString())]),
      );
      modulos = { ...(await cargarLibrerias(base)), ...propios };
    } catch (e) {
      // Un error de sintaxis aparece aquí, antes de correr nada.
      anotarError((e as Error).message);
      return;
    }
    portada.hidden = true;
    iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.title = 'Lo que dibuja el código';
    iframe.srcdoc = documentoDelIframe();
    resultado.append(iframe);
    raiz.dataset.estado = 'corriendo';
    activo = control;
  }

  function detener() {
    iframe?.remove();
    iframe = null;
    modulos = null;
    portada.hidden = false;
    raiz.dataset.estado = 'detenido';
    if (activo === control) activo = null;
  }

  raiz.querySelector('.cv-ejecutar')?.addEventListener('click', () => void ejecutar());
  portada.addEventListener('click', () => void ejecutar());
  raiz.querySelector('.cv-restaurar')?.addEventListener('click', () => {
    estados = archivos.map((a) => crearEstado(a.codigo));
    vista.setState(estados[actual]!);
  });

  // El primer ejemplo de una lección arranca solo cuando aparece en pantalla (si nada más está corriendo).
  if (raiz.dataset.autoejecutar) {
    const observador = new IntersectionObserver((entradas) => {
      if (!entradas.some((e) => e.isIntersecting)) return;
      observador.disconnect();
      if (!activo) void ejecutar();
    });
    observador.observe(raiz);
  }
}
