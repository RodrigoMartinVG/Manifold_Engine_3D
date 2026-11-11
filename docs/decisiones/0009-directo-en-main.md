# 0009. Directo en main, sin pull requests

- **Estado:** aceptada (reemplaza lo de ramas y PR de la [0005](0005-forma-de-trabajo.md))
- **Fecha:** 2026-11-11

## Contexto

La [0005](0005-forma-de-trabajo.md) pedía que todo entrara a `main` por _pull request_ (PR), con la integración continua en verde. En la práctica, en las primeras etapas:

- **Nadie revisa los PR.** El proyecto lo hace una persona con un asistente: el autor revisa mirando el sitio, no el PR.
- **Fusionar era un trámite** que caía en el autor: aprobar, esperar, fusionar. Con PR encadenados (uno encima de otro) fue peor: al fusionar el primero y borrar su rama, GitHub cerró el que estaba encima, y hubo que rebasar cada uno y esperar otra verificación.
- **La verificación de GitHub puede trabarse.** El 2026-11-11, las ejecuciones quedaron en cola casi una hora sin arrancar. Como `main` exigía que pasaran, nada podía entrar.

## Decisión

- **Se trabaja directo en `main`.** Cada cambio es uno o varios commits convencionales (siguen las reglas de la 0005), que se suben a `main`.
- **Antes de subir, se verifica en la máquina:** `npm run verificar` (tipos, linter, formato y pruebas sin pantalla) y las pruebas en Chromium sobre el sitio armado. Es lo mismo que corre GitHub.
- **GitHub sigue verificando cada cambio de `main`, y el sitio solo se publica si pasa.** Si algo se rompe, el sitio publicado sigue siendo el anterior hasta que se arregle.
- **`main` sigue protegida contra lo irreversible:** no se puede borrar ni reescribir su historia (nada de `push --force`).
- **Las etiquetas por etapa siguen** (`paso-00`, `paso-01`...): el tutorial y la bitácora enlazan al código de su etiqueta.
- **Un PR sigue siendo posible** para algo que convenga mirar aparte antes de que entre: un experimento grande, o las actualizaciones de Dependabot.

## Consecuencias

- El autor no tiene que aprobar ni fusionar nada: ve los cambios en el sitio o en su servidor local, y pide ajustes.
- Un error que pase la verificación local puede llegar a `main`. Lo frena la verificación de GitHub antes de publicar, y se arregla con un commit nuevo encima: no se reescribe la historia.
- El historial de `main` muestra cada commit, en vez de un commit por PR.

## Alternativas descartadas

- **Seguir con PR, pero que se fusionen solos** cuando pase la verificación: ahorra los clics, pero no las esperas, ni el problema de los PR encadenados.
- **Una rama de trabajo que se fusiona de vez en cuando:** una capa más, sin nadie que la revise.
