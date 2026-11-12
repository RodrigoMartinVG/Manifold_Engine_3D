# 0001. Un monorepo, y sus herramientas

- **Estado:** aceptada
- **Fecha:** 2026-11-11

## Contexto

La plataforma tiene piezas que se usan entre sí: el motor (en capas), los juegos y el sitio. Se tienen que poder cambiar juntas (tocar el motor y ver el cambio en el Dojo al instante) sin publicar paquetes a ningún lado.

## Decisión

**Un solo repositorio con _workspaces_ de npm:**

```
paquetes/comun          azar, matemática (sin dependencias)
paquetes/nucleo         la simulación (sin pantalla)
paquetes/presentacion   Three.js: lo que se ve
juegos/dojo             el primer juego
sitio                   la web (Astro)
```

Cada paquete se llama `@manifold/...` y exporta su código fuente TypeScript directamente (sin compilar): Vite y Vitest lo entienden, y los cambios se ven en caliente.

**Herramientas:**

| Para qué                | Qué                                                                                                              | Por qué                                                                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Node                    | **26 LTS** (desde el 2026-11-11; antes, la 24), fijado con `mise.toml` (local) y `.nvmrc` (integración continua) | La 26 es la LTS activa desde octubre de 2026, con soporte hasta abril de 2029; la 24 pasó a mantenimiento. Los tipos (`@types/node`) se suben junto con Node |
| Paquetes                | **npm** con _workspaces_                                                                                         | Viene con Node; sin otra herramienta que instalar. (pnpm es más estricto con las dependencias; esa estrictez la dan aquí el compilador y el linter: 0003)    |
| Lenguaje                | **TypeScript 6.0**                                                                                               | La 7 (reescrita en Go) ya salió, pero el linter y el chequeo de Astro todavía no la aceptan. Se revisa cuando la acepten                                     |
| Compilar y servir       | **Vite** (a través de Astro)                                                                                     | Rápido y con recarga en caliente; ya conocido                                                                                                                |
| Pruebas sin pantalla    | **Vitest**, archivos `*.prueba.ts` junto al código                                                               | Entiende los workspaces y TypeScript sin configuración                                                                                                       |
| Pruebas en el navegador | **Playwright** (Chromium)                                                                                        | Abre cada página como una persona. En la V1, un cambio en el arranque rompió todas las teclas sin que ninguna prueba lo viera                                |
| Estilo                  | **ESLint** (con typescript-eslint) y **Prettier**                                                                | El linter, además, vigila las fronteras (0003)                                                                                                               |

**Scripts de la raíz:** `npm run dev`, `build`, `check` (tipos), `lint`, `formato`, `pruebas`, `e2e`, y `verificar` (todo lo anterior menos el navegador).

## Consecuencias

- Un solo `npm install`, un solo historial y una sola integración continua.
- Exportar el código fuente sin compilar es simple, pero ata los paquetes a herramientas que entiendan TypeScript. Si algún día un paquete se publica, se agrega su compilación.

## Alternativas descartadas

- **Varios repositorios:** cada cambio del motor necesitaría publicar una versión para verlo en un juego.
- **pnpm o Turborepo:** útiles en monorepos grandes; aquí agregan herramientas sin un problema que resolver todavía.
- **El ejecutor de pruebas de Node** (`node:test`, el de la V1): anduvo bien, pero Vitest da mejores reportes, modo "mirar" y se integra con Vite.
