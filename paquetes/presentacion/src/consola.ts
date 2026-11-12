import { parecido, PREFIJO_DEL_ENLACE, recetaParaEnlace, type Mensaje, type Nivel, type Registro } from '@manifold/comandos';

export interface OpcionesConsola {
  /** Para guardar aparte lo de cada juego (el historial, los atajos, la receta de inicio): "dojo". */
  juego: string;
  /** Las salas guardadas del juego, por nombre: para `cargar`. */
  salas?: Readonly<Record<string, { titulo: string; texto: string }>>;
  /** La dirección propia de una sala (si el sitio le da una): al cargarla, la barra de direcciones la muestra. */
  direccionDeSala?(nombre: string): string;
}

export interface Consola {
  escribir(texto: string, nivel?: Nivel | 'eco'): void;
  abrir(): void;
  cerrar(): void;
  readonly abierta: boolean;
  /** La receta de inicio de esta persona, para este juego (o null). */
  recetaDeInicio(): string | null;
  detener(): void;
}

/** Lo que la consola necesita de quien la monta. */
export interface AccionesConsola {
  reiniciar(): void;
}

/** La tecla de la consola, como en Quake: la de la izquierda del 1 (la º en un teclado español). */
const TECLA = 'Backquote';
const MAXIMO_HISTORIAL = 100;
const MAXIMO_LINEAS = 400;

/**
 * LA CONSOLA (decisión 0010): una caja de texto sobre el juego, que muestra, completa y ejecuta
 * lo que está declarado en el registro. No ejecuta código: una línea es un comando con sus
 * argumentos. Es una pieza que el juego monta si quiere (el Dojo, sí; otros, quizás no).
 *
 * Además de lo declarado, trae lo que depende del navegador y de cada persona: `exportar` (la
 * receta de lo cambiado, como enlace), `cargar` (una sala guardada), `inicio` (la receta propia
 * de inicio), `atajo` (teclas para comandos) y `limpiar`. Ninguno se puede usar desde una receta:
 * un enlace ajeno nunca toca las preferencias guardadas.
 */
export function montarConsola(
  contenedor: HTMLElement,
  registro: Registro<unknown> | Registro<never>,
  o: OpcionesConsola,
  acciones: AccionesConsola,
): Consola {
  // (El registro se usa sin mirar el tipo del mundo: la consola no lo necesita.)
  const r = registro as Registro<unknown>;
  const guardado = almacen(`manifold.${o.juego}`);
  ponerEstilos();

  const raiz = document.createElement('div');
  raiz.className = 'mg-consola';
  raiz.dataset.abierta = 'no';
  const registroVisual = document.createElement('div');
  registroVisual.className = 'mg-consola-registro';
  registroVisual.setAttribute('role', 'log');
  const linea = document.createElement('label');
  linea.className = 'mg-consola-linea';
  const entrada = document.createElement('input');
  entrada.setAttribute('aria-label', 'Comando');
  entrada.autocomplete = 'off';
  entrada.spellcheck = false;
  linea.append(Object.assign(document.createElement('span'), { textContent: ']' }), entrada);
  raiz.append(registroVisual, linea);
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'mg-consola-boton';
  boton.textContent = '›_';
  boton.title = 'Consola (tecla º)';
  boton.setAttribute('aria-label', 'Abrir la consola');
  contenedor.append(raiz, boton);

  // ---------- Escribir ----------
  function escribir(texto: string, nivel: Nivel | 'eco' = 'info') {
    for (const renglon of texto.split('\n')) {
      const div = document.createElement('div');
      div.className = `mg-consola-${nivel}`;
      div.textContent = renglon;
      registroVisual.append(div);
    }
    while (registroVisual.childElementCount > MAXIMO_LINEAS) registroVisual.firstElementChild?.remove();
    registroVisual.scrollTop = registroVisual.scrollHeight;
  }
  const mostrar = (mensajes: Mensaje[]) => mensajes.forEach((m) => escribir(m.texto, m.nivel));

  // ---------- Abrir y cerrar ----------
  let abierta = false;
  function abrir() {
    abierta = true;
    raiz.dataset.abierta = 'si';
    entrada.focus();
  }
  function cerrar() {
    abierta = false;
    raiz.dataset.abierta = 'no';
    entrada.blur();
  }
  boton.addEventListener('click', () => (abierta ? cerrar() : abrir()));

  // ---------- El historial (lo que se escribió, guardado para la próxima vez) ----------
  const historial: string[] = guardado.leer('historial') ?? [];
  let enHistorial = historial.length;

  function ejecutar(texto: string) {
    escribir(`] ${texto}`, 'eco');
    if (texto.trim() && historial[historial.length - 1] !== texto) {
      historial.push(texto);
      historial.splice(0, Math.max(0, historial.length - MAXIMO_HISTORIAL));
      guardado.escribir('historial', historial);
    }
    enHistorial = historial.length;
    mostrar(r.ejecutar(texto, 'consola'));
  }

  // ---------- Las teclas ----------
  entrada.addEventListener('keydown', (e) => {
    e.stopPropagation(); // mientras se escribe, las teclas son de la consola, no del juego
    if (e.code === TECLA) {
      e.preventDefault();
      cerrar();
    } else if (e.key === 'Enter') {
      ejecutar(entrada.value);
      entrada.value = '';
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const { candidatos, linea: completada } = r.completar(entrada.value);
      if (candidatos.length > 1) escribir(candidatos.join('   '));
      entrada.value = completada;
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      enHistorial = Math.max(0, Math.min(historial.length, enHistorial + (e.key === 'ArrowUp' ? -1 : 1)));
      entrada.value = historial[enHistorial] ?? '';
    } else if (e.key === 'Escape') cerrar();
  });

  const alTeclear = (e: KeyboardEvent) => {
    if (e.code === TECLA && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      if (abierta) cerrar();
      else abrir();
      return;
    }
    // Los atajos: solo con la consola cerrada, y si no se está escribiendo en otro lado.
    const destino = e.target as HTMLElement | null;
    if (abierta || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (destino?.closest('input, textarea, select, [contenteditable]')) return;
    const comando = atajos[e.key.toLowerCase()];
    if (comando) {
      e.preventDefault();
      escribir(`] ${comando}   (atajo ${e.key.toLowerCase()})`, 'eco');
      mostrar(r.ejecutar(comando, 'consola'));
    }
  };
  document.addEventListener('keydown', alTeclear);

  // ---------- Los comandos de la consola ----------
  const atajos: Record<string, string> = guardado.leer('atajos') ?? {};

  r.declararComando({
    nombre: 'exportar',
    descripcion: { es: 'Arma un enlace con la receta de lo que cambiaste: quien lo abre, ve lo mismo.' },
    ejecutar(_, salida) {
      if (r.cambiadas().length === 0) {
        salida.escribir('nada que exportar: todo está en su valor por defecto');
        return;
      }
      const enlace = `${location.origin}${location.pathname}#${PREFIJO_DEL_ENLACE}${recetaParaEnlace(r.receta())}`;
      salida.escribir(enlace);
      salida.escribir(r.receta().trimEnd());
      navigator.clipboard?.writeText(enlace).then(
        () => escribir('(enlace copiado)'),
        () => undefined,
      );
    },
  });

  r.declararComando({
    nombre: 'cargar',
    descripcion: { es: 'Carga una sala guardada (sin nombre: la lista de salas).' },
    argumentos: [{ nombre: 'sala', tipo: { tipo: 'texto' }, opcional: true }],
    ejecutar([nombre], salida) {
      const salas = o.salas ?? {};
      if (typeof nombre !== 'string') {
        const lista = Object.entries(salas).map(([n, s]) => `${n.padEnd(16)} ${s.titulo}`);
        salida.escribir(lista.length ? lista.join('\n') : 'este juego no tiene salas guardadas');
        return;
      }
      const sala = salas[nombre.toLowerCase()];
      if (!sala) {
        const sugerencia = parecido(nombre.toLowerCase(), Object.keys(salas));
        salida.escribir(`no hay una sala "${nombre}"${sugerencia ? `. ¿Quisiste decir "${sugerencia}"?` : ''}`, 'error');
        return;
      }
      // Desde cero: los valores por defecto, la receta de inicio y la de la sala. Un solo reinicio al final.
      const avisarArranque = r.alCambiarArranque;
      r.alCambiarArranque = null;
      r.restablecer();
      const inicio = guardado.leer<string>('inicio');
      const mensajes = [...(inicio ? r.ejecutar(inicio, 'receta') : []), ...r.ejecutar(sala.texto, 'receta')];
      r.alCambiarArranque = avisarArranque;
      for (const m of mensajes.filter((m) => m.nivel === 'error')) salida.escribir(m.texto, 'aviso');
      acciones.reiniciar();
      if (o.direccionDeSala) history.replaceState(null, '', o.direccionDeSala(nombre.toLowerCase()));
      salida.escribir(`sala "${nombre.toLowerCase()}": ${sala.titulo}`);
    },
  });

  r.declararComando({
    nombre: 'inicio',
    descripcion: {
      es: 'Tu receta de inicio en este juego: "inicio guardar" guarda lo que cambiaste, y se aplica cada vez que lo abrís; "inicio borrar" la borra.',
    },
    argumentos: [{ nombre: 'accion', tipo: { tipo: 'opcion', opciones: ['guardar', 'borrar'] }, opcional: true }],
    ejecutar([accion], salida) {
      if (accion === 'guardar') {
        guardado.escribir('inicio', r.receta('Mi receta de inicio'));
        salida.escribir('guardada: se aplica cada vez que abras este juego');
      } else if (accion === 'borrar') {
        guardado.borrar('inicio');
        salida.escribir('borrada');
      } else
        salida.escribir(
          guardado.leer<string>('inicio')?.trimEnd() ?? 'no tenés receta de inicio ("inicio guardar" guarda lo que cambiaste)',
        );
    },
  });

  r.declararComando({
    nombre: 'atajo',
    descripcion: {
      es: 'Una tecla para un comando, con la consola cerrada: "atajo t alternar ver.triangulos". Sin nada: la lista; "atajo t nada" lo borra.',
    },
    argumentos: [
      { nombre: 'tecla', tipo: { tipo: 'texto' }, opcional: true },
      { nombre: 'comando', tipo: { tipo: 'resto' }, opcional: true },
    ],
    ejecutar([tecla, comando], salida) {
      if (typeof tecla !== 'string') {
        const lista = Object.entries(atajos).map(([t, c]) => `${t.padEnd(5)} ${c}`);
        salida.escribir(lista.length ? lista.join('\n') : 'no hay atajos (por ejemplo: atajo t alternar ver.triangulos)');
        return;
      }
      const t = tecla.toLowerCase();
      if (!/^([a-z0-9]|f([1-9]|1[0-2]))$/.test(t)) {
        salida.escribir('la tecla tiene que ser una letra, un número o de f1 a f12', 'error');
        return;
      }
      if (typeof comando !== 'string') {
        salida.escribir(atajos[t] ? `${t}: ${atajos[t]}` : `la tecla ${t} no tiene atajo`);
        return;
      }
      const limpio = comando.replace(/^"(.*)"$/, '$1');
      if (limpio === 'nada') delete atajos[t];
      else atajos[t] = limpio;
      guardado.escribir('atajos', atajos);
      salida.escribir(limpio === 'nada' ? `la tecla ${t} ya no tiene atajo` : `${t}: ${limpio}`);
    },
  });

  r.declararComando({
    nombre: 'limpiar',
    descripcion: { es: 'Borra lo escrito en la consola.' },
    ejecutar: () => registroVisual.replaceChildren(),
  });

  escribir(`Consola del ${o.juego}. Escribí "ayuda" para empezar; Tab completa, Esc cierra.`);

  return {
    escribir,
    abrir,
    cerrar,
    get abierta() {
      return abierta;
    },
    recetaDeInicio: () => guardado.leer<string>('inicio'),
    detener() {
      document.removeEventListener('keydown', alTeclear);
      raiz.remove();
      boton.remove();
    },
  };
}

/** Guardar en el navegador, aparte para cada juego. Si no se puede (una ventana privada), no pasa nada. */
function almacen(prefijo: string) {
  return {
    leer<T>(clave: string): T | null {
      try {
        const v = localStorage.getItem(`${prefijo}.${clave}`);
        return v === null ? null : (JSON.parse(v) as T);
      } catch {
        return null;
      }
    },
    escribir(clave: string, valor: unknown) {
      try {
        localStorage.setItem(`${prefijo}.${clave}`, JSON.stringify(valor));
      } catch {
        // sin almacenamiento: vale solo mientras la página esté abierta
      }
    },
    borrar(clave: string) {
      try {
        localStorage.removeItem(`${prefijo}.${clave}`);
      } catch {
        // idem
      }
    },
  };
}

/** Los estilos, una vez por página: el metal y la tinta del sitio (decisión 0008). */
function ponerEstilos() {
  if (document.getElementById('mg-consola-estilos')) return;
  const estilo = document.createElement('style');
  estilo.id = 'mg-consola-estilos';
  estilo.textContent = `
    .mg-consola {
      position: absolute; left: 0; right: 0; top: 0; height: 46%; min-height: 12rem; z-index: 20;
      display: flex; flex-direction: column;
      background: rgb(18 16 13 / 0.94); border-bottom: 1px solid rgb(158 116 70 / 0.65);
      box-shadow: 0 12px 30px -12px rgb(0 0 0 / 0.9);
      font: 13px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace; color: #dcd2c3;
      transform: translateY(-105%); transition: transform 0.18s ease-out; visibility: hidden;
    }
    .mg-consola[data-abierta='si'] { transform: none; visibility: visible; }
    .mg-consola-registro { flex: 1; overflow-y: auto; padding: 0.6rem 0.9rem; white-space: pre-wrap; }
    .mg-consola-eco { color: #93d9c9; }
    .mg-consola-aviso { color: #e5c07b; }
    .mg-consola-error { color: #e88a7d; }
    .mg-consola-linea {
      display: flex; gap: 0.5rem; align-items: center; padding: 0.45rem 0.9rem;
      border-top: 1px solid rgb(158 116 70 / 0.35); color: #c4a06a;
    }
    .mg-consola-linea input {
      flex: 1; border: 0; outline: 0; background: transparent; color: #f3e9d8; font: inherit;
    }
    .mg-consola-boton {
      position: absolute; left: 12px; bottom: 12px; z-index: 21; padding: 0.3rem 0.65rem;
      border: 1px solid #24170a; border-radius: 0.35rem; cursor: pointer;
      background: linear-gradient(160deg, #3c2916, #553c24 55%, #3f2b17); color: #ead5b0;
      font: 700 13px/1.4 ui-monospace, Menlo, monospace; opacity: 0.8;
    }
    .mg-consola-boton:hover { opacity: 1; }
    @media (prefers-reduced-motion: reduce) { .mg-consola { transition: none; } }
  `;
  document.head.append(estilo);
}
