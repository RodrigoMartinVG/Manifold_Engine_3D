import * as THREE from 'three';

/**
 * Lo de siempre, en un módulo aparte: renderer, escena, cámara, luces, piso y el bucle.
 * Así `main.ts` queda solo con lo que importa de la lección.
 */
export function crearEscena() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  document.body.append(renderer.domElement);

  const escena = new THREE.Scene();
  escena.background = new THREE.Color(0x14161c);
  const camara = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
  camara.position.set(4, 3, 6);
  camara.lookAt(0, 0.8, 0);
  escena.add(new THREE.HemisphereLight(0xc8d4ff, 0x3a3028, 1.2));
  const sol = new THREE.DirectionalLight(0xffffff, 2);
  sol.position.set(3, 6, 2);
  escena.add(sol);
  escena.add(new THREE.GridHelper(10, 10, 0x3a4050, 0x262a33));

  const ajustar = () => {
    renderer.setSize(innerWidth, innerHeight);
    camara.aspect = innerWidth / innerHeight;
    camara.updateProjectionMatrix();
  };
  addEventListener('resize', ajustar);
  ajustar();

  /** Llama a `actualizar` en cada cuadro con los segundos desde el anterior, y dibuja. */
  function alCuadro(actualizar: (dt: number) => void) {
    let antes = performance.now();
    const cuadro = (ahora: number) => {
      actualizar(Math.min(0.25, (ahora - antes) / 1000));
      antes = ahora;
      renderer.render(escena, camara);
      requestAnimationFrame(cuadro);
    };
    requestAnimationFrame(cuadro);
  }

  return { renderer, escena, camara, alCuadro };
}
