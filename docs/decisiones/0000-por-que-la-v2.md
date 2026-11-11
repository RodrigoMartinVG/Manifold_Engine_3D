# 0000. Por qué la V2, y qué tomamos de los borradores y de la V1

- **Estado:** aceptada
- **Fecha:** 2026-11-11

## Contexto

La V1 fue un shooter en 3D que creció paso a paso durante unos 30 pasos: física con Rapier, armas, una hormiga que trepa, autos, una cinta de Möbius, red con predicción, niveles como archivos, mecanismos y señales lógicas, rompibles, superficies, luz simulada, IA que usa el mundo, repeticiones y tres juegos sobre el mismo motor (unas 20.800 líneas y 169 pruebas). Varias veces hubo que frenar para rehacer cimientos que habían quedado chicos (los pasos 10c, 14b, 16c, 16d, 16k).

Antes de empezar la V2 se analizaron dos borradores:

- **Propuesta de arquitectura del motor desde cero:** un plano técnico detallado (capas, paso fijo en diez fases, catálogo de 20 capacidades, red binaria, plan en seis fases).
- **Evaluación estratégica:** una revisión de la propuesta que pide achicar el alcance, definir el determinismo con honestidad y demostrar antes de prometer.

## Decisión

**La V2 se construye de cero**: código y pruebas nuevos. De la V1 no se copia código; se traen **lecciones**, la mayoría medidas. Las que se vuelven reglas desde el día 0:

1. **Todo el estado vive en el mundo** (ids, azar, reloj): en la V1, el contador de ids y el azar globales hacían que dos simulaciones se robaran números.
2. **La simulación no toca la pantalla**, y lo vigila el compilador (0003).
3. **El motor recibe juegos como cartuchos** y nunca los importa (mecanismo y política). El **Dojo** existe desde el primer día.
4. **Los niveles son datos** y **la gravedad es un campo**, no una constante.
5. **Determinismo medido**: una huella del estado por paso.
6. **Un esqueleto de red temprano** (fase 1), aunque la red completa venga después. La propuesta la ponía en la fase 5, contra su propia regla de "sin retrabajo". En la V1, la red del paso 8 dio forma a todo.
7. **Medir antes de afirmar**: cada número de rendimiento con su escenario.

### De la propuesta de arquitectura

**Se toma:** las tres capas (núcleo sin pantalla, presentación, juegos) y el servidor como paquete; el Dojo como consumidor; el nivel como dato; la gravedad como campo; un orden explícito de fases del paso; el protocolo para absorber capacidades nuevas ("de sustantivo narrativo a mecanismo", con requisitos de admisión); la física cosmética separada de la que decide; los arquetipos como datos; los ganchos para filtrar daño y traducir las teclas; las plataformas giratorias; las aristas de navegación que requieren una capacidad; la postura y el ruido del material en el sigilo; los volúmenes de golpe barridos; el escenario de rendimiento concreto del paso 1.1.

**Se corrige** (contra lo medido en la V1):

| Propone                                                                     | Lo que sabemos                                                                                                                                                                                                                                               | Entonces                                                                                                                                                                   |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Construir cada subsistema una sola vez, en su forma definitiva"            | Lo más importante se descubrió construyendo y midiendo: el controlador de personaje se traba sobre cuerpos cinemáticos; Rapier divide cada paso en 4 subpasos; los efectos de postproceso no servían con sus valores de fábrica                              | Invariantes desde el día 0; todo lo demás, incremental                                                                                                                     |
| En calidad baja, 4 luces asignadas cada cuadro a las lámparas más cercanas  | Es lo que falló en la V1 (las lámparas dejaban de alumbrar según dónde uno estaba)                                                                                                                                                                           | Una luz por lámpara, decidida al cargar                                                                                                                                    |
| Una foto del mundo entero por paso, para la red                             | Medido en el mapa principal de la V1: **244 KB por foto, 0,75 ms para sacarla y 3 ms para restaurarla** (un paso cuesta 0,79 ms). Y restaurar crea **un mundo de Rapier nuevo**                                                                              | Fotos para guardar o bifurcar, de vez en cuando; la red reconcilia re-simulando solo lo propio. Las entidades guardan identificadores de cuerpos, nunca los cuerpos (0004) |
| Puertas como cuerpos fijos                                                  | Una puerta fija que se reubica no empuja: atraviesa. En la V1 las puertas eran cinemáticas a propósito                                                                                                                                                       | Puertas cinemáticas; plataformas fijas                                                                                                                                     |
| Vaciar los eventos en cada paso                                             | Con dos pasos en un cuadro, la presentación pierde los del primero                                                                                                                                                                                           | Dos lectores: el juego por paso, la presentación por cuadro                                                                                                                |
| Posiciones de red en `Int16` cada 2 mm                                      | Alcanza para ±65 m; el mapa de la V1 llegaba a 171 m                                                                                                                                                                                                         | Elegir la escala con el tamaño del mundo                                                                                                                                   |
| Transporte paralelo limitado por la distancia recorrida                     | Quieto, nunca gira; con un "arriba" opuesto, el eje queda indefinido (el error del giro de 180° de la V1)                                                                                                                                                    | Prever el caso quieto y el opuesto                                                                                                                                         |
| El auto con alerones recorre la cinta de Möbius "con el acelerador a fondo" | En un tramo convexo con la gravedad hacia afuera, N = m·g_c + (k − m/ρ)·v² ≥ 0: la carga (k·v²) y la centrífuga (m·v²/ρ) crecen igual con v². Si k < m/ρ, no hay velocidad que alcance. Con 900 kg y curvas de 8 m, k > 112 kg/m (un Fórmula 1 tiene unos 3) | Möbius como experimento que muestra esa condición                                                                                                                          |
| Fricción combinada con la raíz del producto                                 | Rapier combina por promedio, mínimo, producto o máximo                                                                                                                                                                                                       | Usar las reglas de Rapier                                                                                                                                                  |
| Un presupuesto de simulación de 2,5 ms                                      | Medido: 0,1 a 0,8 ms por paso                                                                                                                                                                                                                                | Medir                                                                                                                                                                      |
| El tipo de cuerpo como una capacidad más                                    | Un personaje (controlador cinemático) y un vehículo (cuerpo dinámico) son bases físicas distintas                                                                                                                                                            | Las capacidades declaran sobre qué cuerpo funcionan                                                                                                                        |

**Se posterga** hasta que un juego lo pida: parkour completo, combate cuerpo a cuerpo con combos, desmembramiento (pide un collider por miembro), química elemental, fluidos, iluminación agrupada, reflejos en pantalla, red binaria, editor visual de capacidades.

### De la evaluación estratégica

**Se toma:** un núcleo chico y demostrable antes que muchas funciones; las capacidades necesitan un **protocolo de composición** (aquí: un modo de locomoción excluyente más contribuciones que se suman, resueltas en un solo lugar); definir **qué determinismo** prometemos (en el mismo programa, sí; entre navegadores, no está garantizado: el estándar de JavaScript no obliga a que `Math.sin` dé lo mismo en todos); separar **gravedad, superficie de soporte y adherencia**; **esfera antes que cubo**; un **laboratorio de física visual** (vectores, fuerzas, contactos); **experimentos reproducibles**; un **formato de mundo versionado**; Rapier detrás de una frontera chica; y las **demostraciones** como hitos de cada fase.

**Se posterga:** comunidad y extensiones, editor visual de capacidades, la línea de investigación (interesante, pero necesita una pregunta acotada).

**Se discrepa:** que la red pueda esperar hasta el final (ver la regla 6).

### Lo que faltaba en los dos

La **plataforma web** (inicio, el proyecto, el tutorial, el Dojo y los juegos) y la **forma de trabajo profesional** (git, integración continua, pruebas en el navegador): decisiones 0001, 0002 y 0005.

## Consecuencias

- Empezar de cero es más lento al principio; a cambio, cada pieza se entiende y queda en el tutorial.
- Las lecciones de la V1 están aquí, con sus números, para no volver a descubrirlas.

## Alternativas descartadas

- **Seguir con la V1**: la estructura arrastraba las deudas de crecer sin saber adónde.
- **Reescribir portando módulos de la V1 con sus pruebas**: más rápido, pero se saltaba el aprendizaje y traía la forma vieja. Se descartó a pedido del autor.
