#!/usr/bin/env node
/**
 * U4 bundle report: exact bytes of the built candidate harness.
 *
 * Walks `packages/viewer-thatopen/dist` and records per-file raw bytes, gzip bytes and sha256,
 * plus totals by kind. The harness is a standalone page, so these numbers are the complete
 * candidate footprint (three + @thatopen/components + @thatopen/fragments core + camera-controls
 * + web-ifc glue + app code + the fragments worker asset + the web-ifc WASM asset).
 *
 * Also records, clearly labelled as context (not apples-to-apples):
 *   - the existing guide-site build's JS/CSS assets (the viewer-three-based application), and
 *   - the raw three.js module files that viewer-three depends on.
 *
 * Usage: node scripts/u4-bundle-report.mjs [out.json]
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const here = fileURLToPath(new URL('.', import.meta.url));
const platformRoot = resolve(here, '..');
const harnessDir = join(platformRoot, 'packages', 'viewer-thatopen', 'dist');
const outPath = resolve(process.argv[2] ?? join(harnessDir, '..', 'bundle-report.json'));

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function measure(files, root) {
  return files
    .map((file) => {
      const bytes = readFileSync(file);
      return {
        path: relative(root, file).split('\\').join('/'),
        bytes: bytes.byteLength,
        gzipBytes: gzipSync(bytes, { level: 9 }).byteLength,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      };
    })
    .sort((a, b) => b.bytes - a.bytes);
}

function totals(files) {
  return {
    files: files.length,
    rawBytes: files.reduce((sum, file) => sum + file.bytes, 0),
    gzipBytes: files.reduce((sum, file) => sum + file.gzipBytes, 0),
  };
}

function byKind(files) {
  const kinds = new Map();
  for (const file of files) {
    const ext = extname(file.path).toLowerCase() || '(none)';
    const bucket = kinds.get(ext) ?? { files: 0, rawBytes: 0, gzipBytes: 0 };
    bucket.files += 1;
    bucket.rawBytes += file.bytes;
    bucket.gzipBytes += file.gzipBytes;
    kinds.set(ext, bucket);
  }
  return Object.fromEntries([...kinds.entries()].sort());
}

if (!existsSync(harnessDir)) {
  console.error(`not_run: ${harnessDir} is missing; run the harness build first (vite build).`);
  process.exit(2);
}

const harnessFiles = measure(walk(harnessDir), harnessDir);
const report = {
  generatedAt: new Date().toISOString(),
  harness: {
    dir: 'packages/viewer-thatopen/dist',
    files: harnessFiles,
    totals: totals(harnessFiles),
    byKind: byKind(harnessFiles),
  },
  context: {},
};

const guideSiteAssetsDir = join(platformRoot, 'apps', 'guide-site', 'dist', 'assets');
if (existsSync(guideSiteAssetsDir)) {
  const assets = measure(
    walk(guideSiteAssetsDir).filter((file) => ['.js', '.css'].includes(extname(file))),
    guideSiteAssetsDir,
  );
  report.context['guide-site-dist-assets'] = {
    note:
      'existing guide-site application (viewer-three path). Not a minimal viewer bundle: it also contains the React UI, ' +
      'the compiled-guide pipeline and all routes. Context only.',
    files: assets,
    totals: totals(assets),
  };
}

const threeBuild = join(platformRoot, 'node_modules', 'three', 'build');
if (existsSync(threeBuild)) {
  const threeFiles = ['three.core.js', 'three.module.js']
    .map((name) => join(threeBuild, name))
    .filter((file) => existsSync(file))
    .map((file) => {
      const bytes = readFileSync(file);
      return {
        path: `node_modules/three/build/${relative(threeBuild, file)}`,
        bytes: bytes.byteLength,
        gzipBytes: gzipSync(bytes, { level: 9 }).byteLength,
      };
    });
  report.context['three-raw-modules'] = {
    note:
      'raw unminified three.js modules that viewer-three depends on (unbundled; a Vite build minifies and tree-shakes them). Context only.',
    files: threeFiles,
    totals: totals(threeFiles),
  };
}

writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
const entry = harnessFiles.find((file) => /^assets\/index-.*\.js$/.test(file.path));
console.log(`u4-bundle-report: wrote ${outPath}`);
console.log(
  `u4-bundle-report: harness total ${report.harness.totals.rawBytes} bytes raw / ` +
    `${report.harness.totals.gzipBytes} bytes gzip across ${report.harness.totals.files} files`,
);
if (entry) {
  console.log(
    `u4-bundle-report: entry ${entry.path} ${entry.bytes} bytes (gzip ${entry.gzipBytes})`,
  );
}
for (const file of harnessFiles) {
  console.log(`  ${String(file.bytes).padStart(9)}  gz ${String(file.gzipBytes).padStart(9)}  ${file.path}`);
}
