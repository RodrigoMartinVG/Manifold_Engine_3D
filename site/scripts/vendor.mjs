// @ts-check
/**
 * THE TUTORIAL'S LIBRARIES, one file each (decision 0007).
 *
 * The lessons' code runs in an ISOLATED iframe (with its own origin), which cannot ask the site for
 * modules. So at build time the site bundles one file per library (with everything inside: no
 * relative `import`s the iframe could not resolve), reads them and hands them to the iframe, which
 * turns them into modules with an import map. That way a lesson writes
 * `import * as THREE from 'three'` as in any project, and uses the SAME version as the engine.
 *
 * To add a library: one more entry in LIBRARIES.
 */
import { build } from 'vite';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const entries = fileURLToPath(new URL('../.vendor-entries/', import.meta.url));
const target = fileURLToPath(new URL('../public/vendor/', import.meta.url));

/** What a lesson can import: its specifier, the file that resolves it and what it leaves out. */
const LIBRARIES = [
  { specifier: 'three', file: 'three.js', code: "export * from 'three';", external: [] },
  {
    specifier: 'three/addons/controls/OrbitControls.js',
    file: 'orbit-controls.js',
    code: "export * from 'three/addons/controls/OrbitControls.js';",
    // It uses Three.js: it imports it by name, and the iframe gives it the same module (one single copy).
    external: ['three'],
  },
  {
    specifier: 'three/addons/libs/lil-gui.module.min.js',
    file: 'lil-gui.js',
    code: "export * from 'three/addons/libs/lil-gui.module.min.js';\nexport { default } from 'three/addons/libs/lil-gui.module.min.js';",
    external: [],
  },
  {
    // The physics engine (stage 1), the same build as the engine's: the deterministic one. It weighs
    // about 4 MB, because its WebAssembly travels inside it (that is the "compat" build: it needs no
    // other file); so a lesson only fetches it if it imports it.
    specifier: '@dimforge/rapier3d-deterministic-compat',
    file: 'rapier.js',
    code: "export * from '@dimforge/rapier3d-deterministic-compat';\nexport { default } from '@dimforge/rapier3d-deterministic-compat';",
    external: [],
  },
];

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await mkdir(entries, { recursive: true });
/** @type {Record<string, string>} */
const manifest = {};
for (const lib of LIBRARIES) {
  const entry = `${entries}${lib.file}`;
  await writeFile(entry, lib.code);
  await build({
    configFile: false,
    root,
    publicDir: false, // the output goes INSIDE public/: Vite must not try to copy it into itself
    logLevel: 'warn',
    build: {
      lib: { entry, formats: ['es'], fileName: () => lib.file },
      outDir: target,
      emptyOutDir: false,
      minify: true,
      rolldownOptions: { external: lib.external },
    },
  });
  manifest[lib.specifier] = lib.file;
}
await writeFile(`${target}manifest.json`, JSON.stringify(manifest, null, 2));
await rm(entries, { recursive: true, force: true });
console.log(`The tutorial's libraries: ${Object.keys(manifest).join(', ')}`);
