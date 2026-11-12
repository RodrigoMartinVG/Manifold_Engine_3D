# 0004. El estado del mundo como datos planos

- **Estado:** aceptada (se completa en la fase 1, con la física)
- **Fecha:** 2026-11-11

## Contexto

En la V1, el estado estaba repartido en clases con objetos adentro (vectores de Three.js, cuerpos de Rapier, referencias entre objetos). Funcionaba, pero "sacar una foto del mundo" (para guardar la partida en cualquier momento, volver atrás o compartir un experimento) quedó afuera en el paso 16k: había que juntar a mano el estado de cada sistema.

Medido sobre la V1: la foto que Rapier saca de su propio mundo pesa 244 KB en el mapa principal (710 colliders), se saca en 0,75 ms y se restaura en 3 ms. Y **restaurarla crea un mundo de Rapier nuevo**: todo lo que guardara una referencia a un cuerpo queda apuntando al mundo viejo.

## Decisión

- **Todo el estado de la simulación vive en `Mundo`**: el reloj, el contador de ids, el azar (con su estado legible y restaurable) y las entidades.
- **Una entidad es un id y componentes**: objetos planos de números, textos y tuplas. Sin clases, sin métodos, sin objetos de Three.js ni de Rapier.
- **Vectores y cuaterniones son tuplas** (`[x, y, z]`, `[x, y, z, w]`), con una matemática mínima propia en `comun`. Así el núcleo no depende de Three.js (que es de la presentación).
- **Fase 1 (física):** las entidades guardan el **identificador** de su cuerpo de Rapier, nunca el cuerpo; el cuerpo se busca por identificador cuando hace falta.
- **La huella** (`huella(mundo)`) resume todo el estado en un número, para comprobar el determinismo paso a paso.

## Consecuencias

- Una foto del mundo es "los componentes, más la foto de Rapier, más el estado del azar"; compararlos o mandarlos por la red no requiere convertir nada.
- Escribir la matemática a mano cuesta (y hay que probarla); a cambio, se entiende cada cuenta.
- Las tuplas se crean y se descartan seguido: en los bucles calientes se usarán funciones que escriban en una tupla existente, cuando el medidor lo pida.

## Alternativas descartadas

- **Usar la matemática de Three.js en el núcleo** (como la V1, que permitía solo sus clases matemáticas): ataba el núcleo a Three.js y metía objetos con métodos en el estado.
- **Una librería de ECS** (como bitecs): pensada para miles de entidades con datos contiguos; aquí son decenas, Rapier ya guarda la física, y se lee peor para aprender. Se puede revisar si alguna vez son miles.
