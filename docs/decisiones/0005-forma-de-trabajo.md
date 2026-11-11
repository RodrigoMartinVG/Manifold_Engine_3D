# 0005. Cómo se trabaja: ramas, PR, commits, etiquetas, idioma

- **Estado:** aceptada
- **Fecha:** 2026-11-11

## Contexto

Un proyecto profesional, aunque lo haga una sola persona (con ayuda), y con un tutorial que tiene que poder mostrar el código **tal como estaba** en cada paso.

## Decisión

- **`main` siempre anda.** Se protege en GitHub: solo entra por _pull request_ (PR) con la integración continua en verde.
- **Un paso, una rama y un PR.** Las ramas se llaman `paso/NN-tema` (por ejemplo, `paso/01-mundo-y-fisica`). El PR de un paso trae **el código, sus pruebas, su informe en la bitácora y, si trae ideas nuevas, sus lecciones del tutorial** (modificado por la [0007](0007-tutorial-ejecutable.md)); si falta uno, el paso no terminó.
- **Commits convencionales, en español:** `tipo(ámbito): qué cambió`. Tipos: `feat` (algo nuevo), `fix` (un arreglo), `docs`, `test`, `refactor`, `build` (herramientas, dependencias), `ci`, `chore`. Ejemplo: `feat(nucleo): gravedad como campo radial`.
- **Una etiqueta por paso** (`paso-00`, `paso-01`...) al fusionar su PR: el informe y las lecciones enlazan al código de su etiqueta.
- **Integración continua** (GitHub Actions) en cada PR y en `main`: tipos, linter, formato, pruebas sin pantalla, compilación del sitio y pruebas en el navegador. Si `main` pasa, se publica el sitio.
- **Romper a propósito** cada prueba nueva una vez, para ver que falla cuando tiene que fallar. En la V1 hubo pruebas que pasaban sin probar nada.
- **Idioma: español**, en el código (nombres de variables, funciones y archivos), en los comentarios, en los commits y en el tutorial. Es coherente con el tutorial y con la forma de aprender del autor. El precio: llega a menos gente en GitHub.

## Consecuencias

- Cada paso deja un rastro claro: rama, PR con su discusión, etiqueta, informe y lecciones.
- Trabajar solo con PR parece burocracia; a cambio, la integración continua revisa todo antes de que entre a `main`, y el historial explica cada cambio.

## Alternativas descartadas

- **Commits directos a `main`:** más rápido, pero nada impide romperlo.
- **Código en inglés:** más alcance; se eligió la coherencia con el tutorial.
