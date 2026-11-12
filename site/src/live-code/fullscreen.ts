/**
 * LA PANTALLA COMPLETA de un ejemplo: el código y lo que dibuja, lado a lado, ocupando toda la
 * pantalla. La disposición la hace el CSS (CodigoVivo.astro) a partir de `data-ampliado`; aquí
 * solo se entra, se sale y se arrastra el divisor.
 *
 * Dos maneras de ampliar:
 * - "pantalla": la pantalla completa del navegador (`requestFullscreen`). Se sale con Esc o con
 *   el botón; el navegador avisa con el evento `fullscreenchange`.
 * - "ventana": cuando no la hay (en el iPhone, solo los videos pueden), el ejemplo se estira
 *   sobre toda la ventana con `position: fixed`. Se sale con Esc o con el botón.
 *
 * En ningún caso el ejemplo cambia de lugar en la página: si el iframe cambiara de padre, el
 * navegador lo recargaría y el ejemplo empezaría de cero.
 */

type Modo = 'pantalla' | 'ventana';

const LIMITES = { min: 20, max: 80 }; // el ancho del código, en % de la pantalla

export function montarPantallaCompleta(raiz: HTMLElement, { alEntrar }: { alEntrar: () => void }) {
  const boton = raiz.querySelector<HTMLButtonElement>('.cv-ampliar')!;
  const texto = boton.querySelector<HTMLElement>('.cv-texto');
  const divisor = raiz.querySelector<HTMLElement>('.cv-divisor')!;

  const marcar = (modo: Modo | null) => {
    if (modo) raiz.dataset.ampliado = modo;
    else delete raiz.dataset.ampliado;
    document.documentElement.classList.toggle('cv-con-ampliado', modo === 'ventana');
    boton.setAttribute('aria-pressed', String(modo !== null));
    boton.title = modo ? 'Volver a la página (Esc)' : 'El código y lo que dibuja, en pantalla completa';
    boton.firstElementChild!.textContent = modo ? '✕' : '⛶';
    if (texto) texto.textContent = modo ? ' Salir' : ' Pantalla completa';
  };

  async function entrar() {
    let modo: Modo = 'ventana';
    if (document.fullscreenEnabled) {
      try {
        await raiz.requestFullscreen({ navigationUI: 'hide' });
        modo = 'pantalla';
      } catch {
        // El navegador no quiso (por ejemplo, sin un clic de por medio): queda la ventana.
      }
    }
    marcar(modo);
    alEntrar();
  }

  function salir() {
    // De la pantalla completa del navegador se sale pidiéndoselo; él avisa con fullscreenchange.
    if (document.fullscreenElement === raiz) void document.exitFullscreen();
    else marcar(null);
  }

  boton.addEventListener('click', () => (raiz.dataset.ampliado ? salir() : void entrar()));

  // Esc en la pantalla completa la cierra el navegador: aquí solo se acompaña.
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement !== raiz && raiz.dataset.ampliado === 'pantalla') marcar(null);
  });
  // Esc en la "ventana" hay que atenderlo a mano (salvo que el editor ya lo usó, p. ej. para
  // cerrar el autocompletado).
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !e.defaultPrevented && raiz.dataset.ampliado === 'ventana') salir();
  });

  // ---------- El divisor: arrastrarlo cambia cuánto ocupa el código ----------
  const ponerAncho = (porcentaje: number) => {
    const p = Math.round(Math.min(LIMITES.max, Math.max(LIMITES.min, porcentaje)));
    raiz.style.setProperty('--cv-codigo', `${p}%`);
    divisor.setAttribute('aria-valuenow', String(p));
  };
  divisor.addEventListener('pointerdown', (e) => {
    divisor.setPointerCapture(e.pointerId);
    raiz.dataset.arrastrando = '1'; // el CSS le saca el puntero al iframe mientras tanto
  });
  divisor.addEventListener('pointermove', (e) => {
    if (!divisor.hasPointerCapture(e.pointerId)) return;
    const caja = raiz.getBoundingClientRect();
    ponerAncho(((e.clientX - caja.left) / caja.width) * 100);
  });
  const soltar = () => delete raiz.dataset.arrastrando;
  divisor.addEventListener('pointerup', soltar);
  divisor.addEventListener('pointercancel', soltar);
  // Con el teclado: las flechas lo mueven de a 5 %.
  divisor.addEventListener('keydown', (e) => {
    const paso = e.key === 'ArrowLeft' ? -5 : e.key === 'ArrowRight' ? 5 : 0;
    if (!paso) return;
    e.preventDefault();
    ponerAncho(Number(divisor.getAttribute('aria-valuenow')) + paso);
  });
}
