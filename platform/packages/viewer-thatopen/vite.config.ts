/**
 * U4 candidate harness build (packet U4, deliverable 1).
 *
 * The harness is a standalone page — it is deliberately not wired into `apps/guide-site`.
 * `@thatopen/fragments/worker?url` emits the version-matched fragments worker as a local asset
 * and `web-ifc/web-ifc.wasm?url` emits the single-threaded WASM, so the built page never
 * contacts a CDN (the library defaults resolve both from unpkg.com).
 */
import { defineConfig } from 'vite';

export default defineConfig({
  root: import.meta.dirname,
  base: '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: false,
    reportCompressedSize: true,
    // web-ifc's loader appends the literal file name (`web-ifc.wasm`) to the configured WASM
    // directory, so the emitted asset must keep that name instead of Vite's content hash.
    // Same for the fragments worker: a deterministic name keeps the local-asset contract
    // auditable in the evidence.
    rolldownOptions: {
      output: {
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
