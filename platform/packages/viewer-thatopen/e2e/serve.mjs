/**
 * U4 static server for the compositor proof.
 *
 * Serves, read-only:
 *   /            -> packages/viewer-thatopen/dist (the built harness)
 *   /data/       -> apps/guide-site/public/data (published catalog, releases, id-maps, P0 IFC)
 *   /u4-models/  -> U4_MODELS_DIR (deterministically regenerated models that are missing from
 *                   the published tree, e.g. the R35 IFC; see README)
 *   /healthz     -> 200 "ok" for the Playwright webServer probe
 *
 * No cloud services and no COOP/COEP headers: web-ifc therefore selects the single-threaded
 * WASM, which is the packet's preferred mode. `Cache-Control: no-store` keeps every cold-load
 * run an honest network load (the proof also disables the browser cache via CDP).
 *
 * Started by `playwright.config.ts` (cwd = package dir). Env:
 *   U4_PORT         port (default 4399)
 *   U4_MODELS_DIR   regenerated-model directory (default: evidence run-1/models)
 */
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const packageDir = resolve(here, '..');
const platformRoot = resolve(packageDir, '..', '..');
const port = Number(process.env.U4_PORT ?? 4399);
const distDir = join(packageDir, 'dist');
const dataDir = join(platformRoot, 'apps', 'guide-site', 'public', 'data');
const modelsDir =
  process.env.U4_MODELS_DIR ??
  join(platformRoot, 'work', '3d-platform', 'evidence', 'p0', 'u4-thatopen', 'run-1', 'models');

const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.wasm', 'application/wasm'],
  ['.ifc', 'application/octet-stream'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.map', 'application/json; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
]);

const mounts = [
  { prefix: '/data/', dir: dataDir },
  { prefix: '/u4-models/', dir: modelsDir },
  { prefix: '/', dir: distDir },
];

/** Resolve a URL path within a mount; returns null on traversal or missing files. */
function resolveInMount(mountDir, relative) {
  const decoded = decodeURIComponent(relative);
  const normalized = normalize(decoded).replace(/^([/\\])+/, '');
  if (normalized.split(/[/\\]/).some((segment) => segment === '..')) return null;
  const absolute = resolve(mountDir, normalized);
  if (absolute !== mountDir && !absolute.startsWith(`${mountDir}${sep}`)) return null;
  if (!existsSync(absolute) || !statSync(absolute).isFile()) return null;
  return absolute;
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  if (url.pathname === '/healthz') {
    response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('ok');
    return;
  }
  for (const mount of mounts) {
    if (!url.pathname.startsWith(mount.prefix)) continue;
    const relative = url.pathname.slice(mount.prefix.length);
    const file = resolveInMount(mount.dir, relative === '' ? 'index.html' : relative);
    if (!file) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end(`not found: ${url.pathname}`);
      return;
    }
    const headers = {
      'content-type': MIME.get(extname(file).toLowerCase()) ?? 'application/octet-stream',
      'cache-control': 'no-store',
      'content-length': String(statSync(file).size),
      etag: `"${createHash('sha256').update(String(statSync(file).size)).digest('hex').slice(0, 16)}"`,
    };
    if (request.method === 'HEAD') {
      response.writeHead(200, headers);
      response.end();
      return;
    }
    response.writeHead(200, headers);
    createReadStream(file).pipe(response);
    return;
  }
  response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  response.end(`not found: ${url.pathname}`);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`u4-serve: http://127.0.0.1:${port}`);
  console.log(`u4-serve: harness=${distDir}`);
  console.log(`u4-serve: data=${dataDir}`);
  console.log(`u4-serve: models=${modelsDir}`);
});
