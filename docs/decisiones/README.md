# Decisiones de arquitectura

Cada decisión importante queda escrita aquí, con su porqué, en un documento corto y numerado (en inglés se llaman _Architecture Decision Records_, ADR). Sirven para no volver a discutir lo ya decidido sin saber por qué se decidió, y para que el tutorial pueda citarlas.

Cada una tiene: **contexto** (qué problema había), **decisión**, **consecuencias** (lo bueno y lo que cuesta) y **alternativas** descartadas. Una decisión no se borra: si cambia, se escribe otra que la reemplaza y se marca la vieja como _reemplazada_.

| N.º                                     | Decisión                                                           | Estado                              |
| --------------------------------------- | ------------------------------------------------------------------ | ----------------------------------- |
| [0000](0000-por-que-la-v2.md)           | Por qué la V2, y qué tomamos de los borradores y de la V1          | Aceptada                            |
| [0001](0001-monorepo-y-herramientas.md) | Un monorepo, y sus herramientas                                    | Aceptada                            |
| [0002](0002-el-sitio.md)                | El sitio: Astro con Starlight, en GitHub Pages                     | Aceptada                            |
| [0003](0003-fronteras.md)               | Las fronteras entre capas, vigiladas por el compilador y el linter | Aceptada                            |
| [0004](0004-estado-como-datos.md)       | El estado del mundo como datos planos                              | Aceptada (se completa en la fase 1) |
| [0005](0005-forma-de-trabajo.md)        | Cómo se trabaja: ramas, PR, commits, etiquetas, idioma             | Aceptada                            |
| [0006](0006-el-nombre.md)               | El nombre: Manifold Gaming                                         | Aceptada                            |
