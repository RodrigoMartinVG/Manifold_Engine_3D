import * as THREE from 'three';
import type { Quat, Vec3 } from '@manifold/comun';
import { declararAyudas, type Mensaje, type Registro } from '@manifold/comandos';
import { huella, Partida, registroDe, Reloj, type Cartucho, type Entidad, type IdEntidad, type Mundo } from '@manifold/nucleo';
import { montarConsola, type Consola, type OpcionesConsola } from './consola';

/** Una receta para empezar, y de dónde viene (para los avisos: "la receta del enlace…"). */
export interface RecetaInicial {
  de: string;
  texto: string;
}

export interface OpcionesMontaje {
  /**
   * Las recetas con que nace el mundo, en orden (la de la sala, la del enlace…): las junta el
   * JUEGO, que sabe de dónde vienen (decisión 0010). La presentación no lee la dirección.
   */
  recetas?: readonly RecetaInicial[];
  /** Si el juego monta la consola, y cómo. Cada juego decide (decisión 0010). */
  consola?: OpcionesConsola | false;
}

export interface Montaje {
  readonly registro: Registro<Mundo>;
  /** La partida actual (cambia al reiniciar). */
  readonly partida: Partida;
  readonly consola: Consola | null;
  /** Vuelve a crear el mundo, con los valores actuales del registro. */
  reiniciar(): void;
  /** Para de dibujar y libera la GPU (al salir de la página, o en las pruebas). */
  detener(): void;
}

/** La pose de una entidad en el paso anterior: se dibuja a mitad de camino entre esa y la actual. */
interface Pose {
  posicion: Vec3;
  rotacion: Quat;
}

/**
 * EL CLIENTE: monta un cartucho en un elemento de la página y lo hace andar.
 *
 * En cada cuadro de la pantalla:
 *   1. el reloj dice cuántos pasos fijos tocan (paso 1 de la V1: la simulación no depende de los FPS);
 *   2. antes de cada paso se guarda la pose de cada cosa (la "anterior");
 *   3. la partida avanza;
 *   4. se dibuja cada cosa entre su pose anterior y la actual, según `alfa` (interpolar).
 *
 * La presentación LEE el mundo y nunca lo escribe: lo que se ve es una consecuencia de la
 * simulación, no al revés. Lo que se puede cambiar de la vista lo declara aquí (`ver.*`,
 * `vista.*`), y el juego decide si monta una consola para tocarlo (decisión 0010).
 *
 * `contenedor` tiene que estar posicionado (`position` fixed, absolute o relative): las
 * estadísticas y la consola se dibujan encima, adentro de él.
 */
export function montar(cartucho: Cartucho, contenedor: HTMLElement, o: OpcionesMontaje = {}): Montaje {
  const registro = registroDe(cartucho);

  // Resolución 1× (una gráfica integrada, como la Iris Plus, sufre con 2×: cuatro veces más píxeles).
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  contenedor.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14161c);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 200);
  camera.position.set(3.2, 2.4, 4.2);
  camera.lookAt(0, 1, 0);
  scene.add(new THREE.HemisphereLight(0xc8d4ff, 0x3a3028, 1.4));
  const sol = new THREE.DirectionalLight(0xfff2e0, 1.8);
  sol.position.set(4, 8, 3);
  scene.add(sol);
  scene.add(new THREE.GridHelper(20, 20, 0x3a4050, 0x262a33));
  const ejes = new THREE.AxesHelper(3);
  ejes.visible = false;
  scene.add(ejes);

  const ajustarTamano = () => {
    const ancho = Math.max(1, contenedor.clientWidth);
    const alto = Math.max(1, contenedor.clientHeight);
    renderer.setSize(ancho, alto);
    camera.aspect = ancho / alto;
    camera.updateProjectionMatrix();
  };
  const observador = new ResizeObserver(ajustarTamano);
  observador.observe(contenedor);
  ajustarTamano();

  // ---------- Las estadísticas (ver.estadisticas): el paso, la huella, los cuadros por segundo ----------
  const estadisticas = document.createElement('div');
  estadisticas.className = 'mg-estadisticas';
  estadisticas.hidden = true;
  Object.assign(estadisticas.style, {
    position: 'absolute',
    top: '12px',
    right: '12px',
    padding: '6px 10px',
    borderRadius: '6px',
    background: 'rgb(18 16 13 / 0.82)',
    color: '#e6dccb',
    font: '12px/1.5 ui-monospace, Menlo, monospace',
    pointerEvents: 'none',
    whiteSpace: 'pre',
  });
  contenedor.append(estadisticas);

  // El mundo y sus mallas (antes que nada: una receta puede pedir ver.triangulos, que las recorre).
  const mallas = new Map<IdEntidad, THREE.Mesh>();
  const anteriores = new Map<IdEntidad, Pose>();
  const geometriaCaja = new THREE.BoxGeometry(1, 1, 1);
  let partida: Partida;
  let reloj = new Reloj();

  // ---------- Lo que la vista deja cambiar (decisión 0010: alcance "vista") ----------
  let triangulos = false;
  let lento = 1;
  let pausa = false;
  registro.declararVariable({
    nombre: 'ver.triangulos',
    descripcion: { es: 'Las mallas como alambre: los triángulos que dibuja la placa de video.' },
    alcance: 'vista',
    tipo: { tipo: 'booleano' },
    porDefecto: false,
    alCambiar(v) {
      triangulos = v === true;
      for (const malla of mallas.values()) (malla.material as THREE.MeshLambertMaterial).wireframe = triangulos;
    },
  });
  registro.declararVariable({
    nombre: 'ver.ejes',
    descripcion: { es: 'Los ejes del mundo en el origen: x rojo, y verde, z azul (3 metros).' },
    alcance: 'vista',
    tipo: { tipo: 'booleano' },
    porDefecto: false,
    alCambiar: (v) => (ejes.visible = v === true),
  });
  registro.declararVariable({
    nombre: 'ver.estadisticas',
    descripcion: { es: 'El paso, la huella del mundo, las cosas que hay y los cuadros por segundo.' },
    alcance: 'vista',
    tipo: { tipo: 'booleano' },
    porDefecto: false,
    alCambiar: (v) => (estadisticas.hidden = v !== true),
  });
  registro.declararVariable({
    nombre: 'vista.lento',
    descripcion: {
      es: 'Mostrar el mundo más lento (0.2) o más rápido (2). El mundo avanza igual, de a pasos fijos: no cambia la física ni la huella.',
    },
    alcance: 'vista',
    tipo: { tipo: 'numero', min: 0.05, max: 4 },
    porDefecto: 1,
    alCambiar: (v) => (lento = Number(v)),
  });
  registro.declararVariable({
    nombre: 'vista.pausa',
    descripcion: { es: 'Detener el mundo (con "paso" se avanza de a uno).' },
    alcance: 'vista',
    tipo: { tipo: 'booleano' },
    porDefecto: false,
    alCambiar: (v) => (pausa = v === true),
  });
  registro.declararComando({
    nombre: 'pausa',
    descripcion: { es: 'Detiene o reanuda el mundo (lo mismo que alternar vista.pausa).' },
    ejecutar: (_, salida) => {
      for (const m of registro.ejecutar(`vista.pausa ${pausa ? 'no' : 'si'}`)) salida.escribir(m.texto, m.nivel);
    },
  });
  registro.declararComando({
    nombre: 'paso',
    descripcion: { es: 'Avanza el mundo n pasos (1, si no se dice), y lo deja en pausa.' },
    argumentos: [{ nombre: 'n', tipo: { tipo: 'entero', min: 1, max: 600 }, opcional: true }],
    ejecutar: ([n], salida) => {
      registro.ejecutar('vista.pausa si');
      for (let i = 0; i < (typeof n === 'number' ? n : 1); i++) avanzar();
      salida.escribir(`paso ${partida.mundo.tick}`);
    },
  });
  registro.declararComando({
    nombre: 'huella',
    descripcion: { es: 'El paso del mundo y su huella: un número que resume todo su estado.' },
    ejecutar: (_, salida) => salida.escribir(`paso ${partida.mundo.tick} · huella ${hex(huella(partida.mundo))}`),
  });
  registro.declararComando({
    nombre: 'reiniciar',
    descripcion: { es: 'El mundo vuelve a empezar, con los valores actuales.' },
    ejecutar: (_, salida) => {
      reiniciar();
      salida.escribir('el mundo volvió a empezar');
    },
  });

  // ---------- La consola, si el juego la monta ----------
  const consola = o.consola ? montarConsola(contenedor, registro, o.consola, { reiniciar: () => reiniciar() }) : null;
  if (consola) declararAyudas(registro);

  // ---------- Las recetas con que nace el mundo (la de inicio, si hay consola; después, las del juego) ----------
  const recetas = [
    ...(consola?.recetaDeInicio() ? [{ de: 'tu receta de inicio', texto: consola.recetaDeInicio()! }] : []),
    ...(o.recetas ?? []),
  ];
  for (const receta of recetas) avisar(receta.de, registro.ejecutar(receta.texto, 'receta'));

  function avisar(de: string, mensajes: Mensaje[]) {
    const errores = mensajes.filter((m) => m.nivel === 'error');
    if (!errores.length) return;
    const titulo = `${de}: ${errores.length === 1 ? 'una línea no se entendió' : `${errores.length} líneas no se entendieron`}`;
    if (consola) {
      consola.escribir(titulo, 'aviso');
      for (const e of errores) consola.escribir(`  ${e.texto}`, 'aviso');
    } else console.warn([titulo, ...errores.map((e) => e.texto)].join('\n'));
  }

  // ---------- El mundo y sus mallas ----------

  const crearMalla = (e: Entidad) => {
    // Una sola vez por entidad. (Error encontrado en el paso 0: las que puso el cartucho al
    // empezar llegaban DOS veces, al recorrer el mundo y por su evento `entidadCreada`; la
    // segunda malla tapaba a la primera en el registro, y la primera quedaba en la escena,
    // olvidada en el origen.)
    if (!e.apariencia || !e.transformacion || mallas.has(e.id)) return;
    const malla = new THREE.Mesh(
      geometriaCaja,
      new THREE.MeshLambertMaterial({ color: e.apariencia.color, wireframe: triangulos }),
    );
    malla.scale.set(...e.apariencia.tamano);
    scene.add(malla);
    mallas.set(e.id, malla);
  };
  const quitarMalla = (id: IdEntidad) => {
    const malla = mallas.get(id);
    if (malla) {
      scene.remove(malla);
      (malla.material as THREE.Material).dispose();
    }
    mallas.delete(id);
    anteriores.delete(id);
  };
  const guardarAnteriores = () => {
    for (const e of partida.mundo.entidades.values()) {
      if (!e.transformacion) continue;
      anteriores.set(e.id, { posicion: [...e.transformacion.posicion], rotacion: [...e.transformacion.rotacion] });
    }
  };

  /** Crea el mundo (al empezar, y al reiniciar), con los valores actuales del registro. */
  function iniciarPartida() {
    for (const id of [...mallas.keys()]) quitarMalla(id);
    partida = new Partida(cartucho, { registro });
    partida.mundo.tomarEventos(); // los de su creación: sus mallas se crean recorriendo el mundo
    for (const e of partida.mundo.entidades.values()) crearMalla(e);
    guardarAnteriores();
    reloj = new Reloj();
  }
  function reiniciar() {
    iniciarPartida();
  }
  iniciarPartida();
  // Desde ahora, cambiar algo de arranque (desde la consola) hace que el mundo vuelva a empezar.
  registro.alCambiarArranque = reiniciar;

  function avanzar() {
    guardarAnteriores();
    partida.paso();
  }

  const qa = new THREE.Quaternion();
  const qb = new THREE.Quaternion();
  let ultimo = performance.now();
  let cuadros = 0;
  let pedido = 0;
  let cuadrosDesde = performance.now();
  let cuadrosEnElSegundo = 0;
  let porSegundo = 0;

  const cuadro = (ahora: number) => {
    pedido = requestAnimationFrame(cuadro);
    const dt = (ahora - ultimo) / 1000;
    ultimo = ahora;
    const pasos = pausa ? 0 : reloj.avanzar(dt * lento);
    for (let i = 0; i < pasos; i++) avanzar();
    const mundo = partida.mundo;
    for (const ev of mundo.tomarEventos()) {
      if (ev.tipo === 'entidadCreada') {
        const e = mundo.entidades.get(ev.id);
        if (e) crearMalla(e);
      }
      if (ev.tipo === 'entidadQuitada') quitarMalla(ev.id);
    }
    const alfa = pausa ? 1 : reloj.alfa;
    for (const [id, malla] of mallas) {
      const t = mundo.entidades.get(id)?.transformacion;
      const antes = anteriores.get(id) ?? t;
      if (!t || !antes) continue;
      malla.position.set(...antes.posicion).lerp(new THREE.Vector3(...t.posicion), alfa);
      malla.quaternion.slerpQuaternions(qa.set(...antes.rotacion), qb.set(...t.rotacion), alfa);
    }
    renderer.render(scene, camera);
    cuadrosEnElSegundo++;
    if (ahora - cuadrosDesde >= 1000) {
      porSegundo = Math.round((cuadrosEnElSegundo * 1000) / (ahora - cuadrosDesde));
      cuadrosEnElSegundo = 0;
      cuadrosDesde = ahora;
    }
    // Para las pruebas en el navegador (Playwright): cuántos cuadros se dibujaron y cuántas
    // mallas hay de verdad en la escena (no en el registro: ahí no se veía el error de arriba).
    if (++cuadros % 10 === 0) {
      contenedor.dataset.cuadros = String(cuadros);
      contenedor.dataset.mallas = String(scene.children.filter((o) => o instanceof THREE.Mesh).length);
      contenedor.dataset.paso = String(mundo.tick);
      if (!estadisticas.hidden)
        estadisticas.textContent = [
          `paso ${mundo.tick}${pausa ? ' (en pausa)' : ''}`,
          `huella ${hex(huella(mundo))}`,
          `${mundo.entidades.size} cosas · ${porSegundo} cuadros/s`,
          lento !== 1 ? `vista ${lento}×` : '',
        ]
          .filter(Boolean)
          .join('\n');
    }
  };
  pedido = requestAnimationFrame(cuadro);

  return {
    registro,
    get partida() {
      return partida;
    },
    consola,
    reiniciar,
    detener() {
      cancelAnimationFrame(pedido);
      observador.disconnect();
      consola?.detener();
      renderer.dispose();
      renderer.domElement.remove();
      estadisticas.remove();
    },
  };
}

const hex = (n: number) => n.toString(16).padStart(8, '0');
