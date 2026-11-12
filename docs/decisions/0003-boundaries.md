# 0003. Las fronteras entre capas, vigiladas por el compilador y el linter

- **Estado:** aceptada
- **Fecha:** 2026-11-11

## Contexto

La simulación tiene que correr igual en el navegador, en un servidor y en las pruebas. En la V1 la frontera la cuidaba una prueba que buscaba palabras en el código ("document", "THREE.Mesh"); antes de existir esa prueba, la frontera se cruzó (la "deuda de las mallas" del paso 10c).

## Decisión

Tres guardias, de la más fuerte a la más débil:

1. **El compilador.** `paquetes/comun` y `paquetes/nucleo` compilan **sin la librería DOM** (`"lib": ["ES2023"]`, `"types": []`). Escribir `document`, `window` o `HTMLElement` en la simulación **no compila**.
2. **El linter** (`eslint.config.js`, `no-restricted-imports`):
   - `comun` no importa nada del proyecto, ni Three.js;
   - `nucleo` no importa Three.js, ni la presentación, ni un juego;
   - `presentacion` no importa un juego;
   - un juego importa el motor (`comun`, `nucleo`, `presentacion`), nunca otro juego;
   - el **cartucho** de un juego (sus reglas) no importa Three.js ni la presentación: corre sin pantalla.
3. **Las dependencias declaradas:** cada `package.json` dice de qué depende; el núcleo no declara `three`.

## Consecuencias

- Un error de frontera aparece al compilar o al pasar el linter, con un mensaje que dice por qué.
- Las pruebas de la simulación usan Vitest; esos archivos pueden importar `vitest`, que trae tipos de Node: se compilan con `skipLibCheck`.

## Alternativas descartadas

- **Una prueba que busca texto** (la de la V1): funciona, pero llega tarde (al correr las pruebas) y se engaña con comentarios.
- **dependency-cruiser o un plugin de fronteras:** más potentes; para cuatro capas, `no-restricted-imports` alcanza.
