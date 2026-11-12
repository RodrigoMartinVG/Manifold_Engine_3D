import * as THREE from 'three';
import {
  ORBITAS_INICIALES,
  PASO,
  RADIO_CENTRO,
  RADIO_LAMINA,
  avanzar as avanzarOrbita,
  crearOrbita,
  potencial,
  type Orbita,
} from './orbitas';

/**
 * LA VITRINA DEL INICIO: un pozo de potencial con tres cuerpos en órbita, dentro de los anillos
 * de un instrumento (el ecuador con sus grados y la eclíptica, inclinada 23,44°).
 *
 * Es una escena chica de Three.js, solo del sitio (no es el motor), pero honesta: los cuerpos se
 * mueven con la misma física que se dibuja (orbitas.ts). La altura de cada punto de la lámina es
 * el potencial Φ(r), y los cuerpos caen por su pendiente: g = −∇Φ.
 */

const ESCALA_ALTURA = 0.34; // de potencial a metros: solo para dibujar
const LARGO_ESTELA = 200; // puntos (3,3 s)

/** La altura de la lámina a la distancia `r` del centro (0 en el borde). */
const altura = (r: number) => ESCALA_ALTURA * (potencial(r) - potencial(RADIO_LAMINA));

const VERDIN = new THREE.Color(0x93d9c9);
const VERDIN_OSCURO = new THREE.Color(0x10302b);
const BRONCE = 0x9a7246; // bronce viejo, sin brillo

/** El color y el tamaño de cada cuerpo, en el orden de ORBITAS_INICIALES. */
const ASPECTO = [
  { color: 0x93d9c9, radio: 0.075 },
  { color: 0xf0d59a, radio: 0.09 },
  { color: 0xd98a4e, radio: 0.1 },
];

interface Cuerpo extends Orbita {
  radio: number;
  malla: THREE.Mesh;
  estela: Float32Array;
  geometriaEstela: THREE.BufferGeometry;
}

export interface OpcionesVitrina {
  /** Se llama cada 10 cuadros con el número de paso de la simulación. */
  alPaso?: (paso: number) => void;
}

/** Monta la vitrina en `ventana` y dibuja el primer cuadro. Devuelve una función para detenerla. */
export function arrancarVitrina(ventana: HTMLElement, opciones: OpcionesVitrina = {}): () => void {
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); // líneas finas: más no se nota, y cuesta
  renderer.setClearColor(0x000000, 0); // transparente: atrás se ve el fondo del marco
  ventana.append(renderer.domElement);

  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(30, 1.5, 0.1, 60);
  const mundo = new THREE.Group(); // todo lo que gira despacio
  escena.add(mundo);

  escena.add(new THREE.HemisphereLight(0xfff1d6, 0x241a10, 1.1));
  const luz = new THREE.DirectionalLight(0xffe2b0, 2.2);
  luz.position.set(4, 6, 3);
  escena.add(luz);

  // ---------- La lámina: anillos y rayos que siguen la altura del potencial ----------
  {
    const posiciones: number[] = [];
    const colores: number[] = [];
    const color = new THREE.Color();
    const vertice = (r: number, a: number) => {
      posiciones.push(r * Math.cos(a), altura(r), r * Math.sin(a));
      // Más brillante adentro del pozo; hacia el borde se apaga.
      color.lerpColors(VERDIN_OSCURO, VERDIN, (1 - r / RADIO_LAMINA) ** 1.6);
      colores.push(color.r, color.g, color.b);
    };
    const R0 = 0.35;
    for (let i = 0; i < 14; i++) {
      const r = R0 + ((RADIO_LAMINA - R0) * i) / 13;
      for (let j = 0; j < 128; j++) {
        vertice(r, (j / 128) * 2 * Math.PI);
        vertice(r, ((j + 1) / 128) * 2 * Math.PI);
      }
    }
    for (let k = 0; k < 36; k++) {
      const a = (k / 36) * 2 * Math.PI;
      for (let j = 0; j < 32; j++) {
        vertice(R0 + ((RADIO_LAMINA - R0) * j) / 32, a);
        vertice(R0 + ((RADIO_LAMINA - R0) * (j + 1)) / 32, a);
      }
    }
    const geometria = new THREE.BufferGeometry();
    geometria.setAttribute('position', new THREE.Float32BufferAttribute(posiciones, 3));
    geometria.setAttribute('color', new THREE.Float32BufferAttribute(colores, 3));
    mundo.add(new THREE.LineSegments(geometria, new THREE.LineBasicMaterial({ vertexColors: true })));
  }

  // ---------- El cuerpo central, con un halo ----------
  const centro = new THREE.Mesh(
    new THREE.SphereGeometry(RADIO_CENTRO, 32, 20),
    new THREE.MeshStandardMaterial({ color: 0xc0915a, emissive: 0x4a2a0c, metalness: 0.45, roughness: 0.6 }),
  );
  centro.position.y = altura(0) + RADIO_CENTRO;
  mundo.add(centro);
  {
    const lienzo = document.createElement('canvas');
    lienzo.width = lienzo.height = 64;
    const g = lienzo.getContext('2d')!;
    const degradado = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    degradado.addColorStop(0, 'rgba(255, 214, 150, 0.9)');
    degradado.addColorStop(0.35, 'rgba(240, 170, 90, 0.25)');
    degradado.addColorStop(1, 'rgba(240, 170, 90, 0)');
    g.fillStyle = degradado;
    g.fillRect(0, 0, 64, 64);
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(lienzo),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    halo.scale.setScalar(1.9);
    halo.position.copy(centro.position);
    mundo.add(halo);
  }

  // ---------- Los anillos del instrumento ----------
  /** Una circunferencia en el plano XZ, con marcas cada 5° (más largas cada 30°) si se pide. */
  const anillo = (radio: number, marcas: boolean, opacidad: number) => {
    const p: number[] = [];
    for (let j = 0; j < 192; j++) {
      const a0 = (j / 192) * 2 * Math.PI;
      const a1 = ((j + 1) / 192) * 2 * Math.PI;
      p.push(radio * Math.cos(a0), 0, radio * Math.sin(a0), radio * Math.cos(a1), 0, radio * Math.sin(a1));
    }
    if (marcas) {
      for (let g = 0; g < 360; g += 5) {
        const a = (g * Math.PI) / 180;
        const largo = g % 30 === 0 ? 0.16 : 0.06;
        p.push(radio * Math.cos(a), 0, radio * Math.sin(a));
        p.push((radio + largo) * Math.cos(a), 0, (radio + largo) * Math.sin(a));
      }
    }
    const geometria = new THREE.BufferGeometry();
    geometria.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    return new THREE.LineSegments(
      geometria,
      new THREE.LineBasicMaterial({ color: BRONCE, transparent: true, opacity: opacidad }),
    );
  };
  mundo.add(anillo(3.3, true, 0.85));
  mundo.add(anillo(3.15, false, 0.35));
  const ecliptica = new THREE.Group();
  const anilloInclinado = anillo(3.05, true, 0.6);
  anilloInclinado.rotation.x = (23.44 * Math.PI) / 180; // la inclinación del eje de la Tierra
  ecliptica.add(anilloInclinado);
  escena.add(ecliptica);

  // ---------- Los cuerpos en órbita ----------
  const cuerpos: Cuerpo[] = ORBITAS_INICIALES.map(({ r, factor, fase }, i) => {
    const { color, radio } = ASPECTO[i]!;
    const orbita = crearOrbita(r, factor, fase);
    const malla = new THREE.Mesh(
      new THREE.SphereGeometry(radio, 20, 14),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.25, roughness: 0.45 }),
    );
    mundo.add(malla);
    const estela = new Float32Array(LARGO_ESTELA * 3);
    const geometriaEstela = new THREE.BufferGeometry();
    geometriaEstela.setAttribute('position', new THREE.BufferAttribute(estela, 3));
    // La estela se apaga hacia atrás: el color va de negro (lo más viejo) al del cuerpo. Con
    // mezcla ADITIVA (se suma a lo que hay atrás), el negro no se ve y la estela brilla sobre la lámina.
    const colores = new Float32Array(LARGO_ESTELA * 3);
    const c = new THREE.Color();
    const negro = new THREE.Color(0x000000);
    const brillante = new THREE.Color(color).multiplyScalar(1.4);
    for (let i = 0; i < LARGO_ESTELA; i++) {
      c.lerpColors(negro, brillante, (i / (LARGO_ESTELA - 1)) ** 1.3);
      colores.set([c.r, c.g, c.b], i * 3);
    }
    geometriaEstela.setAttribute('color', new THREE.BufferAttribute(colores, 3));
    const materialEstela = new THREE.LineBasicMaterial({
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const lineaEstela = new THREE.Line(geometriaEstela, materialEstela);
    lineaEstela.frustumCulled = false; // se mueve todo el tiempo: su esfera envolvente quedaría vieja
    mundo.add(lineaEstela);
    const cuerpo: Cuerpo = { ...orbita, radio, malla, estela, geometriaEstela };
    for (let j = 0; j < LARGO_ESTELA; j++) ponerEnEstela(cuerpo, j, orbita.x, orbita.z);
    return cuerpo;
  });

  function ponerEnEstela(c: Cuerpo, i: number, x: number, z: number) {
    c.estela[i * 3] = x;
    c.estela[i * 3 + 1] = altura(Math.hypot(x, z)) + 0.015;
    c.estela[i * 3 + 2] = z;
  }

  // ---------- La simulación: un paso fijo ----------
  let paso = 0;
  function avanzar() {
    for (const c of cuerpos) {
      avanzarOrbita(c);
      c.estela.copyWithin(0, 3); // la estela corre un lugar...
      ponerEnEstela(c, LARGO_ESTELA - 1, c.x, c.z); // ...y el punto nuevo va al final
    }
    paso++;
  }

  function dibujar(alfa: number) {
    for (const c of cuerpos) {
      const x = c.xAntes + (c.x - c.xAntes) * alfa;
      const z = c.zAntes + (c.z - c.zAntes) * alfa;
      c.malla.position.set(x, altura(Math.hypot(x, z)) + c.radio, z);
      ponerEnEstela(c, LARGO_ESTELA - 1, x, z); // la punta de la estela, pegada al cuerpo
      c.geometriaEstela.attributes.position!.needsUpdate = true;
    }
    renderer.render(escena, camara);
  }

  // El estado del bucle (más abajo).
  let corriendo = false;
  let pedido = 0;
  let anterior = 0;
  let acumulador = 0;
  let cuadros = 0;

  // ---------- La cámara y el tamaño ----------
  const MIRA = new THREE.Vector3(0, -0.25, 0);
  const ELEVACION = (25 * Math.PI) / 180;
  let distancia = 9;
  let inclinacion = 0; // lo que el puntero mueve la cámara (en radianes)
  let inclinacionDeseada = 0;
  const ubicarCamara = () => {
    const e = ELEVACION + inclinacion * 0.4;
    camara.position.set(
      Math.sin(inclinacion) * distancia * Math.cos(e),
      Math.sin(e) * distancia,
      Math.cos(inclinacion) * distancia * Math.cos(e),
    );
    camara.lookAt(MIRA);
  };
  const ajustar = () => {
    const ancho = Math.max(1, ventana.clientWidth);
    const alto = Math.max(1, ventana.clientHeight);
    renderer.setSize(ancho, alto, false);
    camara.aspect = ancho / alto;
    // Que entre todo a lo ancho: si la vitrina es más angosta, la cámara se aleja.
    distancia = Math.max(8.6, 3.75 / (Math.tan((camara.fov * Math.PI) / 360) * camara.aspect));
    camara.updateProjectionMatrix();
    ubicarCamara();
  };
  const alCambiarTamano = new ResizeObserver(() => {
    ajustar();
    if (quieto || !corriendo) dibujar(1);
  });
  alCambiarTamano.observe(ventana);
  ajustar();

  // Unos segundos de simulación antes de mostrar nada: así las estelas ya están dibujadas.
  for (let i = 0; i < LARGO_ESTELA; i++) avanzar();
  dibujar(1);

  // ---------- El bucle: solo mientras la vitrina se ve ----------
  const cuadro = (ahora: number) => {
    pedido = requestAnimationFrame(cuadro);
    const dt = Math.min((ahora - anterior) / 1000, 0.25);
    anterior = ahora;
    acumulador += dt;
    for (let n = 0; acumulador >= PASO; n++) {
      if (n === 5) {
        acumulador = 0; // muy atrasado (la pestaña durmió): no se intenta alcanzar
        break;
      }
      avanzar();
      acumulador -= PASO;
    }
    mundo.rotation.y += dt * ((2 * Math.PI) / 240); // una vuelta cada 4 minutos
    ecliptica.rotation.y -= dt * ((2 * Math.PI) / 90);
    inclinacion += (inclinacionDeseada - inclinacion) * Math.min(1, dt * 3);
    ubicarCamara();
    dibujar(acumulador / PASO);
    if (++cuadros % 10 === 0) {
      ventana.dataset.cuadros = String(cuadros);
      opciones.alPaso?.(paso);
    }
  };
  const seguir = (si: boolean) => {
    if (si === corriendo || quieto) return;
    corriendo = si;
    if (si) {
      anterior = performance.now();
      pedido = requestAnimationFrame(cuadro);
    } else cancelAnimationFrame(pedido);
  };
  const alVer = new IntersectionObserver((entradas) => seguir(entradas.some((e) => e.isIntersecting)));
  alVer.observe(ventana);

  // El puntero inclina un poco la cámara: se nota que es 3D de verdad.
  const alMover = (e: PointerEvent) => {
    const caja = ventana.getBoundingClientRect();
    inclinacionDeseada = ((e.clientX - caja.left) / caja.width - 0.5) * 0.5;
  };
  const alSalir = () => (inclinacionDeseada = 0);
  ventana.addEventListener('pointermove', alMover);
  ventana.addEventListener('pointerleave', alSalir);

  opciones.alPaso?.(paso);
  return () => {
    seguir(false);
    alVer.disconnect();
    alCambiarTamano.disconnect();
    ventana.removeEventListener('pointermove', alMover);
    ventana.removeEventListener('pointerleave', alSalir);
    renderer.dispose();
    renderer.domElement.remove();
  };
}
