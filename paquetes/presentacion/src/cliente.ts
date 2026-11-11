import * as THREE from 'three';
import type { Quat, Vec3 } from '@manifold/comun';
import { Partida, Reloj, type Cartucho, type Entidad, type IdEntidad } from '@manifold/nucleo';

export interface OpcionesMontaje {
  /** La semilla del mundo (por defecto, `?semilla=` de la dirección, o 1). */
  semilla?: number;
}

export interface Montaje {
  readonly partida: Partida;
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
 * simulación, no al revés.
 */
export function montar(cartucho: Cartucho, contenedor: HTMLElement, o: OpcionesMontaje = {}): Montaje {
  const parametros = new URLSearchParams(location.search);
  const semilla = o.semilla ?? (Number(parametros.get('semilla')) || 1);
  const partida = new Partida(cartucho, { semilla, opciones: new Map(parametros) });
  const mundo = partida.mundo;

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

  const mallas = new Map<IdEntidad, THREE.Mesh>();
  const anteriores = new Map<IdEntidad, Pose>();
  const geometriaCaja = new THREE.BoxGeometry(1, 1, 1);
  const crearMalla = (e: Entidad) => {
    // Una sola vez por entidad. (Error encontrado en el paso 0: las que puso el cartucho al
    // empezar llegaban DOS veces, al recorrer el mundo y por su evento `entidadCreada`; la
    // segunda malla tapaba a la primera en el registro, y la primera quedaba en la escena,
    // olvidada en el origen.)
    if (!e.apariencia || !e.transformacion || mallas.has(e.id)) return;
    const malla = new THREE.Mesh(geometriaCaja, new THREE.MeshLambertMaterial({ color: e.apariencia.color }));
    malla.scale.set(...e.apariencia.tamano);
    scene.add(malla);
    mallas.set(e.id, malla);
  };
  for (const e of mundo.entidades.values()) crearMalla(e);

  const guardarAnteriores = () => {
    for (const e of mundo.entidades.values()) {
      if (!e.transformacion) continue;
      anteriores.set(e.id, { posicion: [...e.transformacion.posicion], rotacion: [...e.transformacion.rotacion] });
    }
  };
  guardarAnteriores();

  const reloj = new Reloj();
  const qa = new THREE.Quaternion();
  const qb = new THREE.Quaternion();
  let ultimo = performance.now();
  let cuadros = 0;
  let pedido = 0;

  const cuadro = (ahora: number) => {
    pedido = requestAnimationFrame(cuadro);
    const dt = (ahora - ultimo) / 1000;
    ultimo = ahora;
    const pasos = reloj.avanzar(dt);
    for (let i = 0; i < pasos; i++) {
      guardarAnteriores();
      partida.paso();
    }
    for (const ev of mundo.tomarEventos()) {
      if (ev.tipo === 'entidadCreada') crearMalla(mundo.entidades.get(ev.id)!);
      if (ev.tipo === 'entidadQuitada') {
        const malla = mallas.get(ev.id);
        if (malla) scene.remove(malla);
        mallas.delete(ev.id);
        anteriores.delete(ev.id);
      }
    }
    const alfa = reloj.alfa;
    for (const [id, malla] of mallas) {
      const t = mundo.entidades.get(id)?.transformacion;
      const antes = anteriores.get(id);
      if (!t || !antes) continue;
      malla.position.set(...antes.posicion).lerp(new THREE.Vector3(...t.posicion), alfa);
      malla.quaternion.slerpQuaternions(qa.set(...antes.rotacion), qb.set(...t.rotacion), alfa);
    }
    renderer.render(scene, camera);
    // Para las pruebas en el navegador (Playwright): cuántos cuadros se dibujaron y cuántas
    // mallas hay de verdad en la escena (no en el registro: ahí no se veía el error de arriba).
    if (++cuadros % 10 === 0) {
      contenedor.dataset.cuadros = String(cuadros);
      contenedor.dataset.mallas = String(scene.children.filter((o) => o instanceof THREE.Mesh).length);
    }
  };
  pedido = requestAnimationFrame(cuadro);

  return {
    partida,
    detener() {
      cancelAnimationFrame(pedido);
      observador.disconnect();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
