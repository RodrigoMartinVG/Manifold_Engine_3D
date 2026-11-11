/**
 * EL DOCUMENTO DEL IFRAME donde corre el código de una lección (decisión 0007).
 *
 * El iframe es `sandbox="allow-scripts"`, SIN `allow-same-origin`: su origen es otro (uno
 * "opaco"), así que el código que edita el lector no puede leer nada del sitio (su
 * almacenamiento, sus cookies) ni tocar la página. Solo se comunican por mensajes
 * (`postMessage`), en los dos sentidos:
 *
 *   página ──► iframe   { tipo: 'ejecutar', modulos }    las librerías y los archivos, ya en JavaScript
 *   iframe ──► página   { tipo: 'listo' }                 listo para recibirlos
 *                       { tipo: 'consola', nivel, texto } lo que la lección escribe con console.log
 *                       { tipo: 'error', texto }          un error (con su archivo y línea)
 *                       { tipo: 'cuadros', n }            cuántos cuadros dibujó (para las pruebas)
 *
 * Cada módulo se vuelve un `blob:` (un archivo que existe solo en la memoria del iframe), y un
 * MAPA DE IMPORTACIONES (`<script type="importmap">`) le dice al navegador qué `blob:` es
 * `three` y cuál es `leccion/main`. Es lo mismo que hace un empaquetador como Vite, pero al revés:
 * en vez de juntar los módulos en un archivo, le explica al navegador dónde está cada uno.
 */
export function documentoDelIframe(): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<style>
  html, body { margin: 0; height: 100%; overflow: hidden; background: #15120f; color: #e6dccb; font: 13px/1.4 system-ui, sans-serif; }
  canvas { display: block; }
  /* Los paneles de lil-gui, con los colores del sitio (sus variables CSS; "html" le gana a las suyas). */
  html .lil-gui {
    --background-color: #1b1814; --widget-color: #2f2922; --hover-color: #3b332a; --focus-color: #473d31;
    --text-color: #dcd2c3; --title-background-color: #2a221a; --title-text-color: #f0d59a;
    --number-color: #93d9c9; --string-color: #e9c48c;
  }
</style>
<script>
  const padre = window.parent;
  const enviar = (m) => padre.postMessage({ deCodigoVivo: true, ...m }, '*');
  const nombres = {};
  const texto = (v) => {
    if (typeof v === 'string') return v;
    if (v instanceof Error) return v.message;
    try {
      return JSON.stringify(v, (_, x) => (typeof x === 'number' && !Number.isInteger(x) ? Math.round(x * 1e4) / 1e4 : x));
    } catch {
      return String(v);
    }
  };
  for (const nivel of ['log', 'info', 'warn', 'error']) {
    const original = console[nivel].bind(console);
    console[nivel] = (...args) => {
      enviar({ tipo: 'consola', nivel, texto: args.map(texto).join(' ') });
      original(...args);
    };
  }
  // El archivo y la línea de un error: el navegador dice "blob:...", y aquí se traduce al nombre del archivo.
  const donde = (archivo, linea) => {
    const nombre = nombres[archivo];
    return nombre ? ' (' + nombre + ', línea ' + linea + ')' : '';
  };
  addEventListener('error', (e) => enviar({ tipo: 'error', texto: e.message + donde(e.filename, e.lineno) }));
  addEventListener('unhandledrejection', (e) => enviar({ tipo: 'error', texto: texto(e.reason) }));
  // Contar los cuadros sin que la lección lo sepa: se envuelve requestAnimationFrame.
  let cuadros = 0;
  const pedirCuadro = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (f) =>
    pedirCuadro((t) => {
      if (++cuadros % 10 === 0) enviar({ tipo: 'cuadros', n: cuadros });
      f(t);
    });
  addEventListener('message', (e) => {
    if (e.source !== padre || !e.data || e.data.tipo !== 'ejecutar') return;
    const imports = {};
    for (const [especificador, codigo] of Object.entries(e.data.modulos)) {
      const url = URL.createObjectURL(new Blob([codigo], { type: 'text/javascript' }));
      imports[especificador] = url;
      nombres[url] = especificador.startsWith('leccion/') ? especificador.slice(8) + '.ts' : especificador;
    }
    const mapa = document.createElement('script');
    mapa.type = 'importmap';
    mapa.textContent = JSON.stringify({ imports });
    document.head.append(mapa);
    const inicio = document.createElement('script');
    inicio.type = 'module';
    inicio.textContent = "import 'leccion/main';";
    document.head.append(inicio);
  });
  enviar({ tipo: 'listo' });
</script>
</head>
<body></body>
</html>`;
}
