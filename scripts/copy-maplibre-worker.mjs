/**
 * Copies MapLibre's web worker into public/maplibre/ so the browser can fetch it.
 *
 * MapLibre 6 derives its worker URL from its own `import.meta.url`, which under
 * Turbopack points at a hashed chunk in /_next/static — the sibling worker file
 * isn't there, the request 404s to the HTML error page, and every GeoJSON source
 * silently stays unloaded (map renders, overlays never appear).
 *
 * Serving the worker ourselves and pointing MapLibre at it with `setWorkerUrl`
 * sidesteps the whole resolution problem. Runs before dev and build so the copy
 * can never drift from the installed version.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const maplibreDist = dirname(require.resolve("maplibre-gl/package.json")) + "/dist";
const target = resolve(process.cwd(), "public/maplibre");

mkdirSync(target, { recursive: true });

// The worker imports the shared chunk as a sibling, so both have to land together.
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(resolve(maplibreDist, file), resolve(target, file));
}

console.log(`Copied MapLibre worker files to ${target}`);
